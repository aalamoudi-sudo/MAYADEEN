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

test('saved-session compatibility data_sync is reused and reads are single-flight',()=>{
  assert.match(html,/sessionBootstrapSyncData=fallback/);
  assert.match(html,/if\(initial&&sessionBootstrapSyncData\)/);
  assert.match(html,/if\(syncRequestInFlight\) return syncRequestInFlight/);
  assert.match(html,/if\(inquiryBootstrapInFlight\)return inquiryBootstrapInFlight/);
  assert.match(html,/if\(inquiryListInFlight\)return inquiryListInFlight/);
});

test('login and saved-session bootstrap do not preload inquiries',()=>{
  const login=html.slice(html.indexOf('async function login()'),html.indexOf('function loginOnEnter'));
  const bootstrap=html.slice(html.indexOf('async function bootstrapSession()'),html.indexOf('async function validatePersistedSession'));
  assert.doesNotMatch(login,/loadInquiryBootstrap\(\)/);
  assert.doesNotMatch(bootstrap,/loadInquiryBootstrap\(\)/);
});
