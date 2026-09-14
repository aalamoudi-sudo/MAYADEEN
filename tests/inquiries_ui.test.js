const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const start=html.indexOf("let inquiryItems=[],inquiryBootstrap=null,inquiryScope='mine'");
const end=html.indexOf('\n\n</script>',start);
const source=html.slice(start,end);
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function uiHarness(){
  const drawer={classList:{active:false,add(){this.active=true;},contains(){return this.active;}}};
  const content={innerHTML:''};
  const document={visibilityState:'visible',activeElement:null,getElementById(id){if(id==='drawer')return drawer;if(id==='drawerContent')return content;return null;},querySelectorAll(){return [];}};
  const c={console,Map,Promise,Math,Date,String,Error,Array,setTimeout,clearTimeout,document,sessionToken:'token-a',currentUser:{username:'alpha'},authState:{phase:'AUTHENTICATED'},MayadeenAuth:{phases:{AUTHENTICATED:'AUTHENTICATED'}},
    crypto:{randomUUID:()=>`id-${Math.random()}`},wait:ms=>new Promise(r=>setTimeout(r,ms)),escapeHtml:s=>String(s),withTimeout:p=>p,postApi(){},getConfiguredApiUrl(){},sanitizeUserError:(e,f)=>f,isSessionExpiredError:()=>false,returnToLoginForExpiredSession(){},showPage(){},getActivePageId:()=>'',requestAnimationFrame:f=>f()};
  vm.createContext(c);vm.runInContext(source,c);return {c,drawer,content};
}

test('طلبات التفاصيل تتشارك الطلب نفسه ولا تسمح لـ A المتأخر باستبدال B',async()=>{
  const {c}=uiHarness(),a=deferred(),b=deferred(),calls=[];
  c.__pending={A:a,B:b};
  vm.runInContext(`inquiryReadWithRetry=(p)=>{callsForTest.push(p.inquiry_id);return pendingForTest[p.inquiry_id].promise};renderInquiryDetail=()=>{};markInquiryRead=async()=>{};`,vm.createContext?c:c);
  c.callsForTest=calls;c.pendingForTest=c.__pending;
  const p1=c.openInquiryDetail('A'),p2=c.openInquiryDetail('A');assert.deepEqual(calls,['A']);
  const p3=c.openInquiryDetail('B');b.resolve({inquiry:{inquiry_id:'B',read_cursor:{}}});await p3;
  a.resolve({inquiry:{inquiry_id:'A',read_cursor:{}}});await p1;
  assert.equal(vm.runInContext('inquiryCurrent.inquiry_id',c),'B');
});

test('تغيير الحساب أو إغلاق العرض يبطل استجابة التفاصيل القديمة',async()=>{
  const {c,drawer}=uiHarness(),d=deferred();c.pendingForTest={A:d};
  vm.runInContext(`inquiryReadWithRetry=(p)=>pendingForTest[p.inquiry_id].promise;renderInquiryDetail=()=>{};markInquiryRead=async()=>{};`,c);
  const p=c.openInquiryDetail('A');c.currentUser={username:'beta'};c.sessionToken='token-b';d.resolve({inquiry:{inquiry_id:'A',read_cursor:{}}});await p;
  assert.equal(vm.runInContext('inquiryCurrent',c),null);
  c.currentUser={username:'alpha'};c.sessionToken='token-a';const d2=deferred();c.pendingForTest.A=d2;
  const p2=c.openInquiryDetail('A');drawer.classList.active=false;c.closeInquiryViewState();d2.resolve({inquiry:{inquiry_id:'A',read_cursor:{}}});await p2;
  assert.equal(vm.runInContext('inquiryCurrent',c),null);
});

test('عقد الواجهة يحافظ على المسودة ومعرف الرد ويميز الأخطاء ويؤخر mark-read لما بعد العرض',()=>{
  assert.match(source,/const inquiryReplyDrafts=new Map/);
  assert.match(source,/request_id:d\.requestId/);
  assert.match(source,/d\.body=el\?\.value\|\|d\.body/);
  assert.match(source,/جارٍ الإرسال…/);
  assert.match(source,/inquiryKind==='timeout'/);
  assert.match(source,/renderInquiryDetail\(\);if\(!inquiryDetailValid[\s\S]*await markInquiryRead/);
  assert.doesNotMatch(source,/alert\(/);
});
