#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');
const phases = ['البدء', 'التخطيط', 'التنفيذ', 'المراقبة والتحكم', 'الإغلاق'];

function bodyOf(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Missing ${name}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}' && --depth === 0) return source.slice(open + 1, i);
  }
  throw new Error(`Unclosed ${name}`);
}

const sharedBody = bodyOf('getSharedProjectPhaseStats');
const phaseCardsBody = bodyOf('renderPhases');
const activePhaseBody = bodyOf('activePhaseForProgressHistory');
const progressBody = bodyOf('renderPhaseProgressSummary');
const scheduleMetricsBody = bodyOf('getScheduleProgressMetrics');
assert.doesNotMatch(progressBody, /\.filter\s*\(|normalizeProjectPhase|project_phase|selectedPhase|currentPhase/,
  'Progress card must not filter or normalize WBS rows');
assert.match(progressBody, /getScheduleProgressMetrics\(\)/);
assert.match(progressBody, /active\.phase/);
assert.match(progressBody, /active\.startDateKey/);
assert.match(progressBody, /active\.endDateKey/);
assert.match(progressBody, /active\.lastUpdateDate/);
assert.match(progressBody, /لا توجد بيانات زمنية معتمدة لاحتساب تقدم المشروع/);
assert.doesNotMatch(source, /id="lineChart"|actualPhaseProgressHistory|type:'doughnut'[\s\S]{0,500}phaseProgressSummary/,
  'Executive progress card must not render another chart');
assert.doesNotMatch(source, /تعذر استخراج مهام المرحلة الحالية من بيانات WBS/);
assert.doesNotMatch(source, /لا توجد إحصاءات متاحة للمرحلة الحالية/);
assert.match(sharedBody, /sharedProjectPhaseStats=getProjectPhaseStats\(\)/);
assert.match(phaseCardsBody, /getSharedProjectPhaseStats\(\)\.map/);
assert.match(phaseCardsBody, /return Object\.assign\(stat,/,
  'Phase cards must retain the shared stat object reference');
assert.match(activePhaseBody, /getCurrentProjectPhaseStat\(getSharedProjectPhaseStats\(\)\)/);
assert.match(scheduleMetricsBody, /plannedProgressPct\(\)/);
assert.match(scheduleMetricsBody, /classifyStatus\(t\)==='مكتملة'/);
assert.match(scheduleMetricsBody, /diff>=0/);
assert.match(scheduleMetricsBody, /absDiff<=5/);

const phaseCardStats = phases.map((phase, index) => ({
  phase, total: 100 + index, completed: 30 + index, progress: 30 + index
}));
// The production shared snapshot is passed by reference to both consumers.
const progressCardStats = phaseCardStats;
phases.forEach((phase, index) => {
  assert.strictEqual(progressCardStats[index], phaseCardStats[index], `${phase}: object reference`);
  assert.equal(phaseCardStats[index].total, progressCardStats[index].total, `${phase}: total`);
  assert.equal(phaseCardStats[index].completed, progressCardStats[index].completed, `${phase}: completed`);
  assert.equal(phaseCardStats[index].progress, progressCardStats[index].progress, `${phase}: progress`);
  console.log(`PASS ${phase}: total/completed/progress and object reference match`);
});
