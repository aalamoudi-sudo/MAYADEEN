(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.MayadeenAuth=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const STORAGE_KEY='mayadeen.auth.session.v1';
  const phases=Object.freeze({BOOTSTRAPPING:'bootstrapping',ANONYMOUS:'anonymous',CHECKING:'checking_permissions',AUTHENTICATED:'authenticated',ERROR:'error'});
  function initialState(){return {phase:phases.BOOTSTRAPPING,user:null,token:'',expiresAt:'',error:''};}
  function transition(state,event){
    const next=Object.assign({},state);
    if(event.type==='NO_SESSION'||event.type==='LOGOUT') return Object.assign(initialState(),{phase:phases.ANONYMOUS,error:event.error||''});
    if(event.type==='CHECK') return Object.assign(next,{phase:phases.CHECKING,error:''});
    if(event.type==='AUTHENTICATED'){
      if(!event.token||!event.user||!event.user.username) return Object.assign(initialState(),{phase:phases.ERROR,error:'استجابة التوثيق غير مكتملة.'});
      return {phase:phases.AUTHENTICATED,user:event.user,token:event.token,expiresAt:event.expiresAt||'',error:''};
    }
    if(event.type==='FAILURE') return Object.assign(initialState(),{phase:phases.ERROR,error:event.error||'تعذر التحقق من الجلسة.'});
    return next;
  }
  function isExpired(value,now){const time=Date.parse(value&&value.expiresAt||'');return !Number.isFinite(time)||time<=(now||Date.now());}
  function read(storage,now){
    try{const value=JSON.parse(storage.getItem(STORAGE_KEY)||'null');return value&&value.token&&value.user&&!isExpired(value,now)?value:null;}catch(e){return null;}
  }
  function write(storage,state){try{storage.setItem(STORAGE_KEY,JSON.stringify({token:state.token,user:state.user,expiresAt:state.expiresAt}));return true;}catch(e){return false;}}
  function clear(storage){try{storage.removeItem(STORAGE_KEY);}catch(e){}}
  return {STORAGE_KEY,phases,initialState,transition,isExpired,read,write,clear};
});
