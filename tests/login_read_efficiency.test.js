const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8');
function fixture(permission='TRUE', status='active') {
  const metrics={reads:0,writes:0,cacheReads:0};
  const headers=['username','temporary_password','status','can_view_completion_evidence','allowed_pages'];
  const values=[headers,['atheer','correct',status,permission,'overview,tasks']];
  const sheet={getLastRow:()=>values.length,getDataRange:()=>({getValues(){metrics.reads++;return values.map(r=>r.slice());}}),getRange:()=>({setValues(rows){metrics.writes++;values[1][3]=rows[0][0];}})};
  const context=vm.createContext({console,CacheService:{getScriptCache:()=>({get(){metrics.cacheReads++;throw Error('Login must bypass cache');},put(){},remove(){}})}});
  vm.runInContext(source,context);
  context.ensureRegisterSheet_=()=>sheet;
  return {context,metrics,values};
}
for(const permission of ['TRUE',true]){
  const f=fixture(permission);const user=f.context.authenticateUser_({username:'atheer',password:'correct'});
  assert.equal(user.username,'atheer');assert.equal(user.can_view_completion_evidence,true);
  assert.deepEqual(f.metrics,{reads:1,writes:0,cacheReads:0});
  assert.equal('temporary_password' in user,false);
}
{
  const f=fixture('FALSE');assert.equal(f.context.authenticateUser_({username:'atheer',password:'correct'}).can_view_completion_evidence,true);
  assert.deepEqual(f.metrics,{reads:1,writes:1,cacheReads:0});
  f.context.authenticateUser_({username:'atheer',password:'correct'});assert.equal(f.metrics.writes,1);
}
for(const [status,password] of [['active','wrong'],['disabled','correct']]){
  const f=fixture('TRUE',status);assert.throws(()=>f.context.authenticateUser_({username:'atheer',password}),/Invalid credentials/);
}
{
  const f=fixture();f.context.authenticateUser_({username:'atheer',password:'correct'});
  f.values[1][1]='changed';assert.throws(()=>f.context.authenticateUser_({username:'atheer',password:'correct'}),/Invalid credentials/);
  f.values[1][0]='other.user';f.values[1][1]='correct';
  assert.equal(f.context.authenticateUser_({username:'other.user',password:'correct'}).can_view_completion_evidence,false);
}
{
  const f=fixture();assert.throws(()=>f.context.authenticateUser_({username:'',password:''}),/Missing credentials/);assert.equal(f.metrics.reads,0);
}
console.log('Login efficiency/security checks passed: single fresh read, conditional writes, revoked credentials, inactive users, evidence policy.');
