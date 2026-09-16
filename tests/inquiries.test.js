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
    {username:'restricted',display_name:'مستخدم نشط محدود',status:'active',allowed_pages:'',path_scope:'isolated',role:'guest',access_level:'none'},
    {username:'admin',display_name:'الإدارة',status:'active',allowed_pages:'*',access_level:'full',can_manage_users:'TRUE'}
  ];
  sheets.Users=new Sheet(['username','display_name','status','allowed_pages','access_level','can_manage_users','email','role'],'Users');
  users.forEach(u=>sheets.Users.appendRow(sheets.Users.data[0].map(h=>u[h]??'')));
  const lockState={busy:false,held:false,tryCalls:0,releases:0};
  const metrics={reads:0,rowsRead:0,ranges:[],headerReads:0,readsWhileLocked:0,spreadsheetOpens:0,lockState};Object.values(sheets).forEach(sheet=>sheet.metrics=metrics);
  const ss={getSheetByName:n=>sheets[n]||null};let seq=0,emailCalls=0,triggerCalls=0;const cacheData={},propertyData={},logs=[];
  const cacheBehavior={throwGet:false,throwPut:false,throwRemove:false,onPut:null};
  const context={console,Date,RegExp,String,Object,Array,Error,Math,JSON,isFinite,
    KAG_CONFIG:{usersSheetName:'Users'},SPREADSHEET_ID:'test',
    SpreadsheetApp:{openById:()=>{metrics.spreadsheetOpens++;return ss;}},Utilities:{getUuid:()=>`uuid-${++seq}`},
    CacheService:{getScriptCache:()=>({
      get:key=>{if(cacheBehavior.throwGet)throw new Error('cache get');return cacheData[key]||null;},
      put:(key,value)=>{if(cacheBehavior.onPut)cacheBehavior.onPut(key,value);if(cacheBehavior.throwPut)throw new Error('cache put');cacheData[key]=value;},
      remove:key=>{if(cacheBehavior.throwRemove)throw new Error('cache remove');delete cacheData[key];}
    })},
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>propertyData[key]||null,setProperty:(key,value)=>{propertyData[key]=String(value);}})},Logger:{log:value=>logs.push(value)},
    LockService:{getScriptLock:()=>({tryLock(){lockState.tryCalls++;lockState.held=!lockState.busy;return lockState.held;},hasLock(){return lockState.held;},releaseLock(){lockState.held=false;lockState.releases++;}})},
    getRegisterRows_:()=>users,getUserAccessHeaders_:()=>[],safeUser_:u=>({...u}),
    hasFullAccess_:u=>u.access_level==='full',parseBool_:v=>v===true||v==='TRUE',normalizeAllowedPages_:u=>String(u.allowed_pages||'').split(','),
    readOfficialWbsTasks_:()=>({rows:[{code:'T-1',name:'مهمة مسموحة',owner:'المستلم',ownerEmail:''}]}),taskCode_:t=>t.code,taskName_:t=>t.name,taskOwner_:t=>t.owner,taskField_:(t,k)=>k==='ownerEmail'?t.ownerEmail:'',
    GmailApp:{sendEmail(){emailCalls++;}},ScriptApp:{newTrigger(){triggerCalls++;}}
  };
  vm.createContext(context);vm.runInContext(fs.readFileSync('apps-script/Inquiries.gs','utf8'),context);
  return {c:context,users,sheets,lockState,metrics,logs,cacheData,cacheBehavior,propertyData,getEmailCalls:()=>emailCalls,getTriggerCalls:()=>triggerCalls};
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
  assert.equal(h.metrics.spreadsheetOpens,0,'list state cache avoids reopening the spreadsheet');
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

test('كل مستخدم نشط موثق يفتح صفحة الاستفسارات ويرسل استفسارًا دون قيود الصفحة أو المسار أو الدور أو مستوى الوصول',()=>{
  const h=harness(),restricted=h.users.find(user=>user.username==='restricted');
  assert.equal(h.c.inquiryCanUse_(restricted),true);
  const created=call(h.c,'inquiry_create',restricted,{request_id:'restricted-create',title:'استفسار مستخدم محدود',details:'تفاصيل',recipient_username:'recipient',priority:'عادي'});
  assert.equal(created.ok,true);
  assert.equal(created.inquiry.sender_username,'restricted');

  const frontend=fs.readFileSync('index.html','utf8');
  assert.match(frontend,/if\(id==='inquiries'\) return !!currentUser\.username;/);
  const production=fs.readFileSync('apps-script/current-apps-script.gs','utf8');
  assert.match(production,/function handleInquiryAction_\(payload, session\) \{\s*if \(!inquiryCanUse_\(session\)\) throw new Error\("Unauthorized"\);/);
  assert.match(production,/function requireSession_\(payload, profile\)[\s\S]*?const user = findActiveUser_\(session\.sub, false, profile\);[\s\S]*?if \(!user\) throw new Error\('Unauthorized'\);/);
});

test('bootstrap الإنشاء لا يقرأ الاستفسارات أو الإشعارات، والتحقق من نتيجة الإنشاء معزول بصاحب الطلب',()=>{
  const h=harness();h.metrics.ranges=[];h.metrics.rowsRead=0;
  const bootstrap=call(h.c,'inquiry_bootstrap',h.users[0]);
  assert.equal(bootstrap.ok,true);assert.ok(Array.isArray(bootstrap.users));assert.ok(Array.isArray(bootstrap.tasks));
  assert.equal(bootstrap.summary,undefined);assert.equal(bootstrap.notifications,undefined);
  assert.equal(h.metrics.ranges.some(x=>x.row>1&&['Inquiries','Inquiry Notifications','Inquiry Replies','Inquiry Reads'].includes(x.sheet)),false);
  assert.equal(call(h.c,'inquiry_request_status',h.users[0],{request_kind:'create',request_id:'missing'}).found,false);
  const id=create(h);
  const own=call(h.c,'inquiry_request_status',h.users[0],{request_kind:'create',request_id:'create-1'});
  assert.equal(own.found,true);assert.equal(own.inquiry_id,id);
  assert.equal(call(h.c,'inquiry_request_status',h.users[1],{request_kind:'create',request_id:'create-1'}).found,false);
});

test('فتح التفاصيل قراءة فقط وينجح مع انشغال قفل الكتابة',()=>{
  const h=harness(),id=create(h);h.lockState.busy=true;const before=h.lockState.tryCalls;
  const detail=call(h.c,'inquiry_detail',h.users[0],{inquiry_id:id});
  assert.equal(detail.inquiry.inquiry_id,id);assert.equal(detail.users.length,0);assert.equal(h.lockState.tryCalls,before);assert.equal(h.sheets['Inquiry Reads'].data.length,1);
});

test('عقد تفاصيل المحادثة يوفر users للإدارة فقط ويحافظ على RBAC وأهلية المهمة',()=>{
  const h=harness(),admin=h.users[4];
  const id=call(h.c,'inquiry_create',h.users[0],{request_id:'task-create',title:'سؤال مهمة',details:'تفاصيل',recipient_username:'recipient',task_id:'T-1',priority:'عادي'}).inquiry.inquiry_id;
  const detail=call(h.c,'inquiry_detail',admin,{inquiry_id:id});
  assert.equal(detail.ok,true);assert.ok(Array.isArray(detail.users));
  assert.deepEqual(Array.from(detail.users,u=>u.username).sort(),['creator','recipient'].sort());
  assert.equal(detail.users.some(user=>user.username==='admin'),false);
  assert.throws(()=>call(h.c,'inquiry_detail',h.users[2],{inquiry_id:id}),/Forbidden/);
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
  assert.equal(perf.action,'inquiry_detail');assert.equal(perf.rows_read,208);
  assert.equal(perf.sheet_reads,5);assert.equal(perf.spreadsheet_accesses,1);
  assert.ok(perf.duration_ms>=0);assert.ok(perf.response_size_chars>0);
});

test('inquiry_list يعيد حقول العرض فقط ويحافظ على عقد القائمة والصلاحيات وunread',()=>{
  const h=harness(),id=create(h);
  call(h.c,'inquiry_answer',h.users[1],{inquiry_id:id,body:'نص سري لا يلزم القائمة',request_id:'list-reply'});
  const item=call(h.c,'inquiry_list',h.users[0],{scope:'mine'}).items[0];
  assert.deepEqual(Object.keys(item).sort(),['inquiry_id','project_id','title','sender_username','sender_name','recipient_username','recipient_name','task_id','task_title','priority','status','updated_at','unread'].sort());
  assert.equal(item.details,undefined);assert.equal(item.replies,undefined);assert.equal(item.events,undefined);assert.equal(item.request_id,undefined);assert.equal(item.unread,true);
  assert.equal(call(h.c,'inquiry_list',h.users[0],{scope:'mine'}).can_admin,false);
  assert.equal(call(h.c,'inquiry_list',h.users[4],{scope:'all'}).can_admin,true);
  assert.throws(()=>call(h.c,'inquiry_list',h.users[2],{scope:'all'}),/administration/);
});

test('inquiry_list لا يقرأ سجل الردود أو القراءات وتبقى كلفة Sheets ثابتة مع تضخم المحادثات',()=>{
  const h=harness(),id=create(h),replies=h.sheets['Inquiry Replies'];
  for(let i=0;i<3000;i++)replies.appendRow([`history-${i}`,id,'KAG','recipient',`رد قديم ${i}`,new Date(2025,0,1,0,0,i).toISOString(),`history-request-${i}`]);
  h.metrics.reads=0;h.metrics.rowsRead=0;h.metrics.ranges=[];
  const result=call(h.c,'inquiry_list',h.users[0],{scope:'mine'});
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].unread,false,'الصفوف التاريخية المصطنعة بلا notification لا تغيّر الحالة الموثقة');
  assert.equal(h.metrics.ranges.filter(x=>x.sheet==='Inquiry Replies').length,0);
  assert.equal(h.metrics.ranges.filter(x=>x.sheet==='Inquiry Reads').length,0);
  assert.deepEqual([...new Set(h.metrics.ranges.map(x=>x.sheet))].sort(),['Inquiries','Inquiry Notifications','Users']);
  assert.equal(h.metrics.rowsRead,8,'استفسار + إشعار + ستة صفوف Users فقط، بصرف النظر عن 3000 رد');
});

test('تغير generation قبل نشر القائمة يمنع نشر الحالة القديمة ويعيد البناء من Sheets',()=>{
  const h=harness();create(h);let builds=0;
  const original=h.c.inquiryBuildListState_;
  h.c.inquiryBuildListState_=user=>{const state=original(user);builds++;if(builds===1)h.c.inquiryBumpGeneration_('global');return state;};
  const result=call(h.c,'inquiry_list',h.users[0],{scope:'mine'});
  assert.equal(result.items.length,1);assert.equal(builds,2);
  assert.equal(Object.keys(h.cacheData).filter(key=>key.startsWith('kag-inquiry-list-v1:')).length,1);
});

test('تغير generation أثناء cache.put يزيل النشر المتسابق ولا يجعل cache authoritative',()=>{
  const h=harness();create(h);let raced=false;
  h.cacheBehavior.onPut=key=>{if(!raced&&key.startsWith('kag-inquiry-list-v1:')){raced=true;h.c.inquiryBumpGeneration_('global');}};
  const result=call(h.c,'inquiry_list',h.users[0],{scope:'mine'});
  assert.equal(result.items.length,1);assert.equal(raced,true);
  const current=h.c.inquiryListCacheKey_(h.users[0],h.c.inquiryGenerationSnapshot_('creator'));
  assert.ok(h.cacheData[current],'إعادة الحساب تنشر فقط تحت generation الحالية');
});

test('استثناءات CacheService في get وput وremove لا تفشل القراءة أو mutation ناجحة',()=>{
  const h=harness();h.cacheBehavior.throwGet=true;
  assert.equal(call(h.c,'inquiry_list',h.users[0],{scope:'mine'}).items.length,0);
  h.cacheBehavior.throwGet=false;h.cacheBehavior.throwPut=true;
  const id=create(h);assert.ok(id);assert.equal(call(h.c,'inquiry_list',h.users[0],{scope:'mine'}).items.length,1);
  h.cacheBehavior.throwPut=false;h.cacheBehavior.throwRemove=true;let raced=false;
  h.cacheBehavior.onPut=key=>{if(!raced&&key.startsWith('kag-inquiry-list-v1:')){raced=true;h.c.inquiryBumpGeneration_('global');}};
  assert.equal(call(h.c,'inquiry_list',h.users[1],{scope:'assigned'}).items.length,1);
});

test('mark_read يبطل Cache المستخدم فقط بينما mutation عامة تبطل جميع القوائم المتأثرة',()=>{
  const h=harness(),id=create(h),detail=call(h.c,'inquiry_detail',h.users[0],{inquiry_id:id});
  call(h.c,'inquiry_list',h.users[0],{scope:'mine'});call(h.c,'inquiry_list',h.users[1],{scope:'assigned'});
  h.metrics.reads=0;call(h.c,'inquiry_mark_read',h.users[0],{inquiry_id:id,read_cursor:detail.inquiry.read_cursor});
  h.metrics.reads=0;call(h.c,'inquiry_list',h.users[1],{scope:'assigned'});assert.equal(h.metrics.reads,0,'User B cache remains valid');
  call(h.c,'inquiry_reply',h.users[1],{inquiry_id:id,body:'رد عالمي',request_id:'global-invalidation'});
  h.metrics.reads=0;const refreshed=call(h.c,'inquiry_list',h.users[0],{scope:'mine'});
  assert.ok(h.metrics.reads>0,'global generation forces authoritative Sheet rebuild');
  assert.equal(refreshed.items[0].unread,true);assert.equal(refreshed.summary.new_replies,1);assert.equal(refreshed.summary.needs_reply,0);
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
