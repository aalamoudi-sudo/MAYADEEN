const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Missing ${name} in dashboard`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

const context = {
  normalizeTaskStatus(status) {
    const raw = String(status || '').trim();
    return ({مكتمل:'مكتملة', completed:'مكتملة', 'in progress':'قيد التنفيذ', 'not started':'لم تبدأ'})[raw.toLowerCase()] || raw || 'غير مكتملة البيانات';
  },
  getSheetStatus: task => task.sheet_status,
  isOfficialWbsRecord_: () => true,
  isTaskRecord_: () => true,
  isTaskCancelled: () => false,
  getTaskPlannedEndDate: task => /^\d{4}-\d{2}-\d{2}$/.test(task.end || '') ? task.end : '',
  riyadhTodayKey: () => '2026-09-06'
};
context.isTaskCompleted = task => context.normalizeTaskStatus(context.getSheetStatus(task)) === 'مكتملة';
vm.createContext(context);
['dateKeyToUtcDay_', 'isTaskOverdue', 'computeTaskStatus', 'classifyStatus', 'isTaskStatusOverdue', 'taskStatusFamily', 'taskMatchesStatusFilter', 'taskStatusSummary']
  .forEach(name => vm.runInContext(functionSource(name), context));

const task = (sheet_status, end, progress = 0) => ({sheet_status, end, progress});
const cases = [
  [task('مكتملة', '2026-09-05'), 'مكتملة'],
  [task('مكتملة', '2026-09-07'), 'مكتملة'],
  [task('قيد التنفيذ', '2026-09-05'), 'قيد التنفيذ - متأخرة'],
  [task('قيد التنفيذ', '2026-09-06'), 'قيد التنفيذ'],
  [task('قيد التنفيذ', '2026-09-07'), 'قيد التنفيذ'],
  [task('لم تبدأ', '2026-09-05'), 'لم تبدأ - متأخرة'],
  [task('لم تبدأ', '2026-09-06'), 'لم تبدأ'],
  [task('لم تبدأ', '2026-09-07'), 'لم تبدأ'],
  [task('بانتظار الاعتماد', '2026-09-05'), 'بانتظار الاعتماد'],
  [task('قيد التنفيذ', ''), 'قيد التنفيذ'],
  [task('لم تبدأ', 'not-a-date'), 'لم تبدأ']
];
cases.forEach(([input, expected]) => assert.equal(context.computeTaskStatus(input), expected));
assert.equal(context.computeTaskStatus(task('لم تبدأ', '2026-09-07', 100)), 'لم تبدأ', 'progress must not imply completion');

const list = cases.slice(0, 9).map(([input]) => input);
assert.deepEqual(JSON.parse(JSON.stringify(context.taskStatusSummary(list))), {total:9, done:2, inprog:3, notStarted:3, late:2});
assert.equal(list.filter(item => context.taskMatchesStatusFilter(item, 'قيد التنفيذ')).length, 3);
assert.equal(list.filter(item => context.taskMatchesStatusFilter(item, 'لم تبدأ')).length, 3);
assert.equal(list.filter(item => context.taskMatchesStatusFilter(item, 'متأخرة')).length, 2);
assert.equal(list.filter(item => context.taskMatchesStatusFilter(item, 'قيد التنفيذ - متأخرة')).length, 1);
assert.equal(list.filter(item => context.taskMatchesStatusFilter(item, 'لم تبدأ - متأخرة')).length, 1);
assert.equal(list.filter(item => context.taskMatchesStatusFilter(item, 'مكتملة')).length, 2);
console.log('Unified task status acceptance cases, cards, and filters passed.');
