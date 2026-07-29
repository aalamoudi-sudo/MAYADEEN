const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const backend=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');

test('dashboard is hidden by default and only the authenticated reveal path can show it',()=>{
  assert.match(html,/\.app\{min-height:100vh;display:none!important\}/);
  assert.match(html,/if\(authState\.phase!==MayadeenAuth\.phases\.AUTHENTICATED\) throw new Error/);
});

test('login and permission-checking states stay centered in the full viewport',()=>{
  assert.match(html,/\.login\{\s*position:fixed;inset:0;z-index:100;\s*display:flex;align-items:center;justify-content:center;/);
  assert.match(html,/\.login-transition\{position:fixed;inset:0;z-index:130;display:grid;place-items:center;/);
});

test('authenticated reveal removes the full-screen login container',()=>{
  const reveal=html.slice(html.indexOf('function revealAuthenticatedApp()'),html.indexOf('async function bootstrapSession()'));
  assert.match(reveal,/document\.getElementById\('login'\)\.style\.cssText='display:none!important'/);
});

test('refresh validates the persisted session before revealing dashboard',()=>{
  const bootstrap=html.indexOf('async function bootstrapSession()');
  const validate=html.indexOf('await validatePersistedSession()',bootstrap);
  const reveal=html.indexOf('revealAuthenticatedApp(); setSyncLoadingState()',bootstrap);
  assert.ok(validate>0&&reveal>validate);
});

test('rolling deploy remains compatible before auth_session is published',()=>{
  assert.match(html,/if\(!\/Unsupported action\/i\.test\(message\)\) throw new Error/);
  assert.match(html,/postApi\(baseUrl,\{action:'data_sync'\}\)/);
  assert.match(html,/!fallback\.ok\|\|!fallback\.user/);
});

test('backend session bootstrap runs after requireSession and returns current permissions',()=>{
  const required=backend.indexOf('const session = requireSession_(payload)');
  const endpoint=backend.indexOf("payload.action === 'auth_session'",required);
  assert.ok(required>0&&endpoint>required);
  assert.match(backend.slice(endpoint,endpoint+180),/safeUser_\(session\)/);
});

test('expired session clears persistence and returns to login',()=>{
  assert.match(html,/function returnToLoginForExpiredSession\(\)[\s\S]*?MayadeenAuth\.clear\(sessionStorage\)/);
});
