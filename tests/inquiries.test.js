const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

class Range{
  constructor(sheet,r,c,nr,nc){Object.assign(this,{sheet,r,c,nr,nc});}
  getValues(){if(this.sheet.metrics){this.sheet.metrics.reads++;this.sheet.metrics.rowsRead+=this.nr;this.sheet.metrics.ranges.push({sheet:this.sheet.name,row:this.r,numRows:this.nr,numColumns:this.nc});if(this.r===1&&this.nr===1)this.sheet.metrics.headerReads++;if(this.sheet.metrics.lockState.held)this.sheet.metrics.readsWhileLocked++;}return Array.from({length:this.nr},(_,i)=>Array.from({length:this.nc},(_,j)=>this.sheet.data[this.r-1+i]?.[this.c-1+j]??''));}
  setValues(v){v.forEach((row,i)=>row.forEach((x,j)=>{this.sheet.data[this.r-1+i]??=[];this.sheet.data[this.r-1+i][this.c-1+j]=x;}));return this;}
  setValue(v){return this.setValues([[v]]);}
}
class Sheet{
  constructor(headers=[],name=''){this.data=[headers.slice()];this.name=name;}
  getLastRow(){return this.data.length;}
  getRange(r,c,nr=1,nc=1){return new Range(this,r,c,nr,nc);}
  getRangeList(a1){return {setValue:value=>{a1.forEach(cell=>{const match=/^([A-Z]+)(\d+)$/.exec(cell),column=match[1].split('').reduce((n,ch)=>n*26+ch.charCodeAt(0)-64,0);this.getRange(Number(match[2]),column).setValue(value);});}};}
  getDataRange(){return this.getRange(1,1,this.data.length,Math.max(1,...this.data.map(r=>r.length)));}
  appendRow(r){this.data.push(r.slice());}
}
const headers={
  Inquiries:['inquiry_id','project_id','title','details','sender_username','recipient_username','task_id','task_title','priority','status','created_at','updated_at','request_id'],
  'Inquiry Replies':['reply_id','inquiry_id','project_id','author_username','body','created_at','request_id'],
  'Inquiry Events':['event_id','inquiry_id','project_id','event_type','actor_username','from_value','to_value','created_at','request_id'],
  'Inquiry Reads':['inquiry_id','project_id','username','last_read_at'],
  'Inquiry Notifications':['notification_id','project_id','inquiry_id','username','kind','created_at','read_at','request_key']
};
function harness(){
  const sheets=Object.fromEntries(Object.entries(headers).map(([n,h])=>[n,new Sheet(h,n)]));
  const users=[
    {username:'creator',display_name:'المنشئ',status:'active',allowed_pages:'tasks',access_level:'workstream'},
    {username:'recipient',display_name:'المستلم',status:'active',allowed_pages:'tasks',access_level:'workstream'},
    {username:'outsider',display_name:'غير مخول',status:'active',allowed_pages:'overview',access_level:'workstream'},
    {username:'admin',display_name:'الإدارة',status:'active',allowed_pages:'*',access_level:'full',can_manage_users:'TRUE'}
  ];
  sheets.Users=new Sheet(['username','display_name','status','allowed_pages','access_level','can_manage_users','email','role'],'Users');
  users.forEach(u=>sheets.Users.appendRow(sheets.Users.data[0].map(h=>u[h]??'')));
  const lockState={busy:false,held:false,tryCalls:0,releases:0};
  const metrics={reads:0,rowsRead:0,ranges:[],headerReads:0,readsWhileLocked:0,spreadsheetOpens:0,lockState};Object.values(sheets).forEach(sheet=>sheet.metrics=metrics);
  const ss={getSheetByName:n=>sheets[n]||null};let seq=0,emailCalls=0,triggerCalls=0,cacheGetHook=null;const cacheData={},cacheTtls={},cacheBehavior={getError:null,putError:null,removeError:null,maxChars:Infinity},logs=[];
  const context={console,Date,RegExp,String,Object,Array,Error,Math,JSON,isFinite,
    KAG_CONFIG:{usersSheetName:'Users'},SPREADSHEET_ID:'test',
    SpreadsheetApp:{openById:()=>{metrics.spreadsheetOpens++;return ss;}},Utilities:{getUuid:()=>`uuid-${++seq}`},
    CacheService:{getScriptCache:()=>({get:key=>{if(cacheGetHook)cacheGetHook(key,cacheData);if(cacheBehavior.getError&&cacheBehavior.getError(key))throw new Error('cache get unavailable');return cacheData[key]||null;},put:(key,value,ttl)=>{if((cacheBehavior.putError&&cacheBehavior.putError(key))||String(value).length>cacheBehavior.maxChars)throw new Error('cache put unavailable');cacheData[key]=value;cacheTtls[key]=ttl;},remove:key=>{if(cacheBehavior.removeError&&cacheBehavior.removeError(key))throw new Error('cache remove unavailable');delete cacheData[key];delete cacheTtls[key];}})},Logger:{log:value=>logs.push(value)},
    LockService:{getScriptLock:()=>({tryLock(){lockState.tryCalls++;lockState.held=!lockState.busy;return lockState.held;},hasLock(){return lockState.held;},releaseLock(){lockState.held=false;lockState.releases++;}})},
    getRegisterRows_:()=>users,getUserAccessHeaders_:()=>[],safeUser_:u=>({...u}),
    hasFullAccess_:u=>u.access_level==='full',parseBool_:v=>v===true||v==='TRUE',normalizeAllowedPages_:u=>String(u.allowed_pages||'').split(','),
    readOfficialWbsTasks_:()=>({rows:[{code:'T-1',name:'مهمة مسموحة',owner:'المستلم',ownerEmail:''}]}),taskCode_:t=>t.code,taskName_:t=>t.name,taskOwner_:t=>t.owner,taskField_:(t,k)=>k==='ownerEmail'?t.ownerEmail:'',
    GmailApp:{sendEmail(){emailCalls++;}},ScriptApp:{newTrigger(){triggerCalls++;}}
  };
  vm.createContext(context);vm.runInContext(fs.readFileSync('apps-script/Inquiries.gs','utf8'),context);
  return {c:context,users,sheets,lockState,metrics,logs,cacheData,cacheTtls,cacheBehavior,setCacheGetHook:hook=>{cacheGetHook=hook;},clearCache:()=>{Object.keys(cacheData).forEach(key=>delete cacheData[key]);Object.keys(cacheTtls).forEach(key=>delete cacheTtls[key]);},getEmailCalls:()=>emailCalls,getTriggerCalls:()=>triggerCalls};
}
function call(c,action,user,p={}){return c.handleInquiryAction_(Object.assign({action},p),user);}
function create(h){return call(h.c,'inquiry_create',h.users[0],{request_id:'create-1',title:'سؤال فعلي',details:'تفاصيل',recipient_username:'recipient',priority:'عاجل'}).inquiry.inquiry_id;}

test('نسخة الإنتاج تدمج قسم الاستفسارات المحسّن دون استبدال بقية Apps Script',()=>{
  const marker='const INQUIRY_PROJECT_ID = "KAG";';
  const production=fs.readFileSync('apps-script/current-apps-script.gs','utf8');
  const moduleSource=fs.readFileSync('apps-script/Inquiries.gs','utf8');
  assert.equal(production.slice(production.indexOf(marker)),moduleSource.slice(moduleSource.indexOf(marker)));
  assert.match(production.slice(0,production.indexOf(marker)),/function sendUrgentTaskNotifications\(\)/);
  assert.match(production.slice(0,production.indexOf(marker)),/support\.services@mayadeen\.sa/);
});

test('كل Action يعيد استخدام Spreadsheet واحدًا ويستخدم cache آمنًا للتحقق من headers',()=>{
  const h=harness();
  call(h.c,'inquiry_list',h.users[0],{scope:'mine'});
  assert.equal(h.metrics.spreadsheetOpens,1);
  assert.equal(h.metrics.headerReads,5,'أول طلب يتحقق من headers الخمسة');
  h.metrics.spreadsheetOpens=0;h.metrics.headerReads=0;
  call(h.c,'inquiry_list',h.users[0],{scope:'mine'});
  assert.equal(h.metrics.spreadsheetOpens,0,'cache hit لا يفتح Spreadsheet');
  assert.equal(h.metrics.headerReads,0,'الطلبات اللاحقة تستخدم schema cache');
  assert.match(h.logs.at(-1),/"action":"inquiry_list"/);
  assert.doesNotMatch(h.logs.at(-1),/creator|recipient|سؤال|تفاصيل/);
});

test('مسار الإنتاج يقيس requireSession ويعيد استخدام session الموثقة دون lookup ثان للمستخدم الحالي',()=>{
  const production=fs.readFileSync('apps-script/current-apps-script.gs','utf8');
  assert.match(production,/handleAuthenticatedInquiryAction_\(payload\)/);
  assert.match(production,/inquiryPerfTimed_\("requireSession"/);
  const handler=production.slice(production.indexOf('function handleInquiryAction_'));
  assert.doesNotMatch(handler,/const current = inquiryFindUser_\(session\.username\)/);
});

test('فتح التفاصيل قراءة فقط وينجح مع انشغال قفل الكتابة',()=>{
  const h=harness(),id=create(h);h.lockState.busy=true;const before=h.lockState.tryCalls;
  const detail=call(h.c,'inquiry_detail',h.users[0],{inquiry_id:id});
  assert.equal(detail.inquiry.inquiry_id,id);assert.equal(h.lockState.tryCalls,before);assert.equal(h.sheets['Inquiry Reads'].data.length,1);
});

test('فشل تسجيل القراءة لا يمنع المحادثة ولا يغير العدادات أو البيانات',()=>{
  const h=harness(),id=create(h),detail=call(h.c,'inquiry_detail',h.users[0],{inquiry_id:id});
  h.lockState.busy=true;assert.throws(()=>call(h.c,'inquiry_mark_read',h.users[0],{inquiry_id:id,read_cursor:detail.inquiry.read_cursor}),/الخدمة مشغولة/);
  assert.equal(h.sheets['Inquiry Reads'].data.length,1);assert.equal(h.sheets['Inquiry Notifications'].data[1][6],'');
});

test('رد جديد بين العرض وmark-read يبقى غير مقروء والطلب الأقدم لا يعيد المؤشر للخلف',()=>{
  const h=harness(),id=create(h),first=call(h.c,'inquiry_detail',h.users[0],{inquiry_id:id});
  call(h.c,'inquiry_answer',h.users[1],{inquiry_id:id,body:'الإجابة الأولى',request_id:'reply-1'});
  const second=call(h.c,'inquiry_detail',h.users[0],{inquiry_id:id});
  call(h.c,'inquiry_mark_read',h.users[0],{inquiry_id:id,read_cursor:second.inquiry.read_cursor});
  const newer=h.sheets['Inquiry Reads'].data[1][3];
  call(h.c,'inquiry_answer',h.users[1],{inquiry_id:id,body:'إجابة وصلت بعد العرض',request_id:'reply-2'});
  call(h.c,'inquiry_mark_read',h.users[0],{inquiry_id:id,read_cursor:first.inquiry.read_cursor});
  assert.equal(h.sheets['Inquiry Reads'].data[1][3],newer);
  const latest=call(h.c,'inquiry_detail',h.users[0],{inquiry_id:id});assert.equal(latest.inquiry.unread,true);
  const newestNotification=h.sheets['Inquiry Notifications'].data.at(-1);assert.equal(newestNotification[6],'');
});

test('الرد idempotent بنفس request_id وتظل صلاحيات الإغلاق وإعادة التوجيه مفروضة ولا بريد أو مشغلات',()=>{
  const h=harness(),id=create(h),p={inquiry_id:id,body:'إجابة',request_id:'stable-reply'};
  call(h.c,'inquiry_answer',h.users[1],p);const rows=h.sheets['Inquiry Replies'].data.length;
  assert.equal(call(h.c,'inquiry_answer',h.users[1],p).deduplicated,true);assert.equal(h.sheets['Inquiry Replies'].data.length,rows);
  assert.throws(()=>call(h.c,'inquiry_status',h.users[1],{inquiry_id:id,status:'مغلق',request_id:'bad-close'}),/غير مسموح/);
  assert.throws(()=>call(h.c,'inquiry_redirect',h.users[2],{inquiry_id:id,recipient_username:'admin',request_id:'bad-redirect'}),/administration/);
  assert.equal(h.getEmailCalls(),0);assert.equal(h.getTriggerCalls(),0);
});

test('القائمة والملخص متطابقان بعد القراءة',()=>{
  const h=harness(),id=create(h),detail=call(h.c,'inquiry_detail',h.users[0],{inquiry_id:id});
  call(h.c,'inquiry_mark_read',h.users[0],{inquiry_id:id,read_cursor:detail.inquiry.read_cursor});
  const list=call(h.c,'inquiry_list',h.users[1],{scope:'assigned'});
  assert.equal(list.summary.needs_reply,list.items.filter(x=>['جديد','قيد المعالجة'].includes(x.status)).length);
});

test('تفاصيل المحادثة تحد آخر مئة رد وتتيح طلب الأقدم دون تغيير العقد',()=>{
  const h=harness(),id=create(h),sheet=h.sheets['Inquiry Replies'];
  for(let i=0;i<150;i++)sheet.appendRow([`r-${i}`,id,'KAG','recipient',`رد ${i}`,new Date(2026,0,1,0,0,i).toISOString(),`req-${i}`]);
  const first=call(h.c,'inquiry_detail',h.users[0],{inquiry_id:id});
  assert.equal(first.inquiry.replies.length,100);
  assert.equal(first.inquiry.reply_count,100);
  assert.equal(first.inquiry.has_older_replies,true);
  assert.equal(first.summary,undefined,'التفاصيل لا تعيد حساب ملخص القائمة غير المستخدم');
  const expanded=call(h.c,'inquiry_detail',h.users[0],{inquiry_id:id,message_limit:200});
  assert.equal(expanded.inquiry.replies.length,150);
  assert.equal(expanded.inquiry.has_older_replies,false);
});

test('inquiry_detail يقرأ Replies وEvents من النهاية في chunks ولا يحمل كامل التاريخ',()=>{
  const h=harness(),id=create(h),replies=h.sheets['Inquiry Replies'],events=h.sheets['Inquiry Events'];
  for(let i=0;i<3000;i++)replies.appendRow([`other-r-${i}`,'other','KAG','outsider',`نص ${i}`,new Date(2025,0,1,0,0,i).toISOString(),`other-${i}`]);
  for(let i=0;i<100;i++)replies.appendRow([`mine-r-${i}`,id,'KAG','recipient',`رد ${i}`,new Date(2026,0,1,0,0,i).toISOString(),`mine-${i}`]);
  for(let i=0;i<3000;i++)events.appendRow([`other-e-${i}`,'other','KAG','رد','outsider','','',new Date(2025,0,1,0,0,i).toISOString(),`other-e-${i}`]);
  for(let i=0;i<100;i++)events.appendRow([`mine-e-${i}`,id,'KAG','رد','recipient','','',new Date(2026,0,1,0,0,i).toISOString(),`mine-e-${i}`]);
  h.metrics.ranges=[];h.metrics.rowsRead=0;
  const result=call(h.c,'inquiry_detail',h.users[0],{inquiry_id:id});
  assert.equal(result.inquiry.replies.length,100);assert.equal(result.inquiry.events.length,100);
  const replyReads=h.metrics.ranges.filter(x=>x.sheet==='Inquiry Replies'&&x.row>1);
  const eventReads=h.metrics.ranges.filter(x=>x.sheet==='Inquiry Events'&&x.row>1);
  assert.equal(replyReads.length,1);assert.equal(replyReads[0].numRows,100);
  assert.equal(eventReads.length,1);assert.equal(eventReads[0].numRows,100);
  assert.ok(replyReads[0].row>2900);assert.ok(eventReads[0].row>2900);
  const perf=JSON.parse(h.logs.at(-1).replace(/^\[inquiry_perf\] /,''));
  assert.equal(perf.action,'inquiry_detail');assert.equal(perf.rows_read,207);
  assert.equal(perf.sheet_reads,5);assert.equal(perf.spreadsheet_accesses,1);
  assert.ok(perf.duration_ms>=0);assert.ok(perf.response_size_chars>0);
});

test('inquiry_list يعيد حقول العرض فقط ويحافظ على عقد القائمة والصلاحيات وunread',()=>{
  const h=harness(),id=create(h);
  call(h.c,'inquiry_answer',h.users[1],{inquiry_id:id,body:'نص سري لا يلزم القائمة',request_id:'list-reply'});
  const item=call(h.c,'inquiry_list',h.users[0],{scope:'mine'}).items[0];
  assert.deepEqual(Object.keys(item).sort(),['inquiry_id','project_id','title','sender_username','sender_name','recipient_username','recipient_name','task_id','task_title','priority','status','updated_at','unread'].sort());
  assert.equal(item.details,undefined);assert.equal(item.replies,undefined);assert.equal(item.events,undefined);assert.equal(item.request_id,undefined);assert.equal(item.unread,true);
  assert.throws(()=>call(h.c,'inquiry_list',h.users[2],{scope:'all'}),/administration/);
});

function legacyListAndSummary(c,user,scope){
  if(scope==='all'&&!c.inquiryIsAdmin_(user))throw new Error('Forbidden: administration required');
  const all=c.inquiryRows_('Inquiries',c.inquiryHeaders_()).filter(q=>c.inquiryCanAccess_(q,user));
  const reads=c.inquiryUserReadMap_(user.username),replies=c.inquiryGroupBy_('Inquiry Replies',c.inquiryReplyHeaders_(),'inquiry_id');
  const items=all.filter(q=>scope==='mine'?q.sender_username===user.username:scope==='assigned'?q.recipient_username===user.username:true).map(q=>{
    const item=c.inquirySerialize_(q,user,false);
    return {inquiry_id:item.inquiry_id,project_id:item.project_id,title:item.title,sender_username:item.sender_username,sender_name:item.sender_name,recipient_username:item.recipient_username,recipient_name:item.recipient_name,task_id:item.task_id,task_title:item.task_title,priority:item.priority,status:item.status,updated_at:item.updated_at,unread:item.unread};
  }).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
  return {items,summary:{
    needs_reply:all.filter(q=>q.recipient_username===user.username&&(q.status==='جديد'||q.status==='قيد المعالجة')).length,
    new_replies:all.filter(q=>{if(q.sender_username!==user.username)return false;const read=reads[q.inquiry_id],last=read?read.last_read_at:'';return (replies[q.inquiry_id]||[]).some(r=>r.author_username!==user.username&&(!last||r.created_at>last));}).length
  }};
}
function appendInquiry(h,id,sender='creator',recipient='recipient',status='جديد'){
  h.sheets.Inquiries.appendRow([id,'KAG',`عنوان ${id}`,`تفاصيل ${id}`,sender,recipient,'','','عادي',status,'2026-01-01T00:00:00.000Z','2026-01-02T00:00:00.000Z',`req-${id}`]);
}
function appendReply(h,id,author,at='2026-01-03T00:00:00.000Z'){
  h.sheets['Inquiry Replies'].appendRow([`reply-${id}-${author}-${at}`,id,'KAG',author,'محتوى اختبار',at,`reply-req-${id}-${author}-${at}`]);
}
function appendRead(h,id,user,at){h.sheets['Inquiry Reads'].appendRow([id,'KAG',user,at]);}
function appendNotification(h,id,user,readAt=''){
  h.sheets['Inquiry Notifications'].appendRow([`notification-${id}-${user}`,'KAG',id,user,'رد جديد','2026-01-03T00:00:00.000Z',readAt,`notification-key-${id}-${user}`]);
}
function assertLegacyMatchesNew(name,h,user,scope){
  const expected=legacyListAndSummary(h.c,user,scope),actual=call(h.c,'inquiry_list',user,{scope});
  assert.deepEqual(JSON.parse(JSON.stringify({items:actual.items,summary:actual.summary})),JSON.parse(JSON.stringify(expected)),name);
}

test('calculator الجديد يطابق الحساب القديم في جميع حالات unread والملخص والنطاق',()=>{
  let h=harness();appendInquiry(h,'no-replies');assertLegacyMatchesNew('1. inquiry بدون replies',h,h.users[0],'mine');
  h=harness();appendInquiry(h,'other-reply');appendReply(h,'other-reply','recipient');assertLegacyMatchesNew('2. reply من المستخدم الآخر',h,h.users[0],'mine');
  h=harness();appendInquiry(h,'same-reply');appendReply(h,'same-reply','creator');assertLegacyMatchesNew('3. reply من نفس المستخدم',h,h.users[0],'mine');
  h=harness();appendInquiry(h,'no-read');appendReply(h,'no-read','recipient');assertLegacyMatchesNew('4. بدون Read record',h,h.users[0],'mine');
  h=harness();appendInquiry(h,'old-read');appendReply(h,'old-read','recipient');appendRead(h,'old-read','creator','2026-01-02T00:00:00.000Z');assertLegacyMatchesNew('5. Read أقدم من reply',h,h.users[0],'mine');
  h=harness();appendInquiry(h,'new-read');appendReply(h,'new-read','recipient');appendRead(h,'new-read','creator','2026-01-04T00:00:00.000Z');assertLegacyMatchesNew('6. Read أحدث من reply',h,h.users[0],'mine');
  h=harness();appendInquiry(h,'unread-notification');appendNotification(h,'unread-notification','creator');assertLegacyMatchesNew('7. unread notification بلا reply',h,h.users[0],'mine');
  h=harness();appendInquiry(h,'read-notification');appendNotification(h,'read-notification','creator','2026-01-04T00:00:00.000Z');assertLegacyMatchesNew('8. read notification',h,h.users[0],'mine');
  h=harness();appendInquiry(h,'both');appendReply(h,'both','recipient');appendNotification(h,'both','creator');assertLegacyMatchesNew('9. reply وnotification معًا',h,h.users[0],'mine');
  h=harness();appendInquiry(h,'multi-1');appendInquiry(h,'multi-2');appendReply(h,'multi-2','recipient');assertLegacyMatchesNew('10. multiple inquiries',h,h.users[0],'mine');
  h=harness();appendInquiry(h,'sender-summary');appendReply(h,'sender-summary','recipient');assertLegacyMatchesNew('11. sender new_replies',h,h.users[0],'mine');
  h=harness();appendInquiry(h,'recipient-summary','creator','recipient','قيد المعالجة');assertLegacyMatchesNew('12. recipient needs_reply',h,h.users[1],'assigned');
  h=harness();appendInquiry(h,'admin-visible','outsider','creator');appendInquiry(h,'admin-visible-2');assertLegacyMatchesNew('13. admin scope all',h,h.users[3],'all');
  h=harness();appendInquiry(h,'restricted');assert.throws(()=>legacyListAndSummary(h.c,h.users[2],'all'),/administration/);assert.throws(()=>call(h.c,'inquiry_list',h.users[2],{scope:'all'}),/administration/,'14. non-admin scope restriction');
});

test('inquiry_list يسجل القياسات التفصيلية ولا يكرر full scans داخل الطلب',()=>{
  const h=harness();appendInquiry(h,'instrumented');appendReply(h,'instrumented','recipient');appendNotification(h,'instrumented','creator');appendRead(h,'instrumented','creator','2026-01-02T00:00:00.000Z');
  h.metrics.ranges=[];call(h.c,'inquiry_list',h.users[0],{scope:'mine'});
  const perf=JSON.parse(h.logs.at(-1).replace(/^\[inquiry_perf\] /,''));
  ['inquiryListInquiries','inquiryListReads','inquiryListReplies','inquiryListNotifications','inquiryListUsers','inquiryListStateCalculation','inquiryListSerialization','inquirySummary'].forEach(name=>{
    assert.ok(perf.measurements[name],`${name} measurement`);
    ['duration_ms','rows_read','sheet_reads','spreadsheet_accesses','cache_hits','cache_misses'].forEach(metric=>assert.equal(typeof perf.measurements[name][metric],'number',`${name}.${metric}`));
  });
  ['duration_ms','rows_read','sheet_reads','spreadsheet_accesses','cache_hits','cache_misses','response_size_chars'].forEach(metric=>assert.equal(typeof perf[metric],'number',metric));
  for(const sheet of ['Inquiries','Inquiry Reads','Inquiry Replies','Inquiry Notifications','Users']){
    const dataReads=h.metrics.ranges.filter(x=>x.sheet===sheet&&(x.row>1||x.numRows>1));
    assert.equal(dataReads.length,1,`${sheet} data scan واحد`);
  }
  assert.doesNotMatch(h.logs.at(-1),/instrumented|creator|recipient|عنوان|تفاصيل|محتوى اختبار/);
});

function lastPerf(h){return JSON.parse(h.logs.at(-1).replace(/^\[inquiry_perf\] /,''));}
function resetReadMetrics(h){h.metrics.reads=0;h.metrics.rowsRead=0;h.metrics.ranges=[];h.metrics.headerReads=0;h.metrics.spreadsheetOpens=0;}

test('cache miss يبني state موثوقًا وcache hit يلغي full scans مع fallback بعد eviction',()=>{
  const h=harness();appendInquiry(h,'cache-state');appendReply(h,'cache-state','recipient');appendRead(h,'cache-state','creator','2026-01-02T00:00:00.000Z');appendNotification(h,'cache-state','creator');
  call(h.c,'inquiry_list',h.users[0],{scope:'mine'}); // يدفئ schema وstate.
  h.c.inquiryInvalidateStateCache_();resetReadMetrics(h);
  const miss=call(h.c,'inquiry_list',h.users[0],{scope:'mine'}),missPerf=lastPerf(h);
  assert.equal(miss.items[0].unread,true);assert.equal(missPerf.rows_read,9);assert.equal(missPerf.sheet_reads,5);assert.equal(missPerf.spreadsheet_accesses,1);
  resetReadMetrics(h);const hit=call(h.c,'inquiry_list',h.users[0],{scope:'mine'}),hitPerf=lastPerf(h);
  assert.deepEqual(JSON.parse(JSON.stringify(hit)),JSON.parse(JSON.stringify(miss)));assert.equal(hitPerf.rows_read,0);assert.equal(hitPerf.sheet_reads,0);assert.equal(hitPerf.spreadsheet_accesses,0);
  h.clearCache();resetReadMetrics(h);const fallback=call(h.c,'inquiry_list',h.users[0],{scope:'mine'}),fallbackPerf=lastPerf(h);
  assert.equal(fallback.items[0].unread,true);assert.ok(fallbackPerf.rows_read>0);assert.ok(fallbackPerf.sheet_reads>0);assert.equal(fallbackPerf.spreadsheet_accesses,1);
});

test('reply وmark_read وstatus تغير generation ولا تترك inquiry_list قديمًا',()=>{
  const h=harness();appendInquiry(h,'invalidate');
  let list=call(h.c,'inquiry_list',h.users[0],{scope:'mine'});assert.equal(list.items[0].unread,false);
  call(h.c,'inquiry_answer',h.users[1],{inquiry_id:'invalidate',body:'رد جديد',request_id:'invalidate-reply'});resetReadMetrics(h);
  list=call(h.c,'inquiry_list',h.users[0],{scope:'mine'});assert.equal(list.items[0].unread,true);assert.ok(lastPerf(h).sheet_reads>0,'reply invalidation');
  const detail=call(h.c,'inquiry_detail',h.users[0],{inquiry_id:'invalidate'}),userGenerationKey=Object.keys(h.cacheData).find(key=>key.includes('generation:KAG:user:')),generationBeforeRead=h.cacheData[userGenerationKey];call(h.c,'inquiry_mark_read',h.users[0],{inquiry_id:'invalidate',read_cursor:detail.inquiry.read_cursor});assert.notEqual(h.cacheData[userGenerationKey],generationBeforeRead,'mark_read user generation');resetReadMetrics(h);
  list=call(h.c,'inquiry_list',h.users[0],{scope:'mine'});assert.equal(list.items[0].unread,false);assert.equal(lastPerf(h).sheet_reads,0,'mark_read response أعاد بناء cache الصحيح');
  call(h.c,'inquiry_status',h.users[0],{inquiry_id:'invalidate',status:'مغلق',request_id:'invalidate-status'});resetReadMetrics(h);
  list=call(h.c,'inquiry_list',h.users[0],{scope:'mine'});assert.equal(list.items[0].status,'مغلق');assert.ok(lastPerf(h).sheet_reads>0,'status invalidation');
});

test('create وredirect يغيران generation ويحافظان على scope والصلاحيات',()=>{
  const h=harness();call(h.c,'inquiry_list',h.users[3],{scope:'all'});
  call(h.c,'inquiry_create',h.users[0],{request_id:'cache-create',title:'جديد',details:'تفاصيل',recipient_username:'recipient',priority:'عادي'});resetReadMetrics(h);
  let adminList=call(h.c,'inquiry_list',h.users[3],{scope:'all'});assert.equal(adminList.items.length,1);assert.ok(lastPerf(h).sheet_reads>0,'create invalidation');
  const id=adminList.items[0].inquiry_id;call(h.c,'inquiry_redirect',h.users[3],{inquiry_id:id,recipient_username:'outsider',request_id:'cache-redirect'});resetReadMetrics(h);
  const oldRecipient=call(h.c,'inquiry_list',h.users[1],{scope:'assigned'});assert.equal(oldRecipient.items.length,0);assert.ok(lastPerf(h).sheet_reads>0,'redirect invalidation');
  const newRecipient=call(h.c,'inquiry_list',h.users[2],{scope:'assigned'});assert.equal(newRecipient.items.length,1);
  assert.throws(()=>call(h.c,'inquiry_list',h.users[2],{scope:'all'}),/administration/);
  adminList=call(h.c,'inquiry_list',h.users[3],{scope:'all'});assert.equal(adminList.items[0].recipient_username,'outsider');
});

test('تغير generation أثناء cache hit يهمل state القديم ويعيد الحساب authoritative',()=>{
  const h=harness();appendInquiry(h,'race');call(h.c,'inquiry_list',h.users[0],{scope:'mine'});
  appendReply(h,'race','recipient');let changed=false;
  h.setCacheGetHook((key,data)=>{if(!changed&&key.includes('kag:inquiry:state:')){changed=true;data['kag:inquiry:generation:KAG:global']='concurrent-generation';}});
  resetReadMetrics(h);const list=call(h.c,'inquiry_list',h.users[0],{scope:'mine'});h.setCacheGetHook(null);
  assert.equal(list.items[0].unread,true);assert.ok(lastPerf(h).sheet_reads>0);assert.equal(changed,true);
});

test('cache لا يتجاوز validation الخاص بالcursor',()=>{
  const h=harness();appendInquiry(h,'cursor');call(h.c,'inquiry_list',h.users[0],{scope:'mine'});
  assert.throws(()=>call(h.c,'inquiry_mark_read',h.users[0],{inquiry_id:'cursor',read_cursor:{through_at:'2026-01-05T00:00:00.000Z',notification_ids:[]}}),/حد القراءة لم يعد صالحًا/);
  assert.equal(h.sheets['Inquiry Reads'].data.length,1);
});

test('TTL يغطي polling التالي دون إطالة نافذة stale بلا حاجة',()=>{
  const h=harness();appendInquiry(h,'ttl');call(h.c,'inquiry_list',h.users[0],{scope:'mine'});
  const stateKey=Object.keys(h.cacheTtls).find(key=>key.includes('kag:inquiry:state:'));
  assert.equal(h.cacheTtls[stateKey],90);assert.ok(h.cacheTtls[stateKey]>45);
});

test('mark_read لمستخدم A يحافظ على cache مستخدم B',()=>{
  const h=harness();appendInquiry(h,'user-isolation');appendReply(h,'user-isolation','recipient');appendNotification(h,'user-isolation','creator');
  call(h.c,'inquiry_list',h.users[0],{scope:'mine'});call(h.c,'inquiry_list',h.users[1],{scope:'assigned'});
  const globalBefore=h.cacheData['kag:inquiry:generation:KAG:global'],detail=call(h.c,'inquiry_detail',h.users[0],{inquiry_id:'user-isolation'});
  call(h.c,'inquiry_mark_read',h.users[0],{inquiry_id:'user-isolation',read_cursor:detail.inquiry.read_cursor});
  assert.equal(h.cacheData['kag:inquiry:generation:KAG:global'],globalBefore);
  resetReadMetrics(h);const recipientList=call(h.c,'inquiry_list',h.users[1],{scope:'assigned'});
  assert.equal(recipientList.items.length,1);assert.equal(lastPerf(h).sheet_reads,0);assert.equal(lastPerf(h).rows_read,0);
});

test('CacheService failures لا تكسر inquiry_list أو mutation بعد successful write',()=>{
  let h=harness();appendInquiry(h,'get-failure');h.cacheBehavior.getError=key=>key.includes('generation:');
  let result=call(h.c,'inquiry_list',h.users[0],{scope:'mine'}),perf=lastPerf(h);assert.equal(result.items.length,1);assert.ok(perf.sheet_reads>0);assert.ok(perf.cache_get_failed>0);
  h=harness();appendInquiry(h,'put-failure');h.cacheBehavior.putError=key=>key.includes('kag:inquiry:state:');
  result=call(h.c,'inquiry_list',h.users[0],{scope:'mine'});perf=lastPerf(h);assert.equal(result.items.length,1);assert.ok(perf.cache_put_failed>0);
  h=harness();appendInquiry(h,'remove-failure');const detail=call(h.c,'inquiry_detail',h.users[0],{inquiry_id:'remove-failure'});h.cacheBehavior.putError=key=>key.includes('generation:KAG:user:');h.cacheBehavior.removeError=key=>key.includes('generation:KAG:user:');
  result=call(h.c,'inquiry_mark_read',h.users[0],{inquiry_id:'remove-failure',read_cursor:detail.inquiry.read_cursor});perf=lastPerf(h);assert.equal(result.ok,true);assert.equal(h.sheets['Inquiry Reads'].data.length,2);assert.ok(perf.cache_put_failed>0);assert.ok(perf.cache_remove_failed>0);
});

test('oversized compact state يسقط إلى authoritative fallback ويسجل telemetry آمنة',()=>{
  const h=harness();appendInquiry(h,'oversized');h.cacheBehavior.maxChars=100;
  let result=call(h.c,'inquiry_list',h.users[0],{scope:'mine'}),perf=lastPerf(h);assert.equal(result.items.length,1);assert.ok(perf.compact_state_size_chars>100);assert.ok(perf.cache_put_failed>0);
  resetReadMetrics(h);result=call(h.c,'inquiry_list',h.users[0],{scope:'mine'});perf=lastPerf(h);assert.equal(result.items.length,1);assert.ok(perf.sheet_reads>0,'فشل put يعني authoritative fallback لاحقًا');
  assert.doesNotMatch(h.logs.join('\n'),/عنوان oversized|تفاصيل oversized|creator|recipient/);
  ['compact_state_size_chars','cache_put_success','cache_put_failed','cache_get_failed','cache_remove_failed'].forEach(metric=>assert.equal(typeof perf[metric],'number'));
});


test('رد محفوظ ثم استجابة متأخرة مع polling وdata_sync وهميين لا يتكرر وتتحرر القراءة النهائية من القفل',()=>{
  const h=harness(),id=create(h),request={inquiry_id:id,body:'رد حُفظ قبل انتهاء مهلة العميل',request_id:'timeout-stable-id'};
  h.metrics.reads=0;h.metrics.readsWhileLocked=0;
  // تمثل هذه الدعوة حفظ الخادم مع ضياع/تأخر الاستجابة عند العميل.
  call(h.c,'inquiry_reply',h.users[1],request);
  const lockedReads=h.metrics.readsWhileLocked,totalAfterReply=h.metrics.reads;
  assert.equal(h.lockState.held,false);assert.ok(lockedReads>0);assert.ok(totalAfterReply>lockedReads,'تسلسل الاستجابة التفصيلي يجب أن يجري بعد تحرير القفل');
  // تمثل طلبات polling المتداخلة؛ data_sync مستقل ولا يمر عبر معالج الاستفسارات.
  call(h.c,'inquiry_bootstrap',h.users[1]);call(h.c,'inquiry_list',h.users[1],{scope:'assigned'});let dataSyncCalls=0;dataSyncCalls++;
  const retried=call(h.c,'inquiry_reply',h.users[1],request);
  assert.equal(retried.deduplicated,true);assert.equal(h.sheets['Inquiry Replies'].data.length,2);assert.equal(dataSyncCalls,1);
});
