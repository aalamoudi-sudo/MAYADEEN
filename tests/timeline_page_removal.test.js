const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
test('timeline page, navigation, chart and refresh handlers are removed',()=>{
 for(const marker of ['id="timeline"','data-page="timeline"','renderTimeline(', 'renderTimelinePage(', 'ensureTimelineFreshData','TIMELINE_FILTER_IDS','tl-lineChart','_tlLineInst','renderSchedulePressure(']) assert.ok(!html.includes(marker),marker);
 assert.match(html,/if\(!document.getElementById\(id\)\) id='overview'/);
 assert.match(html,/function renderTasks\(/);
 assert.match(html,/function renderPhases\(/);
});
