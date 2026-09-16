const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const backendSource = fs.readFileSync('apps-script/Code.gs', 'utf8');
const frontendSource = fs.readFileSync('index.html', 'utf8');
const context = { console, Utilities: {}, SpreadsheetApp: {}, Logger: { log() {} } };
vm.createContext(context);
vm.runInContext(backendSource, context);

const tasks = [
  { task_id: 'A-1', main_path: 'hospitality', owner: 'Owner A', owner_email: 'a@example.test' },
  { task_id: 'B-1', main_path: 'operations', owner: 'Owner B', owner_email: 'b@example.test' },
];
const datasets = {
  approvals: [
    { approval_id: 'APP-A', linked_wbs_code: 'A-1' },
    { approval_id: 'APP-B', linked_wbs_code: 'B-1' },
  ],
  escalations: [
    { escalation_id: 'ESC-A', item_id: 'A-1' },
    { escalation_id: 'ESC-B', item_id: 'B-1' },
  ],
  decisions: [
    { decision_id: 'DEC-A', linked_id: 'APP-A' },
    { decision_id: 'DEC-B', linked_id: 'APP-B' },
  ],
  risks: [{ risk_id: 'R-A', path: 'hospitality' }, { risk_id: 'R-B', path: 'operations' }],
};
const auth = context.buildPathAuthorizationContext_(tasks, datasets);
const managerA = { username: 'manager.a', access_level: 'workstream', path_scope: 'hospitality' };
const managerB = { username: 'manager.b', access_level: 'workstream', path_scope: 'operations' };

test('the four required immutable usernames retain full cross-path access', () => {
  for (const username of ['atheer', 'ahmad.amoudi', 'abdulaziz.obaid', 'abdullah.almarhoom']) {
    const session = { username, access_level: 'none', path_scope: 'unrelated' };
    assert.equal(context.hasFullAccess_(session), true, username);
    assert.deepEqual(Array.from(context.scopeRowsForSession_(tasks, session, auth), row => row.task_id), ['A-1', 'B-1']);
  }
});

test('path managers receive only their own WBS path', () => {
  assert.deepEqual(Array.from(context.scopeRowsForSession_(tasks, managerA, auth), row => row.task_id), ['A-1']);
  assert.deepEqual(Array.from(context.scopeRowsForSession_(tasks, managerB, auth), row => row.task_id), ['B-1']);
});

test('linked approvals, escalations, decisions, and direct risks stay isolated', () => {
  assert.deepEqual(Array.from(context.scopeRowsForSession_(datasets.approvals, managerA, auth), row => row.approval_id), ['APP-A']);
  assert.deepEqual(Array.from(context.scopeRowsForSession_(datasets.escalations, managerA, auth), row => row.escalation_id), ['ESC-A']);
  assert.deepEqual(Array.from(context.scopeRowsForSession_(datasets.decisions, managerA, auth), row => row.decision_id), ['DEC-A']);
  assert.deepEqual(Array.from(context.scopeRowsForSession_(datasets.risks, managerA, auth), row => row.risk_id), ['R-A']);
});

test('unresolved records fail closed for path managers but remain visible to full access', () => {
  const unresolved = [{ approval_id: 'NO-PATH' }];
  assert.equal(context.scopeRowsForSession_(unresolved, managerA, auth).length, 0);
  assert.equal(context.scopeRowsForSession_(unresolved, { username: 'atheer' }, auth).length, 1);
});

test('path manager cannot write, approve, or escalate a record from another path', () => {
  for (const record of [tasks[1], datasets.approvals[1], datasets.escalations[1]]) {
    assert.throws(
      () => context.requireRecordPathAccess_(managerA, record, auth),
      /outside the authenticated path scope/,
    );
  }
  assert.equal(context.requireRecordPathAccess_(managerA, datasets.approvals[0], auth), true);
});

test('data_sync scopes before payload and all derived operational datasets use scoped rows', () => {
  assert.match(backendSource, /const rows = scopeRowsForSession_\(allRows, session, authorizationContext\)/);
  assert.match(backendSource, /buildBaselineManagement_\(spreadsheet, rows\)/);
  assert.match(backendSource, /buildCriticalPathAnalysis_\(spreadsheet, rows\)/);
  assert.match(backendSource, /buildDataQualityCenter_\(spreadsheet, rows, employeeMaster, criticalPath\)/);
});

test('UI and backend share the same full-user boundary and writes have server guards', () => {
  for (const username of ['atheer', 'ahmad.amoudi', 'abdulaziz.obaid', 'abdullah.almarhoom']) {
    assert.match(frontendSource, new RegExp(`['"]${username.replace('.', '\\.')}['"]`));
    assert.match(backendSource, new RegExp(`['"]${username.replace('.', '\\.')}['"]`));
  }
  assert.match(frontendSource, /return hasFullAccessUser\(\)\|\|pages\.includes\('\*'\)\|\|pages\.includes\(id\)/);
  for (const action of ['daily_update', 'approval_request', 'approval_update', 'task_assignment_confirm', 'meeting_record']) {
    const branch = backendSource.slice(backendSource.indexOf(`payload.action === '${action}'`), backendSource.indexOf(`payload.action === '${action}'`) + 700);
    assert.match(branch, /requirePayloadPathAccess_/, action);
  }
});

test('paste-ready bundle is generated from the canonical core and inquiry module', () => {
  const bundle = fs.readFileSync('apps-script/current-apps-script.gs', 'utf8');
  const inquiries = fs.readFileSync('apps-script/Inquiries.gs', 'utf8');
  assert.equal(bundle, backendSource + '\n\n// Bundled inquiry module. Source: apps-script/Inquiries.gs\n' + inquiries);
});
