const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

function functionSource(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function: ${name}`);
  const signatureEnd = html.indexOf('\n', start);
  const bodyStart = html.lastIndexOf('{', signatureEnd);
  let depth = 0;
  for (let index = bodyStart; index < html.length; index++) {
    if (html[index] === '{') depth++;
    if (html[index] === '}' && --depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`unclosed function: ${name}`);
}

const constants = html.match(/const OFFICIAL_PATHS=.*?;\nconst OFFICIAL_PATH_ALIASES=\{[\s\S]*?\n\};/)[0];
const context = {
  taskMatchesOwnerFilter: (task, owner) => !owner || task.owner === owner,
  taskMatchesStatusFilter: (task, status) => !status || task.status === status
};
vm.createContext(context);
vm.runInContext(constants, context);
['normalizeArabic', 'officialPathValue', 'taskMatchesTaskFilters']
  .forEach(name => vm.runInContext(functionSource(name), context));

const tasks = [
  {code:'WBS-1', name:'تجهيز صالة كبار الزوار', mainPath:'مسار الضيافة', phase:'التنفيذ', owner:'نورة', taskType:'Task', status:'قيد التنفيذ'},
  {code:'WBS-2', name:'خطة حركة المركبات', mainPath:'النقل واللوجستيات', phase:'التخطيط', owner:'محمد', taskType:'Task', status:'لم تبدأ'},
  {code:'WBS-3', name:'تشغيل تجريبي', mainPath:'operations', phase:'التنفيذ', owner:'ماجد', taskType:'Milestone', status:'مكتملة'}
];

function filtered(filters) {
  return tasks.filter(task => context.taskMatchesTaskFilters(task, filters)).map(task => task.code);
}

test('official path aliases from task data match their selectable Arabic values', () => {
  assert.equal(context.officialPathValue('مسار الضيافة'), 'الضيافة');
  assert.equal(context.officialPathValue('النقل واللوجستيات'), 'اللوجستيات والنقل');
  assert.equal(context.officialPathValue('operations'), 'التشغيل');
  assert.deepEqual(filtered({path:'الضيافة'}), ['WBS-1']);
  assert.deepEqual(filtered({path:'اللوجستيات والنقل'}), ['WBS-2']);
  assert.deepEqual(filtered({path:'التشغيل'}), ['WBS-3']);
});

test('all-path reset and path filtering compose with search, phase, owner, and status', () => {
  assert.deepEqual(filtered({path:''}), ['WBS-1','WBS-2','WBS-3']);
  assert.deepEqual(filtered({path:'الضيافة', query:'كبار', phase:'التنفيذ', owner:'نورة', status:'قيد التنفيذ'}), ['WBS-1']);
  assert.deepEqual(filtered({path:'الضيافة', query:'مركبات'}), []);
  assert.deepEqual(filtered({path:'اللوجستيات والنقل', phase:'التخطيط', owner:'محمد', status:'لم تبدأ'}), ['WBS-2']);
});

test('path options stay enabled and an empty selected path has an explanatory state', () => {
  assert.doesNotMatch(html, /OFFICIAL_PATHS\.map\([^\n]+disabled/);
  assert.match(html, /لا توجد مهام للمسار «\$\{escapeHtml\(path\)\}» ضمن بقية الفلاتر المختارة/);
});
