const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(new URL('../apps-script/Code.gs', `file://${__filename}`), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function: ${name}`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index++) {
    if (source[index] === '{') depth++;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`unclosed function: ${name}`);
}

const context = {
  taskCode_: row => String(row.code || '').trim(),
  taskName_: row => String(row.name || '').trim(),
  durationDays_: row => Number(row.duration),
  taskField_: (row, field) => field === 'plannedDurationDays' ? row.duration : (row[field] ?? ''),
  taskStart_: row => row.start || '',
  taskEnd_: row => row.end || '',
  dayNumber_: value => value ? Math.floor(new Date(`${value}T00:00:00Z`).getTime() / 86400000) : null
};
vm.createContext(context);
['splitCriticalPathField_', 'buildCriticalPathAnalysis_'].forEach(name => vm.runInContext(functionSource(name), context));

const task = (code, duration, predecessor = '', dependencyType = '', lag = '') => ({code, name:`Task ${code}`, duration, predecessor, dependencyType, lag});
const calculate = rows => JSON.parse(JSON.stringify(context.buildCriticalPathAnalysis_(null, rows)));

test('calculates a known finish-to-start chain', () => {
  const result = calculate([task('A', 2), task('B', 3, 'A', 'FS', 0), task('C', 1, 'B', 'FS', 0)]);
  assert.equal(result.project_duration_days, 6);
  assert.deepEqual(result.tasks.map(({early_start, early_finish, total_float}) => [early_start, early_finish, total_float]), [[0,2,0],[2,5,0],[5,6,0]]);
  assert.deepEqual(result.critical_paths, [['A','B','C']]);
});

test('calculates parallel branches, float, and an FS lag', () => {
  const result = calculate([task('A', 2), task('B', 3, 'A', 'FS', 2), task('C', 2, 'A', 'FS', 0), task('D', 1, 'B,C', 'FS,FS', '0,0')]);
  assert.equal(result.project_duration_days, 8);
  assert.equal(result.tasks.find(item => item.task_code === 'C').total_float, 3);
  assert.deepEqual(result.critical_paths, [['A','B','D']]);
});

test('supports SS, FF, and SF relationships', () => {
  const result = calculate([task('A', 5), task('B', 2, 'A', 'SS', 2), task('C', 3, 'A', 'FF', 1), task('D', 1, 'C', 'SF', 4)]);
  assert.equal(result.ok, true);
  assert.equal(result.tasks.find(item => item.task_code === 'B').early_start, 2);
  assert.equal(result.tasks.find(item => item.task_code === 'C').early_start, 3);
  assert.equal(result.tasks.find(item => item.task_code === 'D').early_start, 6);
});

test('returns every tied critical path', () => {
  const result = calculate([task('A', 2), task('B', 3, 'A', 'FS'), task('C', 3, 'A', 'FS'), task('D', 1, 'B,C', 'FS', 0)]);
  assert.deepEqual(result.critical_paths, [['A','B','D'],['A','C','D']]);
});

test('rejects invalid duration, absent relationship type, missing reference, and cycles', () => {
  assert.equal(calculate([task('A', 0)]).errors[0].type, 'invalid_duration');
  assert.equal(calculate([task('A', 1), task('B', 1, 'A')]).errors[0].type, 'missing_relationship_type');
  assert.equal(calculate([task('A', 1, 'Z', 'FS')]).errors[0].type, 'missing_reference');
  const cycle = calculate([task('A', 1, 'B', 'FS'), task('B', 1, 'A', 'FS')]);
  assert.equal(cycle.circular_dependencies, true);
  assert.equal(cycle.tasks.length, 0);
});

test('keeps a task with no predecessors as an explicitly reported independent task', () => {
  const result = calculate([task('A', 4)]);
  assert.equal(result.ok, true);
  assert.equal(result.tasks[0].data_status, 'independent');
});
