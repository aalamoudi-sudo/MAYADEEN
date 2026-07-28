const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('apps-script/Code.gs', 'utf8');
const start = source.indexOf('function buildDataQualityCenter_');
const end = source.indexOf('\nfunction dataQualityIssueKey_', start);
assert.notEqual(start, -1, 'Data Quality Center builder must exist');
assert.notEqual(end, -1, 'Data Quality Center builder boundary must exist');
const body = source.slice(start, end);

const expectedRules = [
  ['كود مكرر', 'critical'],
  ['اسم مهمة مكرر', 'medium'],
  ['حقل إلزامي مفقود', 'critical'],
  ['حقل إلزامي مفقود', 'high'],
  ['مسؤول غير محدد', 'high'],
  ['تاريخ بداية غير صالح', 'high'],
  ['تاريخ نهاية غير صالح', 'high'],
  ['تاريخ نهاية أقدم من تاريخ البداية', 'critical'],
  ['نسبة إنجاز خارج النطاق', 'high'],
  ['مهمة مكتملة دون تاريخ إغلاق', 'high'],
  ['مرجع مفقود أو علاقة غير صالحة', 'critical'],
  ['مرجع مسؤول غير صالح', 'critical'],
  ['مرجع مفقود أو علاقة غير صالحة', 'critical']
];

const actualRules = [...body.matchAll(/add\('([^']+)'[^;]*?,'(critical|high|medium|low)'(?:,|\))/g)]
  .map(match => [match[1], match[2]]);
assert.deepEqual(actualRules, expectedRules, 'Every generated violation must have exactly one approved severity');

const counts = actualRules.reduce((result, [, severity]) => {
  result[severity] += 1;
  return result;
}, {critical: 0, high: 0, medium: 0, low: 0});
assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), actualRules.length,
  'Severity buckets must cover every rule exactly once');
assert.deepEqual(counts, {critical: 6, high: 6, medium: 1, low: 0});

console.log('PASS data-quality severity policy covers every generated rule exactly once');
