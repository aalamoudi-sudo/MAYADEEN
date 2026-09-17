const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');

test('مهل الاستفسار وتحميل الرئيسية مستقلة وموسومة باسم الطلب',()=>{
  assert.match(html,/timedOut=true;controller\.abort\(\)/);
  assert.match(html,/},15000\)/);
  assert.match(html,/dashboard_home timeout/);
  assert.match(html,/e\?\.inquiryAction==='inquiry_reply'/);
});

test('polling لا يبدأ قراءات إضافية أثناء كتابة رد',()=>{
  assert.match(html,/document\.visibilityState==='visible'&&!inquiryWriteInFlight/);
});

test('فشل تحديث المهام يحتفظ بآخر snapshot ناجح ولا يتأثر بخطأ الاستفسار',()=>{
  assert.match(html,/const lastSuccessfulData=initial\?null:captureSuccessfulDashboardData\(\)/);
  assert.match(html,/restoreSuccessfulDashboardData\(lastSuccessfulData\)/);
  assert.match(html,/ما زالت آخر بيانات ناجحة معروضة/);
  const inquiryBlock=html.slice(html.indexOf("let inquiryItems=[]"),html.indexOf('\n\n</script>',html.indexOf("let inquiryItems=[]")));
  assert.doesNotMatch(inquiryBlock,/sheetStatus|showSyncRetryState|setSyncLoadingState/);
});

test('حالة الرد غير المحسومة توفر تحققًا قبل إعادة الإرسال وتحافظ على request_id',()=>{
  assert.match(html,/verifyInquiryReply/);
  assert.match(html,/r\.request_id===d\.requestId/);
  assert.match(html,/request_id:d\.requestId/);
  assert.match(html,/تحقّق من وصوله قبل إعادة الإرسال/);
});
