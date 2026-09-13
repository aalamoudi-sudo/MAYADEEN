#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

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

const context = {};
vm.runInNewContext([
  declaration('normalizeArabic'),
  declaration('taskOwnerFilterValues'),
  declaration('isProjectOwnerName'),
  declaration('projectOwnerGroups'),
  declaration('taskMatchesOwnerFilter'),
].join('\n'), context);

const groups = rows => Array.from(context.projectOwnerGroups(rows), item => ({...item}));

assert.deepEqual(groups([
  {owner:'سارة', executionOwner:'سارة'},
  {owner:'سارة'},
]), [{name:'سارة', count:2}], 'one owner is counted once while retaining all linked tasks');

assert.deepEqual(groups([
  {owner:'أحمد', executionOwner:'فريق التنفيذ'},
  {owner:'', executionOwner:'غير محدد'},
  {owner:'احمد'},
  {owner:'ليلى', executionOwner:'   '},
]), [
  {name:'فريق التنفيذ', count:1},
  {name:'أحمد', count:1},
  {name:'احمد', count:1},
  {name:'ليلى', count:1},
], 'empty/unspecified owners are excluded without merging similar names');

assert.deepEqual(groups([]), [], 'a valid empty response produces no owners');

const before = groups([{owner:'سارة'}, {owner:'ليلى'}]);
const afterAdd = groups([{owner:'سارة'}, {owner:'ليلى'}, {owner:'هند'}]);
const afterRemove = groups([{owner:'هند'}]);
assert.equal(before.length, 2);
assert.equal(afterAdd.length, 3);
assert.equal(afterRemove.length, 1);

assert.equal(context.taskMatchesOwnerFilter({owner:'أحمد'}, 'أحمد'), true);
assert.equal(context.taskMatchesOwnerFilter({owner:'احمد'}, 'أحمد'), false, 'details navigation keeps similar names distinct');

const kpiBody = declaration('renderKpis');
const ownersBody = declaration('renderOwnersPage');
assert.match(kpiBody, /const owners=projectOwnerGroups\(tasks\)/, 'the KPI uses the shared grouping source');
assert.match(ownersBody, /const owners=projectOwnerGroups\(tasks\)/, 'the details list uses the shared grouping source');
assert.match(kpiBody, /value:owners\.length/, 'the KPI counts the displayed owner groups');
assert.match(declaration('showOwnerTasks'), /showPage\('tasks'\).*filterOwner.*applyFilters\(\)/s, 'owner-card navigation remains connected');
assert.match(declaration('loadExternal'), /dashboardDataVersion\+\+;[\s\S]*initData\(\)/, 'successful synchronization refreshes the shared task state and render cycle');

console.log('PASS shared owner grouping, uniqueness, exclusions, refresh scenarios, and card navigation');
