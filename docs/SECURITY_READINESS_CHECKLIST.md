# Security Readiness Checklist

## GitHub Readiness

- [x] نسخة آمنة للرفع العام بدون بيانات حساسة: `KAG_Dashboard_GitHub_Safe.html`
- [x] لا توجد كلمة مرور ثابتة في نسخة GitHub الآمنة.
- [x] لا يوجد رابط Google Apps Script مدمج.
- [x] لا يوجد CDN خارجي في النسخة الآمنة.
- [x] يوجد CSP أساسي.
- [ ] المستودع خاص إذا تم رفع بيانات المشروع الداخلية.
- [ ] عدم رفع `KAG_Dashboard_Final.html` إذا كانت بيانات WBS حساسة.

## Authentication Readiness

- [ ] تفعيل Supabase Auth.
- [ ] ربط Google Workspace أو Microsoft Entra.
- [ ] إنشاء profiles لكل مستخدم.
- [ ] ربط `profiles.auth_user_id` مع مستخدم المصادقة.
- [ ] تعطيل anonymous access في الإنتاج.

## Authorization Readiness

- [x] تعريف RBAC Matrix.
- [x] كتابة SQL helper functions للأدوار.
- [x] كتابة RLS policies أولية.
- [ ] اختبار كل دور عملياً.
- [ ] فصل صلاحيات supplier حسب النطاق.
- [ ] فصل صلاحيات viewer حسب المشروع أو المسار.

## Audit Readiness

- [x] جدول `audit_logs` موجود.
- [x] trigger مبدئي لتحديثات المهام في Phase 3.
- [ ] إضافة Audit Log لكل create/update في risks.
- [ ] إضافة Audit Log لكل create/update في decisions.
- [ ] إضافة Audit Log لكل create/update في approvals.
- [ ] منع حذف audit logs من الواجهة.

## Data Governance

- [x] قاموس بيانات WBS.
- [x] مواصفة import.
- [x] تقرير جودة بيانات.
- [ ] منع تعديل baseline إلا عبر Change Request.
- [ ] إنشاء workflow لاعتماد Change Request.
- [ ] إضافة owner mapping رسمي.

## API Security

- [x] منع API writes بدون session عبر `session_token` موقع في Apps Script.
- [x] التحقق من الدور قبل كل mutation حساس.
- [ ] rate limiting لاحقاً.
- [ ] validation server-side لكل input.
- [x] عدم تخزين secrets في frontend.

## Document Security

- [ ] عدم تخزين ملفات حساسة داخل GitHub.
- [ ] استخدام Google Drive أو SharePoint أو Supabase Storage.
- [ ] صلاحيات ملفات حسب الدور.
- [ ] منع روابط عامة غير مقصودة.

## Production Gate

لا يعتبر النظام جاهزاً للإنتاج حتى تتحقق العناصر التالية:

1. Auth مفعل.
2. RLS مفعل ومختبر.
3. Audit Log يغطي التعديلات الحساسة.
4. المستودع لا يحتوي بيانات حساسة عامة.
5. لا توجد secrets في الواجهة.
6. كل role تم اختباره.
7. backup/export strategy موجودة.
