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
const plannedProgressBody = bodyOf('plannedProgressPct');
assert.doesNotMatch(progressBody, /\.filter\s*\(|normalizeProjectPhase|project_phase|selectedPhase|currentPhase/,
  'Progress card must not filter or normalize WBS rows');
assert.match(progressBody, /getScheduleProgressMetrics\(\)/);
assert.match(progressBody, /active\.phase/);
assert.match(progressBody, /active\.startDateKey/);
assert.match(progressBody, /active\.endDateKey/);
assert.doesNotMatch(progressBody, /phase-progress-indicators|المخطط|الانحراف|آخر تحديث/,
  'Progress card must not duplicate schedule indicators or show extra metadata');
assert.match(progressBody, /التقدم الفعلي للمشروع/);
assert.match(progressBody, /مدة المرحلة/);
assert.match(progressBody, /الأيام المنقضية/);
assert.match(progressBody, /الأيام المتبقية/);
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
assert.match(scheduleMetricsBody, /tasks\.map\(getTaskPlannedStartDate\)\.map\(d\)/);
assert.match(scheduleMetricsBody, /tasks\.map\(getTaskPlannedEndDate\)\.map\(d\)/);
assert.doesNotMatch(scheduleMetricsBody, /t=>d\(t\.(?:start|end)\)/,
  'Schedule metrics must use the normalized WBS date readers');
assert.match(plannedProgressBody, /tasks\.map\(getTaskPlannedStartDate\)\.map\(d\)/);
assert.match(plannedProgressBody, /tasks\.map\(getTaskPlannedEndDate\)\.map\(d\)/);
assert.match(phaseCardsBody, /const scheduleMetrics=getScheduleProgressMetrics\(\)/,
  'Phase page and home progress card must share the same schedule metrics');

// Execute the production calculation bodies against the current Google Sheets
// field names. The first task deliberately has 0% progress: zero is valid data.
const syncedTasks = Array.from({ length: 283 }, (_, index) => ({
  start_date: index === 0 ? '2026-06-01' : '2026-07-01',
  end_date: index === 282 ? '2026-11-30' : '2026-10-31',
  actual_progress: index === 0 ? 0 : (index < 85 ? 100 : 25),
  phase: phases[index % phases.length],
  status: index < 85 ? 'مكتملة' : 'قيد التنفيذ'
}));
const d = value => value ? new Date(`${value}T00:00:00Z`) : null;
const getTaskPlannedStartDate = task => task.start_date;
const getTaskPlannedEndDate = task => task.end_date;
const classifyStatus = task => task.status;
const TODAY = new Date('2026-07-29T00:00:00Z');
const runProductionMetrics = new Function(
  'tasks', 'd', 'getTaskPlannedStartDate', 'getTaskPlannedEndDate', 'classifyStatus', 'TODAY',
  `function plannedProgressPct(){${plannedProgressBody}}
   function getScheduleProgressMetrics(){${scheduleMetricsBody}}
   return getScheduleProgressMetrics();`
);
const metrics = runProductionMetrics(
  syncedTasks, d, getTaskPlannedStartDate, getTaskPlannedEndDate, classifyStatus, TODAY
);
assert.ok(metrics, '283 synchronized tasks with valid dates must produce schedule metrics');
assert.equal(metrics.actual, 30);
assert.equal(metrics.planned, 32);
assert.equal(metrics.diff, -2);
assert.equal(syncedTasks.length, 283);
console.log(`PASS synchronized tasks=${syncedTasks.length}; planned=${metrics.planned}%; actual=${metrics.actual}%; variance=${metrics.diff}%`);

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
