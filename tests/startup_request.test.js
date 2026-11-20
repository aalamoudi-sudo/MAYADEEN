const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const helper = source.slice(source.indexOf('async function requestStartupJson'), source.indexOf('function sanitizeUserError'));
function harness() {
  const context = {AbortController, setTimeout, clearTimeout, performance, console:{info(){}}};
  vm.createContext(context);
  vm.runInContext(helper, context);
  return context.requestStartupJson;
}
test('startup returns parsed data', async () => {
  const result = await harness()(async () => ({status:200,json:async () => ({ok:true})}), 'home', 100);
  assert.equal(result.data.ok, true);
});
test('deadline includes stalled response body and aborts request', async () => {
  let aborted = false;
  await assert.rejects(harness()(async signal => {
    signal.addEventListener('abort', () => {aborted = true;});
    return {status:200,json:() => new Promise(() => {})};
  }, 'home', 10), /timeout/);
  assert.equal(aborted, true);
});
test('session requests only already prepared home data', () => {
  assert.match(source, /action:'auth_session',include_home:'cached'/);
  assert.doesNotMatch(source, /action:'auth_session',include_home:true/);
});
