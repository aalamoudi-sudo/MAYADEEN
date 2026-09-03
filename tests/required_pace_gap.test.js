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

const normalizeArabic = value => String(value || '').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[إأآٱا]/g, 'ا').replace(/ة/g, 'ه').trim().toLowerCase();
const date = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : '';
const addDaysToDateKey = (value, amount) => new Date(Date.parse(`${value}T00:00:00Z`) + amount * 86400000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
const valueOf = (row, names) => names.map(name => row?.[name]).find(value => value !== undefined && value !== null && value !== '') || '';
const getTaskProgress = task => Number(task.progress || 0);
const isTaskCompleted = task => task.status === 'مكتملة';
const getTaskActualEndDate = task => date(task.actualEnd);
const getFirstTaskField_ = (task, field) => task[field] || '';
const isTaskRecord_ = task => task.type === 'Task';
const isTaskCancelled = task => task.status === 'ملغاة';
const CURRENT_PACE_WINDOW_DAYS = 28;
const MIN_COMPLETION_DATES = 2;
const MIN_ACTUAL_END_COVERAGE = .5;
const escapeHtml = value => String(value);

const api = new Function('normalizeArabic','riyadhDateKey','valueOf','getTaskProgress','isTaskCompleted','getTaskActualEndDate','getFirstTaskField_','isTaskRecord_','isTaskCancelled','addDaysToDateKey','daysBetween','CURRENT_PACE_WINDOW_DAYS','MIN_COMPLETION_DATES','MIN_ACTUAL_END_COVERAGE','escapeHtml', `${declaration('isExecutiveTask_')}\n${declaration('getOpeningDateFromProjectMaster')}\n${declaration('getRequiredPaceGap')}\n${declaration('paceValue_')}\n${declaration('renderRequiredPaceGap')}\nreturn {getRequiredPaceGap,renderRequiredPaceGap,isExecutiveTask_};`)(normalizeArabic,date,valueOf,getTaskProgress,isTaskCompleted,getTaskActualEndDate,getFirstTaskField_,isTaskRecord_,isTaskCancelled,addDaysToDateKey,daysBetween,CURRENT_PACE_WINDOW_DAYS,MIN_COMPLETION_DATES,MIN_ACTUAL_END_COVERAGE,escapeHtml);

const today = '2026-09-02';
const master = opening_date => [{status:'نشط',opening_date}];
const open = (progress=0, extra={}) => ({type:'Task',status:'قيد التنفيذ',progress,...extra});
const done = actualEnd => ({type:'Task',status:'مكتملة',progress:100,actualEnd});
const recent = count => Array.from({length:count}, (_, i) => done(addDaysToDateKey(today,-i)));
const run = (items, opening='2026-09-09', masters=master(opening)) => api.getRequiredPaceGap(items,masters,today);

const approvedOpening = api.getRequiredPaceGap([...recent(2),open(50)], master('2026-11-01'), '2026-09-03');
assert.equal(approvedOpening.openingDate, '2026-11-01', 'approved Project Master opening date is parsed');
assert.equal(approvedOpening.remainingWeeks, 59/7, 'remaining weeks use the approved opening date');
assert.equal(approvedOpening.requiredPace, .5/(59/7), 'required pace uses the approved opening date');
assert.doesNotMatch(approvedOpening.reason, /تاريخ الافتتاح مفقود|انتهى موعد الافتتاح/, 'opening-date insufficiency is cleared');

assert.equal(run([...recent(8),open()]).status, 'sufficient', 'current pace above required');
assert.equal(run([...recent(4),open()]).currentPace, run([...recent(4),open()]).requiredPace, 'equal pace');
assert.equal(run([...recent(4),open()]).status,'sufficient','equal pace is sufficient');
assert.equal(run([...recent(2),open()]).status, 'raise', 'current pace below required');
const zero = run([done('2026-07-01'),done('2026-07-02'),open()]);
assert.equal(zero.currentPace, 0); assert.equal(zero.acceleration, null); assert.match(zero.reason,/ابدأ إغلاق/);
assert.equal(run([done(today),done(addDaysToDateKey(today,-1))]).remainingWork,0,'no remaining work');
assert.ok(run([...recent(2),open(.5)],'2026-09-05').requiredPace>1,'less than one week uses fractional weeks');
assert.equal(run([open()], '', []).status,'insufficient','missing opening date');
assert.match(run([open()], 'not-a-date').reason,/مفقود أو غير صالح/,'invalid opening date');
assert.match(run([open()], '2026-09-01').reason,/انتهى موعد/,'past opening date');
assert.match(run([open()], today).reason,/موعد الافتتاح اليوم/,'opening date today');
assert.equal(run([open()],undefined,[{status:'نشط',opening_date:'bad'},{status:'مسودة',opening_date:'2026-09-10'}]).openingDate,'2026-09-10','falls back from invalid active Project Master record');
assert.match(run([done(''),done(''),open()]).reason,/أقل من 2/,'missing actual_end');
assert.match(run([done(today),done(addDaysToDateKey(today,-1)),done(''),done(''),done(''),open()]).reason,/أقل من 50%/,'low actual_end coverage');
assert.equal(run([open(60)]).remainingWork,.4,'partial completion is equivalent work');
assert.equal(run([open(-20),open(150)]).remainingWork,1,'completion percentages are clamped');
const exclusions=run([open(0,{type:'Milestone'}),open(0,{taskType:'صف تجميعي'}),open(0,{status:'ملغاة'}),...recent(2),open(50)]);
assert.equal(exclusions.remainingWork,.5,'milestones, summary rows and cancelled tasks are excluded');
Object.values(run([...recent(2),open()],today)).forEach(value=>assert.ok(value!==Infinity&&!Number.isNaN(value),'no NaN or Infinity'));

const html=api.renderRequiredPaceGap(run([...recent(4),open()]));
assert.match(html,/مهمة مكافئة\/أسبوع/); assert.match(html,/ليس ساعات عمل/); assert.match(html,/عرض المهام التي يمكن تسريعها/);
const card=declaration('renderPhaseProgressSummary');
['المرحلة الحالية','التقدم الفعلي للمشروع','phase-progress-summary-track','phase-home-dots','عرض تفاصيل المراحل'].forEach(text=>assert.match(source,new RegExp(text)));
assert.match(card,/renderRequiredPaceGap/);
assert.match(declaration('showAccelerableTasks'),/showPage\('tasks'\).*taskAccelerationFilter=true/s);
assert.match(declaration('applyFilters'),/taskAccelerationFilter.*isExecutiveTask_.*isTaskCompleted/s);
assert.match(declaration('applyFilters'),/priorityRank|const rank=.*priority/s);

console.log('PASS required pace gap calculations, quality gates, exclusions, card continuity and accelerable-task navigation');
