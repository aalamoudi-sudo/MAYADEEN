const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const backend=fs.readFileSync('apps-script/Code.gs','utf8');

function runtime(){
  const calls=[];
  const ctx={console,Logger:{log(){}},Utilities:{getUuid:()=>`uuid-${calls.length}`,formatDate:()=> '2026-09-16 12:00:00',newBlob:value=>({getBytes:()=>Buffer.from(value)})},SpreadsheetApp:{openById(){calls.push('open');return {id:'sheet'};}},Session:{},CacheService:{},PropertiesService:{},LockService:{},UrlFetchApp:{},MailApp:{}};
  vm.createContext(ctx);vm.runInContext(backend,ctx);
  const rows=[{code:'T1',type:'Task',progress:50,status:'قيد التنفيذ'},{code:'M1',type:'Milestone',progress:100,status:'مكتملة'}];
  const table=name=>[{id:name,path_scope:'delivery'}];
  ctx.readOfficialWbsTasks_=()=>{calls.push('wbs');return {rows,headers:['code','progress'],diagnostics:{sheet_name:'WBS',valid_task_count:2,raw_row_count:2,cells_read:20}}};
  const readers={getApprovalRows_:'approvals',getExistingEscalationRows_:'escalations',getTaskEscalationRows_:'task_escalations',getAssignmentRows_:'assignments',getUrgentTaskRows_:'urgent_tasks',getDecisionRows_:'decisions',getEmployeeMasterRows_:'employee_master',getProjectMasterRows_:'project_master',getProjectSettingsRows_:'project_settings'};
  for(const [fn,name] of Object.entries(readers))ctx[fn]=()=>{calls.push(name);return table(name)};
  ctx.getExistingRegisterRows_=(_s,name)=>{calls.push(name);return table(name)};
  ctx.deduplicateEscalationsById_=x=>x;
  ctx.projectVisibleRows_=x=>x.slice();ctx.filterTaskEvidenceForSession_=x=>x.slice();ctx.filterTaskEvidenceHeadersForSession_=x=>x.slice();ctx.safeUser_=s=>({username:s.username});
  ctx.buildOverdueEscalationClientConfig_=()=>({allowed:false});
  ctx.buildBaselineManagement_=()=>table('baseline');ctx.buildRaciMatrix_=()=>table('raci');ctx.buildCriticalPathAnalysis_=()=>({ok:true,tasks:[]});ctx.buildEmployeeWorkload_=()=>table('workload');ctx.buildDataQualityCenter_=()=>({issues:[]});
  return {ctx,calls,rows};
}

test('home contract preserves WBS KPI inputs while skipping page-only reads and calculations',()=>{
  const full=runtime(),home=runtime(),session={username:'user',allowed_pages:['*']};
  const oldPayload=full.ctx.buildDashboardData_(session),newPayload=home.ctx.buildDashboardHomeData_(session);
  const kpi=x=>({tasks:x.rows.filter(r=>r.type==='Task').length,milestones:x.rows.filter(r=>r.type==='Milestone').length,progress:x.rows.reduce((n,r)=>n+Number(r.progress||0),0)});
  assert.deepEqual(kpi(newPayload),kpi(oldPayload));
  assert.ok(full.calls.includes('Meetings Register'));
  assert.ok(!home.calls.includes('Meetings Register'));
  assert.ok(!home.calls.includes('employee_master'));
  assert.equal(home.calls.filter(x=>x==='open').length,1);
});

test('each lazy section opens one spreadsheet and reads only its declared dependencies',()=>{
  const {ctx,calls}=runtime();
  const result=ctx.buildDashboardSectionData_({username:'user',allowed_pages:['*']},'meetingsHub');
  assert.deepEqual(JSON.parse(JSON.stringify(result.datasets)),{meetings:[{id:'Meetings Register',path_scope:'delivery'}]});
  assert.deepEqual(calls,['open','Meetings Register']);
});

test('derived section dependencies reuse WBS and critical-path work within one request',()=>{
  const {ctx,calls}=runtime();
  ctx.buildDashboardSectionData_({username:'user',allowed_pages:['*']},'raciWorkload');
  assert.equal(calls.filter(x=>x==='wbs').length,1);
  assert.equal(calls.filter(x=>x==='employee_master').length,1);
});

test('unknown sections return no data and perform no spreadsheet read',()=>{
  const {ctx,calls}=runtime();
  const result=ctx.buildDashboardSectionData_({username:'user',allowed_pages:['*']},'not-authorized-page');
  assert.deepEqual(JSON.parse(JSON.stringify(result.datasets)),{});
  assert.deepEqual(calls,[]);
});

test('section route enforces server-side page permission before opening Sheets',()=>{
  const {ctx,calls}=runtime();
  assert.throws(()=>ctx.buildDashboardSectionData_({username:'restricted',allowed_pages:['overview']},'meetingsHub'),/Forbidden/);
  assert.deepEqual(calls,[]);
});

test('section request skips home datasets and cannot request data outside its server plan',()=>{
  const {ctx,calls}=runtime();
  const session={username:'user',allowed_pages:['*']};
  const result=ctx.buildDashboardSectionData_(session,'approvals',['approval_chain','decisions','approval_chain']);
  assert.deepEqual(JSON.parse(JSON.stringify(result.datasets)),{approval_chain:[{id:'Approval Chain Register',path_scope:'delivery'}]});
  assert.deepEqual(calls,['open','Approval Chain Register']);
});

test('empty section delta avoids opening the spreadsheet',()=>{
  const {ctx,calls}=runtime();
  const result=ctx.buildDashboardSectionData_({username:'user',allowed_pages:['*']},'decisions',[]);
  assert.deepEqual(JSON.parse(JSON.stringify(result.datasets)),{});
  assert.deepEqual(calls,[]);
});
