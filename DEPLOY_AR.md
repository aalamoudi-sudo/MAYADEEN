# خطوات النشر

## 1) Apps Script (أولاً)
1. افتح مشروع Apps Script المرتبط بالداشبورد.
2. استبدل محتوى الملف بمحتوى `apps-script/current-apps-script.gs` كاملاً واحفظ.
3. Deploy ← Manage deployments ← اختر النشر الحالي ← Edit ← Version: New version ← Deploy.
   (نفس الرابط — لا تنشئ Deployment جديد.)

## 2) GitHub
ارفع الملفات فوق الموجودة، واحذف من المستودع الملفات التالية (رفع الملفات لا يحذف القديمة):
- مجلد `backups/`
- `index.html.backup-20260720-p1-batch2`
- `index.html.bak-20260720-113502`
- `apps-script/Code.gs.backup-20260720-p1-batch2`
- `apps-script/Inquiries.repository-before-fix.bak`
- `apps-script/current-apps-script.gs.backup-20260914-inquiries-phase1-2`
- `apps-script/current-apps-script.gs.backup-20260914-inquiries-phase3`

## 3) Render
ينشر تلقائياً بعد الرفع على GitHub (Static Site). إذا ما نشر: Manual Deploy ← Deploy latest commit.

## 4) التحقق
- افتح الرابط في نافذة خاصة وسجّل دخول.
- الرئيسية: 4 بطاقات، وحالة "معلّقة لحين الموعد".
- المهام: ضع `*` في اسم مهمة أو كودها في الشيت ← تظهر معلّقة بعد "تحديث البيانات الآن".
