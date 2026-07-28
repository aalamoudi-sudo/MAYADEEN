#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Missing ${name}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unclosed ${name}`);
}

const derive = Function(`${functionSource('dataQualitySeverity_')}; ${functionSource('deriveDataQualityMetrics_')}; return deriveDataQualityMetrics_;`)();
const issues = [
  {severity:'critical',status:'مفتوحة',last_seen_at:'2026-07-27T08:00:00Z'},
  {severity:'high',status:'قيد المعالجة',last_seen_at:'2026-07-28T08:00:00Z'},
  {severity:'medium',status:'تم الحل',last_seen_at:'2026-07-26T08:00:00Z'},
  {severity:'low',status:'مفتوحة',last_seen_at:'2026-07-25T08:00:00Z'}
];
const metrics = derive(issues);
const byLabel = Object.fromEntries(metrics.map(metric => [metric.label, metric.value]));

assert.equal(byLabel['إجمالي مخالفات جودة البيانات'], issues.length);
assert.equal(['أخطاء حرجة','مرتفعة الخطورة','متوسطة الخطورة','منخفضة الخطورة'].reduce((sum,label)=>sum+byLabel[label],0),issues.length);
assert.equal(['مفتوحة','قيد المعالجة','تم الحل'].reduce((sum,label)=>sum+byLabel[label],0),issues.length);
assert.equal(byLabel['آخر فحص للبيانات'],'2026-07-28T08:00:00Z');
assert.deepEqual(derive([]),[],'An empty table must not produce empty KPI cards');
assert.deepEqual(derive([{status:'مفتوحة'}]).map(metric=>metric.label),['إجمالي مخالفات جودة البيانات','مفتوحة'],'Missing severity must hide severity indicators instead of inventing zero values');

const RIYADH_TIME_ZONE = 'Asia/Riyadh';
const formatDate = Function('RIYADH_TIME_ZONE',`${functionSource('dataQualityDate_')}; return dataQualityDate_;`)(RIYADH_TIME_ZONE);
assert.equal(formatDate('2026-07-28T11:17:00Z'),'28 يوليو 2026 • 02:17 م');

const renderBody = functionSource('renderDataQualityCenter');
assert.match(renderBody,/deriveDataQualityMetrics_\(issues\)/);
assert.match(renderBody,/dataQualitySeverity_\(r\.severity\)/);
assert.doesNotMatch(renderBody,/summary\.|critical_count|warning_count|checked_record_count/);
assert.doesNotMatch(renderBody,/لا توجد بيانات كافية/);
console.log('PASS data-quality cards and table share the issues record with consistent totals');
