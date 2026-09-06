const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const html = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const appsScript = fs.readFileSync(new URL('../apps-script/Code.gs', `file://${__filename}`), 'utf8');

function sectionBetween(start, end) {
  const startIndex = html.indexOf(start);
  const endIndex = html.indexOf(end, startIndex);
  assert.notEqual(startIndex, -1, `missing section start: ${start}`);
  assert.notEqual(endIndex, -1, `missing section end: ${end}`);
  return html.slice(startIndex, endIndex);
}

test('task table omits update and source columns from its header and rendered rows', () => {
  const table = sectionBetween('<table class="data-table task-table" id="taskTable">', '</table>');
  const renderedRows = sectionBetween('return `<tr onclick="openDetail(', '</tr>`;');

  assert.doesNotMatch(table, /آخر تحديث|مصدر البيانات/);
  assert.doesNotMatch(renderedRows, /r\.lastUpdate|r\.dataSource|r\._source/);
  assert.match(renderedRows, /task-col-follow-up/);
  assert.match(renderedRows, /task-col-deliverable/);
});

test('empty task results span exactly the remaining visible columns', () => {
  assert.match(html, /const visibleColumns=\(canViewCompletionEvidence\(\)\?22:21\)/);
});

test('update and source fields remain in normalization and Google Sheets integration', () => {
  assert.match(html, /lastUpdate:\['last_update','updated','آخر تحديث','تاريخ التحديث'\]/);
  assert.match(html, /dataSource:\['مصدر البيانات','source','data_source','_source'\]/);
  assert.match(html, /const lastUpdate=isoDate\(valueOf\(raw,WBS_FIELD_ALIASES\.lastUpdate\)\)/);
  assert.match(html, /const dataSource=String\(valueOf\(raw,WBS_FIELD_ALIASES\.dataSource\)/);
  assert.match(appsScript, /lastUpdate:\['last_update','updated','آخر تحديث','تاريخ التحديث'\]/);
  assert.match(appsScript, /dataSource:\['مصدر البيانات','source','data_source','_source'\]/);
  assert.match(appsScript, /item\._source = 'google_sheets'/);
});

test('long task columns receive dedicated widths without positional selectors', () => {
  const taskStyles = sectionBetween('#tasks .task-table{', '/* لوحة مراحل المشروع التنفيذية');
  assert.match(taskStyles, /\.task-col-owner\{width:190px/);
  assert.match(taskStyles, /\.task-col-follow-up\{width:190px/);
  assert.match(taskStyles, /\.task-col-deliverable\{width:260px/);
  assert.doesNotMatch(taskStyles, /nth-child/);
});
