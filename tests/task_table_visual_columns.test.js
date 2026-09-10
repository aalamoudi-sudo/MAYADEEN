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
  assert.doesNotMatch(table, /المخرج المطلوب|task-col-deliverable/);
  assert.doesNotMatch(renderedRows, /task-col-deliverable|taskOverflowText\(r\.operationalDeliverable\)/);
});

test('task table omits direct owner while retaining the path owner', () => {
  const table = sectionBetween('<table class="data-table task-table" id="taskTable">', '</table>');
  const renderedRows = sectionBetween('return `<tr onclick="openDetail(', '</tr>`;');

  assert.doesNotMatch(table, /المسؤول المباشر|task-col-owner/);
  assert.doesNotMatch(renderedRows, /task-col-owner|taskOverflowText\(r\.owner\)/);
  assert.match(table, /<th class="task-col-path-owner">مسؤول المسار<\/th>/);
  assert.match(renderedRows, /task-col-path-owner[^\n]+taskOverflowText\(r\.executionOwner\)/);
  assert.match(html, /if\(!taskMatchesOwnerFilter\(r,ow\)\) return false/);
});

test('empty task results span exactly the remaining visible columns', () => {
  assert.match(html, /const visibleColumns=\(canViewCompletionEvidence\(\)\?16:15\)/);
});

test('task table hides actual start while retaining adjacent dates and data logic', () => {
  const table = sectionBetween('<table class="data-table task-table" id="taskTable">', '</table>');
  const renderedRows = sectionBetween('return `<tr onclick="openDetail(', '</tr>`;');

  assert.doesNotMatch(table, /البداية الفعلية/);
  assert.doesNotMatch(renderedRows, /fmt\(r\.actualStart\)/);
  assert.match(table, />البداية المخططة<[^\n]+>النهاية المخططة<[^\n]+>النهاية الفعلية</);
  assert.match(renderedRows, /fmt\(r\.start\)[^\n]+fmt\(r\.end\)[^\n]+fmt\(r\.actualEnd\)/);
  assert.match(html, /actualStart:isoDate\(rawActualStart\)/);
  assert.match(html, /r\.start,r\.end,r\.actualStart,r\.actualEnd/);
});

test('task table hides approval, predecessor, and lag without removing their data logic', () => {
  const table = sectionBetween('<table class="data-table task-table" id="taskTable">', '</table>');
  const renderedRows = sectionBetween('return `<tr onclick="openDetail(', '</tr>`;');

  assert.doesNotMatch(table, /task-col-approval|task-col-dependency(?:"|>)|task-col-lag|>المعتمد<|>المهمة السابقة<|>Lag</);
  assert.doesNotMatch(renderedRows, /task-col-approval|task-col-dependency(?:"|>)|task-col-lag/);
  assert.match(table, /<th class="task-col-dependency-type">نوع الاعتمادية<\/th>/);
  assert.match(renderedRows, /task-col-dependency-type[^\n]+taskOverflowText\(r\.dependencyType\)/);
  assert.match(html, /predecessor:\['المهمة السابقة','predecessor_task','predecessor','previous_task','dependency'\]/);
  assert.match(html, /lag:\['Lag','lag','فترة التأخير','الفاصل'\]/);
  assert.match(html, /approvalEntity:\['جهة الاعتماد','approval_entity','approver','approving_party','المعتمد'\]/);
});

test('operational deliverable remains normalized, searchable, and integrated', () => {
  assert.match(html, /const operationalDeliverable=valueOf\(raw,WBS_FIELD_ALIASES\.operationalDeliverable\)/);
  assert.match(html, /const haystack=\[r\.code,r\.name,r\.mainPath,r\.executionOwner,r\.phase,r\.taskType,r\.owner,r\.followUpOwner,r\.operationalDeliverable,/);
  assert.match(appsScript, /operationalDeliverable:\['المخرج المطلوب','المخرج التشغيلي','operational_deliverable','deliverable','المخرج'\]/);
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
  assert.doesNotMatch(taskStyles, /\.task-col-owner/);
  assert.match(taskStyles, /\.task-col-follow-up\{width:190px/);
  assert.doesNotMatch(taskStyles, /\.task-col-deliverable/);
  assert.doesNotMatch(taskStyles, /nth-child/);
});
