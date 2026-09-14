const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

class Range{
  constructor(sheet,r,c,nr,nc){Object.assign(this,{sheet,r,c,nr,nc});}
  getValues(){if(this.sheet.metrics){this.sheet.metrics.reads++;if(this.sheet.metrics.lockState.held)this.sheet.metrics.readsWhileLocked++;}return Array.from({length:this.nr},(_,i)=>Array.from({length:this.nc},(_,j)=>this.sheet.data[this.r-1+i]?.[this.c-1+j]??''));}
  setValues(v){v.forEach((row,i)=>row.forEach((x,j)=>{this.sheet.data[this.r-1+i]??=[];this.sheet.data[this.r-1+i][this.c-1+j]=x;}));return this;}
  setValue(v){return this.setValues([[v]]);}
}
class Sheet{
  constructor(headers=[]){this.data=[headers.slice()];}
  getLastRow(){return this.data.length;}
  getRange(r,c,nr=1,nc=1){return new Range(this,r,c,nr,nc);}
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
  const sheets=Object.fromEntries(Object.entries(headers).map(([n,h])=>[n,new Sheet(h)]));
  const users=[
    {username:'creator',display_name:'المنشئ',status:'active',allowed_pages:'tasks',access_level:'workstream'},
    {username:'recipient',display_name:'المستلم',status:'active',allowed_pages:'tasks',access_level:'workstream'},
    {username:'outsider',display_name:'غير مخول',status:'active',allowed_pages:'overview',access_level:'workstream'},
    {username:'admin',display_name:'الإدارة',status:'active',allowed_pages:'*',access_level:'full',can_manage_users:'TRUE'}
  ];
  sheets.Users=new Sheet(['username','display_name','status','allowed_pages','access_level','can_manage_users','email','role']);
  users.forEach(u=>sheets.Users.appendRow(sheets.Users.data[0].map(h=>u[h]??'')));
  const lockState={busy:false,held:false,tryCalls:0,releases:0};
  const metrics={reads:0,readsWhileLocked:0,lockState};Object.values(sheets).forEach(sheet=>sheet.metrics=metrics);
  const ss={getSheetByName:n=>sheets[n]||null};let seq=0,emailCalls=0,triggerCalls=0;
  const context={console,Date,RegExp,String,Object,Array,Error,Math,JSON,isFinite,
    KAG_CONFIG:{usersSheetName:'Users'},SPREADSHEET_ID:'test',
    SpreadsheetApp:{openById:()=>ss},Utilities:{getUuid:()=>`uuid-${++seq}`},
    LockService:{getScriptLock:()=>({tryLock(){lockState.tryCalls++;lockState.held=!lockState.busy;return lockState.held;},hasLock(){return lockState.held;},releaseLock(){lockState.held=false;lockState.releases++;}})},
    getRegisterRows_:()=>users,getUserAccessHeaders_:()=>[],safeUser_:u=>({...u}),
    hasFullAccess_:u=>u.access_level==='full',parseBool_:v=>v===true||v==='TRUE',normalizeAllowedPages_:u=>String(u.allowed_pages||'').split(','),
    readOfficialWbsTasks_:()=>({rows:[{code:'T-1',name:'مهمة مسموحة',owner:'المستلم',ownerEmail:''}]}),taskCode_:t=>t.code,taskName_:t=>t.name,taskOwner_:t=>t.owner,taskField_:(t,k)=>k==='ownerEmail'?t.ownerEmail:'',
    GmailApp:{sendEmail(){emailCalls++;}},ScriptApp:{newTrigger(){triggerCalls++;}}
  };
  vm.createContext(context);vm.runInContext(fs.readFileSync('apps-script/Inquiries.gs','utf8'),context);
  return {c:context,users,sheets,lockState,metrics,getEmailCalls:()=>emailCalls,getTriggerCalls:()=>triggerCalls};
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
  assert.equal(first.inquiry.reply_count,150);
  assert.equal(first.inquiry.has_older_replies,true);
  assert.equal(first.summary,undefined,'التفاصيل لا تعيد حساب ملخص القائمة غير المستخدم');
  const expanded=call(h.c,'inquiry_detail',h.users[0],{inquiry_id:id,message_limit:200});
  assert.equal(expanded.inquiry.replies.length,150);
  assert.equal(expanded.inquiry.has_older_replies,false);
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
