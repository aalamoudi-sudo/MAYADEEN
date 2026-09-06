const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const backendSource = fs.readFileSync('apps-script/Code.gs', 'utf8');
const backend = vm.createContext({ console });
vm.runInContext(backendSource, backend);

const evidenceHeader = 'رابط أو مرجع دليل الإنجاز';
const evidenceUrl = 'https://drive.google.com/example';
const completedTask = { 'كود المهمة': 'T-1', 'الحالة': 'مكتملة', [evidenceHeader]: evidenceUrl };
const allowedAccounts = ['ahmad.amoudi', 'atheer', 'abdulaziz.obaid', 'munther.alansari'];

for (const username of allowedAccounts) {
  backend.taskRows = [completedTask];
  backend.session = { username, can_view_completion_evidence: true, access_level: 'none' };
  const result = vm.runInContext('filterTaskEvidenceForSession_(taskRows, session)', backend);
  assert.equal(result[0][evidenceHeader], evidenceUrl, `${username} should receive completed-task evidence`);
  backend.headers = ['كود المهمة', evidenceHeader, 'الحالة'];
  const headers = vm.runInContext('filterTaskEvidenceHeadersForSession_(headers, session)', backend);
  assert.equal(headers.includes(evidenceHeader), true, `${username} should receive the evidence header`);
}

for (const session of [
  { username: 'other.user', can_view_completion_evidence: false, access_level: 'none' },
  { username: 'some.executive', can_view_completion_evidence: true, access_level: 'executive' },
  { username: 'some.admin', can_view_completion_evidence: true, role: 'admin', access_level: 'full' },
  { username: 'other.user', can_view_completion_evidence: true, display_name: 'أحمد العامودي' }
]) {
  backend.taskRows = [completedTask]; backend.session = session;
  const result = vm.runInContext('filterTaskEvidenceForSession_(taskRows, session)', backend);
  assert.equal(Object.hasOwn(result[0], evidenceHeader), false, 'non-allow-listed accounts must not receive evidence');
  assert.equal(JSON.stringify(result).includes(evidenceUrl), false, 'unauthorized payload must not contain the evidence URL');
}

// A browser-supplied role/permission is irrelevant: only the server-created session is passed to the filter.
backend.taskRows = [completedTask];
backend.session = { username: 'other.user', can_view_completion_evidence: false };
backend.forgedPayload = { username: 'atheer', can_view_completion_evidence: true, role: 'admin' };
assert.equal(vm.runInContext('canViewTaskEvidence_(session)', backend), false);

backend.taskRows = [{ ...completedTask, 'الحالة': 'قيد التنفيذ' }];
backend.session = { username: allowedAccounts[0], can_view_completion_evidence: true };
assert.equal(Object.hasOwn(vm.runInContext('filterTaskEvidenceForSession_(taskRows, session)', backend)[0], evidenceHeader), false);

const frontendSource = fs.readFileSync('index.html', 'utf8');
assert.match(frontendSource, /canViewCompletionEvidence\(\)\?`<td>\$\{taskEvidenceHtml\(r\)\}<\/td>`:''/, 'unauthorized tables must omit the cell, not visually hide it');
assert.match(frontendSource, /document\.getElementById\('taskEvidenceHeader'\)\?\.remove\(\)/, 'account switching must remove the evidence header');
assert.match(frontendSource, /rows=\[\]; tasks=\[\]; milestones=\[\]; evidenceRecords=\[\];/, 'account switching must purge evidence-bearing memory');
assert.match(frontendSource, /const visibleColumns=\(canViewCompletionEvidence\(\)\?22:21\)/, 'empty-table colspan must track permission and the visible task columns');
assert.match(frontendSource, /if\(canViewCompletionEvidence\(\)\) row\.الدليل=t\.evidence\|\|''/, 'exports must omit the evidence field for unauthorized users');
assert.match(frontendSource, /rel="noopener noreferrer"/, 'external evidence links must be isolated');
console.log('Task evidence authorization, rendering, export, and session-isolation tests passed.');
