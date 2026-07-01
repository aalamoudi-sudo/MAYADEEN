# GitHub Deployment Security

## الملف الآمن للرفع العام

استخدم هذا الملف عند رفع المشروع إلى GitHub عام:

- `KAG_Dashboard_GitHub_Safe.html`

هذه النسخة لا تحتوي على:

- كلمة مرور ثابتة.
- رابط Google Apps Script مدمج.
- بيانات WBS المدمجة الخاصة بالمشروع.
- تحميل Chart.js أو Google Fonts من CDN خارجي.

## الملف الداخلي

هذا الملف يحتوي على بيانات المشروع المدمجة، لذلك لا ترفعه إلى مستودع عام إذا كانت البيانات غير مخصصة للنشر:

- `KAG_Dashboard_Final.html`

## تشغيل البيانات الحية

لربط النسخة الآمنة مع Google Sheet:

1. افتح الصفحة.
2. ادخل إلى صفحة الإعدادات.
3. ضع رابط Google Apps Script HTTPS.
4. تأكد أن Apps Script يطبق صلاحيات قراءة مناسبة.

## تنبيه مهم

GitHub Pages يستضيف ملفات static فقط. أي كلمة مرور أو رابط API داخل HTML أو JavaScript يمكن لأي شخص قراءته من المتصفح أو المستودع. المصادقة الحقيقية يجب أن تكون في backend أو عبر مزود هوية مثل Google Workspace أو Microsoft Entra.

