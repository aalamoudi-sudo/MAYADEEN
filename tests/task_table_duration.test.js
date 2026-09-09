const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

function functionSource(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function: ${name}`);
  const bodyStart = html.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < html.length; index++) {
    if (html[index] === '{') depth++;
    if (html[index] === '}' && --depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`unclosed function: ${name}`);
}

const context = {
  getTaskPlannedStartDate: task => task.start || '',
  getTaskPlannedEndDate: task => task.end || ''
};
vm.createContext(context);
['dateKeyToUtcDay_', 'getTaskTableDurationDays', 'formatTaskTableDuration']
  .forEach(name => vm.runInContext(functionSource(name), context));

test('task-table duration is inclusive across calendar boundaries', () => {
  assert.equal(context.getTaskTableDurationDays({start:'2026-09-09', end:'2026-09-09'}), 1);
  assert.equal(context.getTaskTableDurationDays({start:'2026-01-31', end:'2026-02-02'}), 3);
  assert.equal(context.getTaskTableDurationDays({start:'2025-12-31', end:'2026-01-02'}), 3);
});

test('task-table duration rejects incomplete, invalid, and reversed dates', () => {
  assert.equal(context.getTaskTableDurationDays({start:'', end:'2026-09-09'}), null);
  assert.equal(context.getTaskTableDurationDays({start:'2026-09-09', end:'not-a-date'}), null);
  assert.equal(context.getTaskTableDurationDays({start:'2026-09-10', end:'2026-09-09'}), null);
  assert.equal(context.formatTaskTableDuration({start:'', end:'2026-09-09'}), '—');
});

test('task-table duration is recalculated from dates and ignores stale sheet duration', () => {
  const task = {start:'2026-09-01', end:'2026-09-03', plannedDurationDays:99};
  assert.equal(context.formatTaskTableDuration(task), '3 يوم');
  task.end = '2026-09-05';
  assert.equal(context.formatTaskTableDuration(task), '5 يوم');
  assert.match(html, /task-col-duration[^\n]+formatTaskTableDuration\(r\)/);
  assert.doesNotMatch(html, /task-col-duration[^\n]+r\.plannedDurationDays/);
});
