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
['normalizeCell_', 'normalizeArabicDigits_', 'parseProgressNumber_', 'normalizeTaskProgress_']
  .forEach(name => vm.runInContext(functionSource(scriptSource, name), appsContext));

const sheetCases = [
  [1, '100%', '0%', 100], [0.7, '70%', '0%', 70], [0.25, '25%', '0%', 25],
  [0.01, '1%', '0%', 1], [0, '0%', '0%', 0], [0.005, '0.5%', '0.0%', 0.5],
  ['100%', '100%', '@', 100], ['٧٠٪', '٧٠٪', '@', 70], [1, '1', '0', 1]
];
sheetCases.forEach(([raw, display, format, expected]) => {
  const result = appsContext.normalizeTaskProgress_(raw, display, format);
  assert.equal(result.value, expected, `${raw}/${format}`);
  assert.equal(result.scale, 'percent_points');
});
assert.equal(appsContext.normalizeTaskProgress_('', '', '0%').value, null);
assert.equal(appsContext.normalizeTaskProgress_('invalid', 'invalid', '@').value, null);

const webContext = {
  Intl,
  TASK_FIELD_ALIASES: { progress: ['نسبة الإنجاز', 'progress'] },
  valueOf(object, names) {
    for (const name of names) if (object[name] !== undefined && object[name] !== '') return object[name];
    return '';
  }
};
vm.createContext(webContext);
['normalizeProgressDigits_', 'parseTaskProgressNumber_', 'normalizeTaskProgress', 'getTaskProgress', 'formatTaskProgress']
  .forEach(name => vm.runInContext(functionSource(appSource, name), webContext));

assert.equal(webContext.normalizeTaskProgress({ _progress: { value: 70, scale: 'percent_points' }, progress: 0.7 }), 70, 'API value must not be converted twice');
assert.equal(webContext.normalizeTaskProgress({ progress: 1 }), 1, '0-100 source contract keeps 1 as 1%');
assert.equal(webContext.normalizeTaskProgress({ progress: '٧٠٪' }), 70);
assert.equal(webContext.normalizeTaskProgress({ progress: '' }), null);
assert.equal(webContext.normalizeTaskProgress({ progress: 'invalid' }), null);
assert.match(webContext.formatTaskProgress({ progress: 0 }), /%$/);
assert.equal(webContext.formatTaskProgress({ progress: null }), '—');
assert.equal(webContext.getTaskProgress({ progress: 70, status: 'مكتملة' }), 70, 'status must not override sheet progress');
assert.match(functionSource(appSource, 'normalizeRow'), /progress=normalizeTaskProgress\(raw\)/);
assert.match(functionSource(appSource, 'applyFilters'), /formatTaskProgress\(r\)/);
assert.match(scriptSource, /task_progress_contract:\s*\{[\s\S]*?scale:\s*'percent_points'/);
assert.match(scriptSource, /getDisplayValues\(\)/);
assert.match(scriptSource, /getNumberFormats\(\)/);

console.log('PASS task progress preserves source scale, Arabic percentage text, missing values, formatting, and status independence');
