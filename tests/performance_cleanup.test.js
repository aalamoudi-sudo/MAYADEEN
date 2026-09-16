const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('index.html','utf8');

test('full data_sync has no recurring background timer',()=>{
  assert.doesNotMatch(html,/setInterval\([\s\S]{0,300}loadExternal\(false\)/);
  assert.match(html,/async function manualRefreshNow\(\)/);
  assert.match(html,/loadExternal\(true\)/);
});

test('inquiries load and poll only while the inquiries page is active',()=>{
  const showPage=html.slice(html.indexOf('function showPage(id)'),html.indexOf('function goToTasksFiltered'));
  assert.match(showPage,/if\(id==='inquiries'\)[\s\S]*loadInquiries\(\)[\s\S]*startInquiryPolling\(\)/);
  assert.match(showPage,/else\{\s*stopInquiryPolling\(false\)/);
  const polling=html.slice(html.indexOf('function startInquiryPolling'),html.indexOf('function stopInquiryPolling'));
  assert.match(polling,/if\(getActivePageId\(\)!=='inquiries'\)return/);
  assert.doesNotMatch(polling,/loadInquiryBootstrap/);
});

test('saved-session data_sync validates the session, feeds first paint, and stays single-flight',()=>{
  const validation=html.slice(html.indexOf('async function validatePersistedSession()'),html.indexOf('function returnToAnonymousLogin'));
  assert.equal((validation.match(/postApi\(baseUrl,\{action:'data_sync'\}\)/g)||[]).length,1);
  assert.doesNotMatch(validation,/postApi\(baseUrl,\{action:'auth_session'\}\)/);
  assert.match(validation,/sessionBootstrapSyncData=data/);
  assert.match(html,/if\(initial&&sessionBootstrapSyncData\)/);
  assert.match(html,/if\(syncRequestInFlight\) return syncRequestInFlight/);
  assert.match(html,/if\(inquiryBootstrapInFlight\)return inquiryBootstrapInFlight/);
  assert.match(html,/if\(inquiryListInFlight\.has\(key\)\)return inquiryListInFlight\.get\(key\)/);
});

test('login and saved-session bootstrap do not preload inquiries',()=>{
  const login=html.slice(html.indexOf('async function login()'),html.indexOf('function loginOnEnter'));
  const bootstrap=html.slice(html.indexOf('async function bootstrapSession()'),html.indexOf('async function validatePersistedSession'));
  assert.doesNotMatch(login,/loadInquiryBootstrap\(\)/);
  assert.doesNotMatch(bootstrap,/loadInquiryBootstrap\(\)/);
});

test('removed field experience center has no frontend payload or requests',()=>{
  assert.doesNotMatch(html,/مركز المواقع والتجربة والمحتوى|fieldExperienceCenter/);
  assert.doesNotMatch(html,/get_(?:event_sites|content_matrix|guest_journeys|assets_gifts)/);
  assert.doesNotMatch(html,/(?:leaflet|fes-|cm-|gj-|ag-)/i);
});

test('logo uses one inline payload and reuses it without a binary asset',()=>{
  assert.equal((html.match(/data:image\/png;base64/g)||[]).length,1);
  assert.doesNotMatch(html,/assets\/mayadeen-logo\.png/);
  assert.equal(fs.existsSync('assets/mayadeen-logo.png'),false);
  assert.match(html,/id="sidebarLogo"/);
  assert.match(html,/getElementById\('sidebarLogo'\)\.src=this\.src/);
});

test('dashboard sync exposes measured server and payload diagnostics',()=>{
  for(const file of ['apps-script/Code.gs','apps-script/current-apps-script.gs']){
    const code=fs.readFileSync(file,'utf8');
    assert.match(code,/spreadsheet_open_ms/);
    assert.match(code,/timedDashboardOperation_/);
    assert.match(code,/response_bytes = Utilities\.newBlob\(JSON\.stringify\(response\)\)/);
  }
  assert.match(html,/\[ApiTimeline\]/);
  assert.match(html,/\[DataSyncProfile\]/);
  assert.match(html,/event:'json_parsed'/);
  assert.match(html,/event:'state_updated'/);
  assert.match(html,/event:'data_painted'/);
});

test('server payload diagnostics serialize the large response only once before json output',()=>{
  for(const file of ['apps-script/Code.gs','apps-script/current-apps-script.gs']){
    const code=fs.readFileSync(file,'utf8');
    const sync=code.slice(code.indexOf('function buildDashboardData_'),code.indexOf('function canViewTaskEvidence_'));
    assert.equal((sync.match(/JSON\.stringify\(response\)/g)||[]).length,1);
  }
});

test('critical path is computed once and reused by workload during data_sync',()=>{
  for(const file of ['apps-script/Code.gs','apps-script/current-apps-script.gs']){
    const code=fs.readFileSync(file,'utf8');
    const sync=code.slice(code.indexOf('function buildDashboardData_'),code.indexOf('function timedDashboardOperation_'));
    assert.match(sync,/const criticalPath =[\s\S]*const workload =/);
    assert.match(sync,/buildEmployeeWorkload_\(spreadsheet, rows, employeeMaster, criticalPath\)/);
  }
});

test('canonical WBS reader limits format and display reads to progress column',()=>{
  const code=fs.readFileSync('apps-script/Code.gs','utf8');
  const reader=code.slice(code.indexOf('function readOfficialWbsTasks_'),code.indexOf('function normalizeArabicDigits_'));
  assert.doesNotMatch(reader,/dataRange\.getDisplayValues\(\)/);
  assert.doesNotMatch(reader,/dataRange\.getNumberFormats\(\)/);
  assert.match(reader,/sheet\.getRange\(1, progressColumn \+ 1, values\.length, 1\)/);
});
