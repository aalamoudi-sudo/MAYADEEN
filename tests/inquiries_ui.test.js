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

test('القائمة والمحادثة تحدان حجم DOM ولا تعيدان تحميل القائمة بعد mark-read',()=>{
  assert.match(source,/INQUIRY_LIST_PAGE_SIZE=50/);
  assert.match(source,/visible=items\.slice/);
  assert.match(source,/message_limit:inquiryMessageLimit/);
  assert.match(source,/loadOlderInquiryMessages/);
  const markRead=source.slice(source.indexOf('async function markInquiryRead'),source.indexOf('function setInquiryNotice'));
  assert.doesNotMatch(markRead,/loadInquiries\(\)/);
  assert.match(source,/if\(getActivePageId\(\)!=='inquiries'\)return/);
  assert.match(source,/getActivePageId\(\)==='inquiries'.*loadInquiries\(true\)/);
  assert.doesNotMatch(source,/else loadInquiryBootstrap\(\)/);
  assert.match(source,/if\(inquiryBootstrapInFlight\)return inquiryBootstrapInFlight/);
  assert.match(source,/if\(inquiryListInFlight\.has\(key\)\)return inquiryListInFlight\.get\(key\)/);
});

test('فتح القائمة لا ينتظر bootstrap ويعيد استخدام snapshot حديث لكل مستخدم ونطاق',()=>{
  const load=source.slice(source.indexOf('async function loadInquiries'),source.indexOf('function openInquiryScope'));
  assert.doesNotMatch(load,/await loadInquiryBootstrap/);
  assert.match(load,/fresh&&!force/);
  assert.match(load,/inquiryListCache\.set\(key/);
  assert.match(source,/INQUIRY_LIST_CACHE_TTL_MS=45000/);
  assert.match(source,/loadInquiries\(true\)/);
  const scope=source.slice(source.indexOf('function openInquiryScope'),source.indexOf('function scheduleInquiryFilter'));
  assert.equal((scope.match(/loadInquiries\(/g)||[]).length,0,'showPage هو مسار التهيئة الوحيد');
});

test('snapshot مطابق من polling لا يعيد بناء DOM ولا يعيد pagination للصفحة الأولى',()=>{
  const {c}=uiHarness();
  vm.runInContext(`renderCountForTest=0;renderInquiryList=()=>{renderCountForTest++};updateInquirySummary=()=>{};inquiryListPage=3;`,c);
  const snapshot={items:[{inquiry_id:'A',title:'سؤال'}],summary:{needs_reply:0,new_replies:0},can_admin:false};
  assert.equal(c.applyInquiryListSnapshot(snapshot,'mine','alpha:mine'),true);
  vm.runInContext('inquiryListPage=3',c);
  assert.equal(c.applyInquiryListSnapshot(snapshot,'mine','alpha:mine'),false);
  assert.equal(vm.runInContext('renderCountForTest',c),1);
  assert.equal(vm.runInContext('inquiryListPage',c),3);
});

test('فتح محادثة الإدارة يستخدم users من عقد inquiry_detail بلا bootstrap',async()=>{
  const {c}=uiHarness();let bootstrapCalls=0,renderedOptions='';
  c.detailForTest={ok:true,inquiry:{inquiry_id:'A',can_admin:true,status:'جديد',read_cursor:null},users:[{username:'beta',display_name:'Beta',role:'viewer'}]};
  vm.runInContext(`inquiryReadWithRetry=async p=>{if(p.action==='inquiry_bootstrap')bootstrapCallsForTest++;return detailForTest};renderInquiryDetail=()=>{renderedOptionsForTest=inquiryRedirectOptions('')};markInquiryRead=async()=>{};`,c);
  c.bootstrapCallsForTest=bootstrapCalls;c.renderedOptionsForTest=renderedOptions;
  await c.openInquiryDetail('A');
  assert.equal(c.bootstrapCallsForTest,0);
  assert.match(c.renderedOptionsForTest,/value="beta"/);
  assert.equal(vm.runInContext('inquiryBootstrap',c),null);
});

test('استجابة API null أو عقد ناقص تسجل السبب وتتحول إلى خطأ قابل للعرض',async()=>{
  const {c}=uiHarness(),logged=[];c.console={...console,error:(...args)=>logged.push(args)};
  c.postApi=async()=>({ok:true,json:async()=>null});
  await assert.rejects(c.inquiryApi({action:'inquiry_detail'}),/Invalid server response contract/);
  c.postApi=async()=>({ok:true,json:async()=>({ok:true,inquiry:{inquiry_id:'A'}})});
  await assert.rejects(c.inquiryApi({action:'inquiry_detail'}),/Invalid server response contract/);
  assert.equal(logged.length,2);
  assert.match(String(logged[0][0]),/Null or invalid API response/);
  assert.match(String(logged[1][0]),/contract mismatch/);
});

function composerHarness(){
  const h=uiHarness(),elements={},modal={classList:{active:false,add(){this.active=true;},contains(){return this.active;}}};
  function element(extra={}){return Object.assign({value:'',disabled:false,textContent:'',innerHTML:'',dataset:{},focus(){this.focused=true;},addEventListener(type,fn){this[type]=fn;}},extra);}
  const content=element();
  Object.defineProperty(content,'innerHTML',{get(){return this._html||'';},set(value){this._html=value;Object.assign(elements,{iqComposer:element({dataset:{requestId:'stable-create-id'}}),iqTitle:element(),iqDetails:element(),iqRecipient:element({disabled:true}),iqTask:element({disabled:true}),iqPriority:element({value:'عادي'}),iqError:element(),iqSubmit:element({disabled:true})});}});
  h.c.document.getElementById=id=>id==='modal'?modal:id==='modalContent'?content:elements[id]||null;
  h.c.performance={mark(){},measure(){},now:()=>0};
  return {...h,modal,content,elements};
}

test('نافذة الإنشاء تظهر قبل اكتمال الشبكة والنقر المتكرر لا ينشئ طلبًا أو نموذجًا ثانيًا',async()=>{
  const h=composerHarness(),pending=deferred();let calls=0;
  h.c.pendingForTest=pending;
  vm.runInContext(`loadInquiryBootstrap=()=>{callsForTest++;return pendingForTest.promise}`,h.c);h.c.callsForTest=calls;
  h.c.openInquiryComposer();
  assert.equal(h.modal.classList.active,true);assert.match(h.content.innerHTML,/id="iqTitle"/);assert.equal(h.elements.iqSubmit.disabled,true);assert.equal(h.c.callsForTest,1);
  h.elements.iqTitle.value='نص أثناء التحميل';h.c.openInquiryComposer();
  assert.equal(h.c.callsForTest,1);assert.equal(h.elements.iqTitle.value,'نص أثناء التحميل');
  pending.resolve({ok:true,users:[{username:'beta',display_name:'Beta',role:'viewer'}],tasks:[],can_admin:false});await pending.promise;await new Promise(r=>setTimeout(r,0));
  assert.equal(h.elements.iqTitle.value,'نص أثناء التحميل');
});

test('إغلاق نافذة الإنشاء أثناء التحميل يمنع الاستجابة القديمة من إعادة فتحها أو تعديلها',async()=>{
  const h=composerHarness(),pending=deferred();h.c.pendingForTest=pending;
  vm.runInContext(`loadInquiryBootstrap=()=>pendingForTest.promise`,h.c);
  h.c.openInquiryComposer();h.elements.iqTitle.value='مسودة';h.modal.classList.active=false;h.c.closeInquiryComposerState();
  pending.resolve({ok:true,users:[],tasks:[],can_admin:false});await pending.promise;await new Promise(r=>setTimeout(r,0));
  assert.equal(h.modal.classList.active,false);assert.equal(h.elements.iqTitle.value,'مسودة');assert.equal(h.elements.iqRecipient.disabled,true);
});

test('فشل bootstrap ثم إعادة المحاولة داخل النموذج يحافظ على العنوان والتفاصيل',async()=>{
  const h=composerHarness(),failed=deferred(),retried=deferred();h.c.pendingForTest=failed;
  vm.runInContext(`loadInquiryBootstrap=()=>pendingForTest.promise`,h.c);
  h.c.openInquiryComposer();h.elements.iqTitle.value='عنوان محفوظ';h.elements.iqDetails.value='تفاصيل محفوظة';
  failed.reject(h.c.inquiryApiError('تعذر الاتصال','network',0,'inquiry_composer_bootstrap'));await new Promise(r=>setTimeout(r,0));
  assert.match(h.elements.iqError.innerHTML,/إعادة المحاولة/);
  h.c.pendingForTest=retried;h.c.retryInquiryComposer(vm.runInContext('inquiryComposerState.seq',h.c));
  retried.resolve({ok:true,users:[],tasks:[],can_admin:false});await retried.promise;await new Promise(r=>setTimeout(r,0));
  assert.equal(h.elements.iqTitle.value,'عنوان محفوظ');assert.equal(h.elements.iqDetails.value,'تفاصيل محفوظة');
});

test('البحث وفلاتر الحالة والأولوية والصفحات تعرض النتائج المطابقة سلوكيًا',()=>{
  const h=uiHarness(),list={innerHTML:'',scrollIntoView(){}},search={value:'مهم'},status={value:'جديد'},priority={value:'عاجل'};
  h.c.document.getElementById=id=>({inquiryList:list,inquirySearch:search,inquiryStatusFilter:status,inquiryPriorityFilter:priority}[id]||null);
  h.c.itemsForTest=[
    {inquiry_id:'1',title:'سؤال مهم',status:'جديد',priority:'عاجل',sender_name:'أ',recipient_name:'ب',updated_at:'2026-01-01'},
    {inquiry_id:'2',title:'سؤال آخر',status:'مغلق',priority:'عادي',sender_name:'أ',recipient_name:'ب',updated_at:'2026-01-01'}
  ];
  vm.runInContext('inquiryItems=itemsForTest;inquiryLoading=false;inquiryListFailure="";renderInquiryList()',h.c);
  assert.match(list.innerHTML,/سؤال مهم/);assert.doesNotMatch(list.innerHTML,/سؤال آخر/);
  search.value='لا يطابق';h.c.applyInquiryFilter();assert.match(list.innerHTML,/لا توجد استفسارات مطابقة/);
});

test('تبديل التبويبات يحدّث النطاق والحالة النشطة عبر مسار الصفحة الواحد',()=>{
  const h=uiHarness(),tabs=['mine','assigned','all'].map(scope=>({dataset:{scope},active:false,classList:{toggle(name,on){this.owner.active=on;},owner:null}}));tabs.forEach(t=>t.classList.owner=t);
  let shown='';h.c.document.querySelectorAll=()=>tabs;h.c.showPage=id=>{shown=id;};
  h.c.openInquiryScope('assigned');
  assert.equal(vm.runInContext('inquiryScope',h.c),'assigned');assert.equal(shown,'inquiries');assert.equal(tabs[1].active,true);assert.equal(tabs[0].active,false);
});

test('واجهة composer الجديدة تتوافق مع الخادم القديم فقط عند غياب الإجراء الجديد',async()=>{
  const h=uiHarness(),calls=[];h.c.responsesForTest={ok:true,users:[],tasks:[],can_admin:false,summary:{needs_reply:0,new_replies:0},notifications:[]};h.c.callsForTest=calls;
  vm.runInContext(`inquiryReadWithRetry=async p=>{callsForTest.push(p.action);if(p.action==='inquiry_composer_bootstrap')throw inquiryApiError('Unsupported inquiry action','server',0,p.action);return responsesForTest}`,h.c);
  const result=await h.c.loadInquiryBootstrap();
  assert.equal(result.ok,true);assert.deepEqual(calls,['inquiry_composer_bootstrap','inquiry_bootstrap']);
});
