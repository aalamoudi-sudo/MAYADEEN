const test=require('node:test');
const assert=require('node:assert/strict');
const Auth=require('../auth-state.js');

function storage(value){return {value,getItem(){return this.value||null;},setItem(k,v){this.value=v;},removeItem(){this.value='';}};}

test('anonymous bootstrap renders only login state',()=>assert.equal(Auth.transition(Auth.initialState(),{type:'NO_SESSION'}).phase,Auth.phases.ANONYMOUS));
test('login success becomes authenticated and cannot accept a missing token',()=>{
  const checking=Auth.transition(Auth.initialState(),{type:'CHECK'});
  assert.equal(checking.phase,Auth.phases.CHECKING);
  assert.equal(Auth.transition(checking,{type:'AUTHENTICATED',token:'t',user:{username:'u'}}).phase,Auth.phases.AUTHENTICATED);
  assert.equal(Auth.transition(checking,{type:'AUTHENTICATED',token:'',user:{username:'u'}}).phase,Auth.phases.ERROR);
});
test('permission failure has a terminal error instead of permanent checking',()=>{
  const failed=Auth.transition(Auth.transition(Auth.initialState(),{type:'CHECK'}),{type:'FAILURE',error:'تعذر التحقق'});
  assert.equal(failed.phase,Auth.phases.ERROR); assert.equal(failed.error,'تعذر التحقق');
});
test('valid refresh session is restored and expired session is rejected',()=>{
  const s=storage(JSON.stringify({token:'t',user:{username:'u'},expiresAt:'2030-01-01T00:00:00Z'}));
  assert.equal(Auth.read(s,Date.parse('2029-01-01')).token,JSON.parse(s.value).token);
  assert.equal(Auth.read(s,Date.parse('2031-01-01')),null);
});
test('logout and session expiry reset all authenticated data',()=>{
  const logged={phase:Auth.phases.AUTHENTICATED,token:'t',user:{username:'u'},expiresAt:'2030-01-01',error:''};
  assert.deepEqual(Auth.transition(logged,{type:'LOGOUT',error:'انتهت الجلسة'}),{phase:Auth.phases.ANONYMOUS,user:null,token:'',expiresAt:'',error:'انتهت الجلسة'});
});
test('blocked session storage does not break a successful authentication',()=>{
  const blocked={setItem(){throw new Error('SecurityError');}};
  assert.equal(Auth.write(blocked,{token:'t',user:{username:'u'},expiresAt:'2030-01-01'}),false);
});
