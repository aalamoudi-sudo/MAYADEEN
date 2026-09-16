const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');

const backendSource = fs.readFileSync('apps-script/Code.gs', 'utf8');
const frontendSource = fs.readFileSync('index.html', 'utf8');
const context = { console, Utilities: {}, SpreadsheetApp: {}, Logger: { log() {} } };
vm.createContext(context);
vm.runInContext(backendSource, context);

const tasks = [
  { task_id: 'A-1', main_path: 'hospitality', owner: 'Owner A', owner_email: 'a@example.test' },
  { task_id: 'B-1', main_path: 'operations', owner: 'Owner B', owner_email: 'b@example.test' },
];
const datasets = {
  approvals: [
    { approval_id: 'APP-A', linked_wbs_code: 'A-1' },
    { approval_id: 'APP-B', linked_wbs_code: 'B-1' },
  ],
  escalations: [
    { escalation_id: 'ESC-A', item_id: 'A-1' },
    { escalation_id: 'ESC-B', item_id: 'B-1' },
  ],
  decisions: [
    { decision_id: 'DEC-A', linked_id: 'APP-A' },
    { decision_id: 'DEC-B', linked_id: 'APP-B' },
  ],
  risks: [{ risk_id: 'R-A', path: 'hospitality' }, { risk_id: 'R-B', path: 'operations' }],
};
const auth = context.buildPathAuthorizationContext_(tasks, datasets);
const managerA = { username: 'manager.a', access_level: 'workstream', path_scope: 'hospitality' };
const managerB = { username: 'manager.b', access_level: 'workstream', path_scope: 'operations' };

test('the four required immutable usernames retain full cross-path access', () => {
  for (const username of ['atheer', 'ahmad.amoudi', 'abdulaziz.obaid', 'abdullah.almarhoom']) {
    const session = { username, access_level: 'none', path_scope: 'unrelated' };
    assert.equal(context.hasFullAccess_(session), true, username);
    assert.deepEqual(Array.from(context.scopeRowsForSession_(tasks, session, auth), row => row.task_id), ['A-1', 'B-1']);
  }
});

test('different path users receive the same project-wide WBS visibility', () => {
  assert.deepEqual(Array.from(context.projectVisibleRows_(tasks), row => row.task_id), ['A-1', 'B-1']);
  assert.deepEqual(Array.from(context.projectVisibleRows_(tasks), row => row.task_id), ['A-1', 'B-1']);
});

test('approvals, escalations, decisions, and risks are project-wide on reads', () => {
  assert.deepEqual(Array.from(context.projectVisibleRows_(datasets.approvals), row => row.approval_id), ['APP-A', 'APP-B']);
  assert.deepEqual(Array.from(context.projectVisibleRows_(datasets.escalations), row => row.escalation_id), ['ESC-A', 'ESC-B']);
  assert.deepEqual(Array.from(context.projectVisibleRows_(datasets.decisions), row => row.decision_id), ['DEC-A', 'DEC-B']);
  assert.deepEqual(Array.from(context.projectVisibleRows_(datasets.risks), row => row.risk_id), ['R-A', 'R-B']);
});

test('records without a path remain visible but still fail closed for restricted writes', () => {
  const unresolved = [{ approval_id: 'NO-PATH' }];
  assert.equal(context.projectVisibleRows_(unresolved).length, 1);
  assert.throws(() => context.requireRecordPathAccess_(managerA, unresolved[0], auth), /outside the authenticated path scope/);
});

test('path manager cannot write, approve, or escalate a record from another path', () => {
  for (const record of [tasks[1], datasets.approvals[1], datasets.escalations[1]]) {
    assert.throws(
      () => context.requireRecordPathAccess_(managerA, record, auth),
      /outside the authenticated path scope/,
    );
  }
  assert.equal(context.requireRecordPathAccess_(managerA, datasets.approvals[0], auth), true);
});

test('data_sync is project-wide before payload and all derived datasets use all rows', () => {
  assert.match(backendSource, /const rows = projectVisibleRows_\(allRows\)/);
  for (const source of ['approvalsAll', 'riskGovernanceAll', 'decisionsAll', 'employeeMasterAll']) {
    assert.match(backendSource, new RegExp(`projectVisibleRows_\\(${source}\\)`), source);
  }
  assert.match(backendSource, /visibility_scope: 'project'/);
  assert.match(backendSource, /path_scope_applied: 'none'/);
  assert.match(backendSource, /buildBaselineManagement_\(spreadsheet, rows\)/);
  assert.match(backendSource, /buildCriticalPathAnalysis_\(spreadsheet, rows\)/);
  assert.match(backendSource, /buildDataQualityCenter_\(spreadsheet, rows, employeeMaster, criticalPath\)/);
});

test('UI and backend share the same full-user boundary and writes have server guards', () => {
  for (const username of ['atheer', 'ahmad.amoudi', 'abdulaziz.obaid', 'abdullah.almarhoom']) {
    assert.match(frontendSource, new RegExp(`['"]${username.replace('.', '\\.')}['"]`));
    assert.match(backendSource, new RegExp(`['"]${username.replace('.', '\\.')}['"]`));
  }
  assert.match(frontendSource, /return hasFullAccessUser\(\)\|\|pages\.includes\('\*'\)\|\|pages\.includes\(id\)/);
  for (const action of ['daily_update', 'approval_request', 'approval_update', 'task_assignment_confirm', 'meeting_record']) {
    const branch = backendSource.slice(backendSource.indexOf(`payload.action === '${action}'`), backendSource.indexOf(`payload.action === '${action}'`) + 700);
    assert.match(branch, /requirePayloadPathAccess_/, action);
  }
});

test('shared project pages expose global data without weakening write isolation', () => {
  assert.match(frontendSource, /SHARED_PROJECT_PAGE_IDS=\['overview','tasks','phases'\]/);
  assert.match(frontendSource, /SHARED_PROJECT_PAGE_IDS\.includes\(id\)/);
  assert.match(backendSource, /SHARED_PROJECT_PAGE_IDS = \['overview', 'tasks', 'phases'\]/);
  assert.match(backendSource, /SHARED_PROJECT_PAGE_IDS\.indexOf\(pageId\) !== -1/);
  assert.deepEqual(Array.from(context.projectVisibleRows_(tasks), row => row.task_id), ['A-1', 'B-1']);
  assert.throws(() => context.requireRecordPathAccess_(managerA, tasks[1], auth), /outside the authenticated path scope/);
});

test('read endpoints return global project rows while mutation guards remain', () => {
  assert.deepEqual(Array.from(context.scopeEndpointRows_(tasks, managerA), row => row.task_id), ['A-1', 'B-1']);
  for (const action of ['get_content_item_details', 'get_guest_journey_details', 'get_asset_gift_details']) {
    const start = backendSource.indexOf(`payload.action === '${action}'`);
    const branch = backendSource.slice(start, backendSource.indexOf("\n    if (payload.action ===", start + 1));
    assert.doesNotMatch(branch, /requirePayloadPathAccess_/);
  }
  assert.match(backendSource, /Mutation branches still call requirePayloadPathAccess_/);
});

test('paste-ready bundle is generated from the canonical core and inquiry module', () => {
  const bundle = fs.readFileSync('apps-script/current-apps-script.gs', 'utf8');
  const inquiries = fs.readFileSync('apps-script/Inquiries.gs', 'utf8');
  assert.equal(bundle, backendSource + '\n\n// Bundled inquiry module. Source: apps-script/Inquiries.gs\n' + inquiries);
});
