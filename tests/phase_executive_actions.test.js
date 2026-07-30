#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

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

const decision = new Function('stat', 'isCurrent', bodyOf('getPhaseDecision'));
const action = new Function('stat', 'isLastPhase', bodyOf('getPhaseRequiredAction'));
const renderBody = bodyOf('renderPhases');
const statsBody = bodyOf('getProjectPhaseStats');
const homeBody = bodyOf('renderPhaseProgressSummary');
const taskBody = bodyOf('renderTasks');
const timelineBody = bodyOf('renderTimeline');

assert.equal(decision({ total: 4, done: 0, inprog: 0, late: 0 }, false).label, 'لم تبدأ');
assert.equal(decision({ total: 4, done: 4, inprog: 0, late: 0 }, false).label, 'جاهزة للانتقال');
assert.equal(decision({ total: 4, done: 1, inprog: 1, late: 1 }, true).label, 'غير جاهزة للانتقال');
assert.equal(decision({ total: 4, done: 1, inprog: 2, late: 0, notStarted: 1 }, true).label, 'تحتاج متابعة');

assert.equal(action({ total: 5, done: 1, late: 2, inprog: 1, notStarted: 1 }, false), 'إغلاق 2 مهمة متأخرة');
assert.equal(action({ total: 5, done: 2, late: 0, inprog: 2, notStarted: 1 }, false), 'متابعة استكمال 2 مهمة قيد التنفيذ');
assert.equal(action({ total: 5, done: 2, late: 0, inprog: 0, notStarted: 3 }, false), 'بدء تنفيذ 3 مهمة');
assert.equal(action({ total: 5, done: 5, late: 0, inprog: 0, notStarted: 0 }, false), 'استكمال اعتماد الانتقال للمرحلة التالية');
assert.equal(action({ total: 5, done: 5, late: 0, inprog: 0, notStarted: 0 }, true), 'المرحلة مكتملة');

assert.match(renderBody, /قرار المرحلة/);
assert.match(renderBody, /الإجراء المطلوب الآن/);
assert.doesNotMatch(renderBody, /اتجاه الأداء/, 'Trend must remain hidden without a genuine historical snapshot');
assert.match(renderBody, /remainingTime\|\|'غير متوفر'/, 'Missing end dates must not receive an invented value');
assert.match(renderBody, /stat\.late>0\?\{label:'🔴 متأخرة'/, 'Red badge must require actual overdue tasks');

// Guardrails: phase calculations and other system page renderers remain untouched by this polish.
assert.doesNotMatch(statsBody, /getPhaseDecision|getPhaseRequiredAction|getPhaseRemainingTime/);
assert.doesNotMatch(homeBody, /getPhaseDecision|getPhaseRequiredAction|getPhaseRemainingTime|قرار المرحلة|الإجراء المطلوب الآن/);
assert.doesNotMatch(taskBody, /getPhaseDecision|getPhaseRequiredAction|getPhaseRemainingTime|قرار المرحلة|الإجراء المطلوب الآن/);
assert.doesNotMatch(timelineBody, /getPhaseDecision|getPhaseRequiredAction|getPhaseRemainingTime|قرار المرحلة|الإجراء المطلوب الآن/);

console.log('PASS phase decisions/actions are data-derived, trend is hidden, and calculation/page isolation guardrails hold');
