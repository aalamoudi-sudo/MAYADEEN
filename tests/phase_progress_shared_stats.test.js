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

const normalizeBody = bodyOf('normalizeProjectPhase');
const statsBody = bodyOf('getProjectPhaseStats');
const renderBody = bodyOf('renderPhases');
const homeBody = bodyOf('renderPhaseProgressSummary');
const metricsBody = bodyOf('getScheduleProgressMetrics');
const plannedBody = bodyOf('plannedProgressPct');
const navigationBody = bodyOf('renderPageIfNeeded');

phases.forEach(phase => assert.match(source, new RegExp(`data-project-phase=\\"\\$\\{stat.phase\\}`), `${phase}: stage renderer missing`));
assert.match(source, /const PROJECT_PHASE_ORDER=\['البدء','التخطيط','التنفيذ','المراقبة والتحكم','الإغلاق'\]/);
assert.match(renderBody, /phaseStats\.map/);
assert.doesNotMatch(renderBody, /if\(!active\) return|offsetParent|getBoundingClientRect|canvas|Chart/);
assert.doesNotMatch(renderBody, /getScheduleProgressMetrics\(\)/);
assert.doesNotMatch(renderBody, /التقدم الفعلي العام/);
assert.doesNotMatch(renderBody, /التقدم المخطط العام/);
assert.doesNotMatch(renderBody, /الانحراف/);
assert.match(renderBody, /المرحلة الحالية/);
assert.match(renderBody, /phaseCards/);
assert.match(renderBody, /openPhaseTasks/);
assert.match(source, /id="phaseExecutiveSummary"/);
assert.match(renderBody, /عدد مراحل المشروع/);
assert.match(renderBody, /إنجاز المرحلة الحالية/);
assert.match(renderBody, /المرحلة التالية/);
assert.match(renderBody, /عرض تفاصيل المرحلة/);
assert.match(renderBody, /🟢 جاهزة للانتقال/);
assert.match(renderBody, /🟡 تحتاج متابعة/);
assert.match(renderBody, /🔴 يوجد ما يمنع الانتقال/);
assert.match(renderBody, /إجمالي المهام/);
assert.match(renderBody, /مكتملة/);
assert.match(renderBody, /قيد التنفيذ/);
assert.match(renderBody, /متأخرة/);
assert.match(renderBody, /لم تبدأ/);
assert.doesNotMatch(renderBody, /تاريخ البداية|تاريخ النهاية|آخر خمس مهام|أقرب ثلاث معالم|phase-card-details/);
assert.doesNotMatch(source, /id="phaseTasksBody"|class="card phase-tasks-card"/);
assert.doesNotMatch(source, /id="phaseRequirements"|id="phaseBlockers"|id="phaseEvents"/);
assert.doesNotMatch(source, /السجل الزمني للمرحلة|جاهزية الانتقال/);
assert.doesNotMatch(renderBody, /phase-stat-item|phase-donut|الجاهزية للانتقال|phaseDescriptions|phaseClosure/);
assert.match(navigationBody, /PAGE_RENDERERS\[id\]/);
assert.match(source, /phases:\['renderPhases'\]/, 'Menu navigation must render the stages page');
assert.doesNotMatch(source, /phaseTimelineDiagnostics|getProductionTimelineDiagnosticsHtml|temporary-production-timeline-debug/);

// One central normalizer accepts alternate fields, Arabic/English aliases, and conservative WBS fallback.
assert.match(normalizeBody, /TASK_FIELD_ALIASES/);
assert.match(normalizeBody, /task\.raw/);
assert.match(normalizeBody, /task\.code/);
assert.match(normalizeBody, /task\.mainPath/);
const normalizeArabic = value => String(value || '').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[إأآٱا]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().toLowerCase();
const PROJECT_PHASE_UNSPECIFIED = 'غير مصنفة';
const TASK_FIELD_ALIASES = { phase: ['المرحلة', 'مرحلة المشروع', 'phase', 'project_phase', 'stage'] };
const normalize = new Function('normalizeArabic', 'PROJECT_PHASE_UNSPECIFIED', 'TASK_FIELD_ALIASES', `return function normalizeProjectPhase(task){${normalizeBody}}`)(normalizeArabic, PROJECT_PHASE_UNSPECIFIED, TASK_FIELD_ALIASES);
assert.equal(normalize({ phase: 'Initiation' }), 'البدء');
assert.equal(normalize({ stage: 'Planning' }), 'التخطيط');
assert.equal(normalize({ project_phase: 'Execution' }), 'التنفيذ');
assert.equal(normalize({ المرحلة: 'المراقبة والتحكم' }), 'المراقبة والتحكم');
assert.equal(normalize({ raw: { 'مرحلة المشروع': 'Closure' } }), 'الإغلاق');
assert.equal(normalize({ code: 'WBS-Planning-12' }), 'التخطيط');
assert.equal(normalize({ code: 'WBS-12', mainPath: 'اللوجستيات' }), 'غير مصنفة');

// Production calculations remain unchanged and shared by home and phase page.
assert.match(metricsBody, /plannedProgressPct\(\)/);
assert.match(metricsBody, /classifyStatus\(t\)==='مكتملة'/);
assert.match(homeBody, /getScheduleProgressMetrics\(\)/);
assert.match(homeBody, /phaseStats\.map/);
assert.match(homeBody, /phase-home-dots/);
assert.doesNotMatch(homeBody, /canvas|Chart/);
const syncedTasks = Array.from({ length: 283 }, (_, index) => ({
  start_date: index === 0 ? '2026-06-01' : '2026-07-01',
  end_date: index === 282 ? '2026-11-30' : '2026-10-31',
  status: index < 85 ? 'مكتملة' : 'قيد التنفيذ'
}));
const d = value => value ? new Date(`${value}T00:00:00Z`) : null;
const TODAY = new Date('2026-07-29T00:00:00Z');
const runMetrics = new Function('tasks','d','getTaskPlannedStartDate','getTaskPlannedEndDate','classifyStatus','TODAY', `function plannedProgressPct(){${plannedBody}} function getScheduleProgressMetrics(){${metricsBody}} return getScheduleProgressMetrics();`);
const metrics = runMetrics(syncedTasks, d, t=>t.start_date, t=>t.end_date, t=>t.status, TODAY);
assert.deepEqual({actual:metrics.actual,planned:metrics.planned,diff:metrics.diff},{actual:30,planned:32,diff:-2});
assert.match(statsBody, /normalizeProjectPhase\(task\)/);
console.log('PASS five stages always render on load/navigation; aliases, unclassified tasks, home summary, and shared schedule metrics verified');
