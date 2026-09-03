#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const appSource = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const scriptSource = fs.readFileSync(new URL('../apps-script/Code.gs', `file://${__filename}`), 'utf8');

function functionSource(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Missing ${name}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unclosed ${name}`);
}

const appsContext = { isFinite, KAG_CONFIG: { timezone: 'Asia/Riyadh' }, Utilities: { formatDate: () => '' } };
vm.createContext(appsContext);
['normalizeCell_', 'normalizeArabicDigits_', 'parseProgressNumber_', 'isPercentageNumberFormat_', 'normalizeProgressDisplay_', 'normalizeTaskProgress_']
  .forEach(name => vm.runInContext(functionSource(scriptSource, name), appsContext));

const sheetCases = [
  [1, '100%', '0%', 100], [0.7, '70%', '0%', 70], [0.25, '25%', '0%', 25],
  [0.01, '1%', '0%', 1], [0, '0%', '0%', 0], [0.005, '0.5%', '0.0%', 0.5],
  ['100%', '100%', '@', 100], ['٧٠٪', '٧٠٪', '@', 70], [1, '1', '0', 1]
];
sheetCases.forEach(([raw, display, format, expected]) => {
  const result = appsContext.normalizeTaskProgress_(raw, display, format);
  assert.equal(result.value, expected, `${raw}/${format}`);
  assert.equal(result.display, `${expected}%`, `display ${raw}/${format}`);
  assert.equal(result.scale, 'percent_points');
});
assert.equal(appsContext.normalizeTaskProgress_('', '', '0%').value, null);
assert.equal(appsContext.normalizeTaskProgress_('', '', '0%').display, '—');
assert.equal(appsContext.normalizeTaskProgress_('invalid', 'invalid', '@').value, null);
assert.equal(appsContext.normalizeTaskProgress_(70, '70', '0').display, '70%');
assert.equal(appsContext.normalizeTaskProgress_(1, '1%', '\\%').value, 1, 'escaped percent is a literal, not percent formatting');

const webContext = {
  Intl,
  REQUIRED_DATA_API_RELEASE: 'task-progress-source-format-v2',
  WBS_FIELD_ALIASES: { taskId: ['كود المهمة'], taskName: ['اسم المهمة'], phase: [], mainPath: [], owner: [], ownerEmail: [], notes: [], status: [], plannedDurationDays: [], delayDays: [], predecessor: [], dependencyType: [], approvalEntity: [], operationalDeliverable: [], executionOwner: [], followUpOwner: [], taskType: [], originalStatus: [], lag: [], lastUpdate: [], priority: [], dataSource: [], version: [] },
  TASK_FIELD_ALIASES: { progress: ['نسبة الإنجاز', 'progress'], plannedStart: [], plannedEnd: [], actualStart: [], actualEnd: [], evidence: [] },
  normalizeProjectPhase: value => value,
  isoDate: value => value,
  normalizeArabic: value => value,
  computeTaskStatus: () => '',
  getTaskDelayDays: () => 0,
  normalizeHeaderKey_: value => String(value),
  isOfficialWbsRecord_: () => true,
  escapeHtml: value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;'),
  valueOf(object, names) {
    for (const name of names) if (object[name] !== undefined && object[name] !== '') return object[name];
    return '';
  }
};
vm.createContext(webContext);
['normalizeProgressDigits_', 'parseTaskProgressNumber_', 'normalizeTaskProgress', 'getTaskProgress', 'formatTaskProgress', 'normalizeRow', 'normalizeRows', 'taskProgressCellHtml', 'assertTaskProgressSourceContract', 'taskProgressDataAuditRows']
  .forEach(name => vm.runInContext(functionSource(appSource, name), webContext));

assert.equal(webContext.normalizeTaskProgress({ _progress: { value: 70, scale: 'percent_points' }, progress: 0.7 }), 70, 'API value must not be converted twice');
assert.equal(webContext.normalizeTaskProgress({ progress: 1 }), 1, '0-100 source contract keeps 1 as 1%');
assert.equal(webContext.normalizeTaskProgress({ progress: '٧٠٪' }), 70);
assert.equal(webContext.normalizeTaskProgress({ progress: '' }), null);
assert.equal(webContext.normalizeTaskProgress({ progress: 'invalid' }), null);
assert.equal(webContext.formatTaskProgress({ progress: 0 }), '0%');
assert.equal(webContext.formatTaskProgress({ progress: 100 }), '100%');
assert.equal(webContext.formatTaskProgress({ progress: 70 }), '70%');
assert.equal(webContext.formatTaskProgress({ progress: 0.5 }), '0.5%');
assert.equal(webContext.formatTaskProgress({ progress: 70, progressDisplay: '٧٠٪' }), '70%');
assert.equal(webContext.formatTaskProgress({ progress: 70, progressDisplay: '70%%' }), '70%', 'percent sign is not duplicated');
assert.equal(webContext.formatTaskProgress({ progress: null }), '—');
assert.equal(webContext.getTaskProgress({ progress: 70, status: 'مكتملة' }), 70, 'status must not override sheet progress');

// Integration path: an Apps Script-shaped source response is normalized by the
// real row pipeline and rendered by the same helper used inside the tasks table.
const sourceResponse = {
  ok: true,
  data_api_release: 'task-progress-source-format-v2',
  task_progress_contract: { field: 'progress', unit: 'percent', scale: 'percent_points' },
  rows: [
    { 'كود المهمة': 'WBS-100', 'اسم المهمة': 'One hundred', 'نسبة الإنجاز': 100, progress_display: '100%', _progress: { value: 100, scale: 'percent_points', raw_value: 1, display_value: '100%', number_format: '0%' } },
    { 'كود المهمة': 'WBS-070', 'اسم المهمة': 'Seventy', 'نسبة الإنجاز': 70, progress_display: '70%', _progress: { value: 70, scale: 'percent_points', raw_value: 0.7, display_value: '70%', number_format: '0%' } },
    { 'كود المهمة': 'WBS-001', 'اسم المهمة': 'One', 'نسبة الإنجاز': 1, progress_display: '1%', _progress: { value: 1, scale: 'percent_points', raw_value: 0.01, display_value: '1%', number_format: '0%' } }
  ]
};
webContext.assertTaskProgressSourceContract(sourceResponse);
const normalizedRows = webContext.normalizeRows(sourceResponse);
assert.deepEqual(Array.from(normalizedRows, row => row.progress), [100, 70, 1]);
assert.deepEqual(Array.from(normalizedRows, row => webContext.taskProgressCellHtml(row)), [
  '<span class="task-progress-value" dir="ltr">100%</span>',
  '<span class="task-progress-value" dir="ltr">70%</span>',
  '<span class="task-progress-value" dir="ltr">1%</span>'
]);
const audit = webContext.taskProgressDataAuditRows(sourceResponse.rows, normalizedRows);
assert.deepEqual(Array.from(audit, row => [row.task_code, row.sheet_raw_value, row.sheet_number_format, row.sheet_display_value, row.api_percent_points, row.normalized_percent_points, row.table_text]), [
  ['WBS-100', 1, '0%', '100%', 100, 100, '100%'],
  ['WBS-070', 0.7, '0%', '70%', 70, 70, '70%'],
  ['WBS-001', 0.01, '0%', '1%', 1, 1, '1%']
]);
assert.throws(() => webContext.assertTaskProgressSourceContract({ task_progress_contract: sourceResponse.task_progress_contract }), /Apps Script/);
assert.match(functionSource(appSource, 'normalizeRow'), /progress=normalizeTaskProgress\(raw\)/);
assert.match(functionSource(appSource, 'applyFilters'), /taskProgressCellHtml\(r\)/);
assert.match(scriptSource, /task_progress_contract:\s*\{[\s\S]*?scale:\s*'percent_points'/);
assert.match(scriptSource, /getDisplayValues\(\)/);
assert.match(scriptSource, /getNumberFormats\(\)/);
assert.match(scriptSource, /item\.progress_display = progress\.display/);
assert.match(appSource, /class="task-progress-value" dir="ltr"/);
assert.match(appSource, /\.task-progress-value\{[^}]*unicode-bidi:isolate/);

console.log('PASS task progress preserves source scale, Arabic percentage text, missing values, formatting, and status independence');
