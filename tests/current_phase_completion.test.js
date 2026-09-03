#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(new URL('../index.html', `file://${__filename}`), 'utf8');

function declaration(name) {
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

const renderDeclaration = declaration('renderCurrentPhaseCompletion');
const render = new Function('escapeHtml', `${renderDeclaration}; return renderCurrentPhaseCompletion;`)(String);
const stat = {phase:'التنفيذ',total:10,done:4,inprog:3,late:2,notStarted:1};
const html = render(stat, true);

assert.match(html, /إنجاز المرحلة الحالية/);
assert.match(html, /إجمالي المهام/);
assert.match(html, /المكتملة/);
assert.match(html, /قيد التنفيذ/);
assert.match(html, /المتأخرة/);
assert.match(html, /لم تبدأ/);
assert.match(html, /current-phase-completion-pct">40%/);
assert.match(html, /aria-valuenow="40"/);
assert.match(html, /width:40%/);
assert.match(html, /openPhaseTasks\("التنفيذ"\)/);
assert.match(html, /عرض مهام المرحلة/);

const empty = render({phase:'الإغلاق',total:0,done:0,inprog:0,late:0,notStarted:0}, true);
assert.match(empty, /لا توجد مهام مسجلة لهذه المرحلة/);
assert.doesNotMatch(empty, /current-phase-count/);
const failed = render(stat, false);
assert.match(failed, /تعذر مزامنة بيانات مهام المرحلة/);
assert.doesNotMatch(failed, /لا توجد مهام مسجلة/);

const statsBody = declaration('getProjectPhaseStats');
assert.match(statsBody, /isExecutiveTask_\(task\).*normalizeProjectPhase\(task\)/s, 'phase stats use shared milestone/summary/cancelled exclusion');
assert.match(statsBody, /classifyStatus\(task\)==='مكتملة'/);
assert.match(declaration('renderPhaseProgressSummary'), /renderCurrentPhaseCompletion\(current,officialDataReady\)/);
assert.match(declaration('openPhaseTasks'), /showPage\('tasks'\).*filterPhase.*value=phase.*applyFilters\(\)/s);
assert.doesNotMatch(source, /فجوة الوتيرة المطلوبة|عرض المهام التي يمكن تسريعها|renderRequiredPaceGap|getRequiredPaceGap|taskAccelerationFilter/);
assert.doesNotMatch(renderDeclaration, /opening_date|actual_end|critical|projectMaster/i);

console.log('PASS current-phase counts, completion percentage, empty/sync states, shared eligibility and phase-filter navigation');
