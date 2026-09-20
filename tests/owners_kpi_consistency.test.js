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
  declaration('normalizeOwnerIdentityText'),
  declaration('employeeOwnerIdentity'),
  declaration('ownerDirectory'),
  declaration('taskOwnerIdentities'),
  declaration('taskOwnerFilterValues'),
  declaration('isProjectOwnerName'),
  declaration('projectOwnerGroups'),
  declaration('taskMatchesOwnerFilter'),
].join('\n'), context);

const groups = (rows,employees=[]) => Array.from(context.projectOwnerGroups(rows,employees), ({key,name,label,count}) => ({key,name,label,count}));

assert.deepEqual(groups([
  {owner:'سارة', executionOwner:'سارة'},
  {owner:'سارة'},
]), [{key:'name:سارة',name:'سارة',label:'سارة',count:2}], 'one owner is counted once while retaining all linked tasks');

assert.deepEqual(groups([
  {owner:'أحمد', executionOwner:'فريق التنفيذ'},
  {owner:'', executionOwner:'غير محدد'},
  {owner:'احمد'},
  {owner:'ليلى', executionOwner:'   '},
]), [
  {key:'name:فريق التنفيذ',name:'فريق التنفيذ',label:'فريق التنفيذ',count:1},
  {key:'name:أحمد',name:'أحمد',label:'أحمد',count:1},
  {key:'name:احمد',name:'احمد',label:'احمد',count:1},
  {key:'name:ليلى',name:'ليلى',label:'ليلى',count:1},
], 'empty/unspecified owners are excluded without merging similar names');

assert.deepEqual(groups([]), [], 'a valid empty response produces no owners');

const before = groups([{owner:'سارة'}, {owner:'ليلى'}]);
const afterAdd = groups([{owner:'سارة'}, {owner:'ليلى'}, {owner:'هند'}]);
const afterRemove = groups([{owner:'هند'}]);
assert.equal(before.length, 2);
assert.equal(afterAdd.length, 3);
assert.equal(afterRemove.length, 1);

assert.equal(context.taskMatchesOwnerFilter({owner:'أحمد'}, 'أحمد', [{owner:'أحمد'}], []), true);
assert.equal(context.taskMatchesOwnerFilter({owner:'احمد'}, 'أحمد', [{owner:'أحمد'},{owner:'احمد'}], []), false, 'details navigation keeps similar names distinct');

const nadaRows=[
  {code:'N-1',owner:'ندى أبودوسة',ownerEmail:'nada@example.test'},
  {code:'N-2',owner:'\u200fندى\u00a0 أبودوسة  '},
  {code:'N-3',executionOwner:'ندى أبودوسة\u200b'},
  {code:'N-4',owner:'ندى ابودوسة',ownerEmail:'other@example.test'},
];
const nadaGroups=groups(nadaRows);
assert.equal(nadaGroups.filter(owner=>owner.name==='ندى أبودوسة').length,1,'hidden characters and excess spaces cannot duplicate Nada');
assert.equal(nadaGroups.find(owner=>owner.name==='ندى أبودوسة').count,3,'the single option retains every matching visible task');
assert.equal(nadaGroups.filter(owner=>owner.name==='ندى ابودوسة').length,1,'Arabic spelling variants remain distinct');
assert.deepEqual(nadaRows.filter(task=>context.taskMatchesOwnerFilter(task,'email:nada@example.test',nadaRows,[])).map(task=>task.code),['N-1','N-2','N-3']);

const homonyms=[
  {code:'H-1',owner:'محمد علي',ownerEmail:'first@example.test'},
  {code:'H-2',owner:'محمد علي',ownerEmail:'second@example.test'},
];
const homonymGroups=groups(homonyms);
assert.equal(homonymGroups.length,2,'different stable identities are never merged because names match');
assert.ok(homonymGroups.every(owner=>owner.label.includes('@example.test')),'same-name people receive an available discriminator');
assert.deepEqual(homonyms.filter(task=>context.taskMatchesOwnerFilter(task,'email:first@example.test',homonyms,[])).map(task=>task.code),['H-1']);

const kpiBody = declaration('renderKpis');
const ownersBody = declaration('renderOwnersPage');
assert.match(kpiBody, /const owners=projectOwnerGroups\(tasks\)/, 'the KPI uses the shared grouping source');
assert.match(ownersBody, /const owners=projectOwnerGroups\(tasks\)/, 'the details list uses the shared grouping source');
assert.match(kpiBody, /value:owners\.length/, 'the KPI counts the displayed owner groups');
assert.match(declaration('showOwnerTasks'), /showPage\('tasks'\).*filterOwner.*applyFilters\(\)/s, 'owner-card navigation remains connected');
assert.match(declaration('fillFilters'), /const previous=oSel\.value[\s\S]*some\(option=>option\.value===previous\)/, 'refresh preserves a still-valid owner selection');
assert.match(declaration('loadExternal'), /dashboardDataVersion\+\+;[\s\S]*initData\(\)/, 'successful synchronization refreshes the shared task state and render cycle');

console.log('PASS shared owner grouping, uniqueness, exclusions, refresh scenarios, and card navigation');
