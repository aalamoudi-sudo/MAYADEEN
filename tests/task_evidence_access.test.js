const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const backendSource = fs.readFileSync('apps-script/Code.gs', 'utf8');
const backend = vm.createContext({ console });
vm.runInContext(backendSource, backend);

const evidenceHeader = 'رابط أو مرجع دليل الإنجاز';
const completedTask = { 'كود المهمة': 'T-1', 'الحالة': 'مكتملة', [evidenceHeader]: 'https://drive.google.com/example' };
const allowedNames = [
  'أثير الثبيتي',
  'أحمد العامودي',
  'عبدالرحمن جارالله',
  'عبدالعزيز العبيد',
  'عبدالله المرحوم'
];

for (const displayName of allowedNames) {
  backend.taskRows = [completedTask];
  backend.session = { display_name: displayName, access_level: 'none' };
  const result = vm.runInContext('filterTaskEvidenceForSession_(taskRows, session)', backend);
  assert.equal(result[0][evidenceHeader], completedTask[evidenceHeader], `${displayName} should receive completed-task evidence`);
}

backend.taskRows = [completedTask];
backend.session = { display_name: 'مستخدم آخر', access_level: 'full' };
let result = vm.runInContext('filterTaskEvidenceForSession_(taskRows, session)', backend);
assert.equal(Object.prototype.hasOwnProperty.call(result[0], evidenceHeader), false, 'unauthorized users must not receive evidence, regardless of role');
assert.equal(JSON.stringify(result).includes(completedTask[evidenceHeader]), false, 'the unauthorized payload must not contain the evidence value');

backend.taskRows = [{ ...completedTask, 'الحالة': 'قيد التنفيذ' }];
backend.session = { display_name: allowedNames[0] };
result = vm.runInContext('filterTaskEvidenceForSession_(taskRows, session)', backend);
assert.equal(Object.prototype.hasOwnProperty.call(result[0], evidenceHeader), false, 'incomplete tasks must not send evidence');

backend.taskRows = [{ ...completedTask, [evidenceHeader]: '' }];
result = vm.runInContext('filterTaskEvidenceForSession_(taskRows, session)', backend);
assert.equal(result[0][evidenceHeader], '', 'an authorized completed task may retain an empty evidence cell');

const frontendSource = fs.readFileSync('index.html', 'utf8');
assert.match(frontendSource, /if\(!isTaskCompleted\(task\)\) return '-';/, 'the UI must suppress evidence for incomplete tasks');
assert.match(frontendSource, /rel="noopener noreferrer"/, 'external evidence links must prevent opener and referrer access');
assert.match(frontendSource, />عرض دليل الإنجاز<\/a>/, 'URL evidence must use the requested button label');
assert.match(frontendSource, /<span class="pill blue" title="مرجع دليل الإنجاز">/, 'text evidence must render as a professional reference instead of a link');

console.log('Task evidence access and rendering contract tests passed.');
