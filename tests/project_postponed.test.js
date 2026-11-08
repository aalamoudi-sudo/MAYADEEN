const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
test('postponed dashboard has no fixed opening date or countdown bindings',()=>{
  assert.match(html,/status:'postponed', openingDate:null/);
  for(const stale of ['2026-11-01','updateOpeningCountdown','id="daysLeft"','id="tl-daysLeft"','id="esbDaysLeft"']) assert.ok(!html.includes(stale),stale);
  assert.match(html,/إنجاز المهام/);
});
for(const [name,next] of [['renderScheduleCard','renderSchedulePressure'],['renderSchedulePressure','renderExecutiveAdditions']]){
  test(name+' suspends schedule judgment without accessing task data',()=>{
    const start=html.indexOf('function '+name+'(');
    const end=html.indexOf('function '+next+'(',start);
    const rows={innerHTML:'old data'}, status={textContent:'old warning',style:{}};
    const context={PROJECT_SCHEDULE:{status:'postponed'},document:{getElementById:id=>id==='rows'?rows:status}};
    vm.runInNewContext(html.slice(start,end)+'\n'+name+'("rows","status");',context);
    assert.equal(rows.innerHTML,'');
    assert.match(status.textContent,/معلّق/);
  });
}
