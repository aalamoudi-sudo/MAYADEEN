# KAG Command Center MVP Scope

## الهدف من MVP

إثبات أن المنصة أصبحت نظام تشغيل فعلي، وليس مجرد لوحة مؤشرات. النسخة الأولى يجب أن تلتقط التحديث اليومي، تحفظ سجل التغييرات، وتعرض مؤشرات تنفيذية مبنية على بيانات قابلة للتدقيق.

## نطاق النسخة الأولى

### 1. Dashboard

المطلوب:
- إجمالي المهام.
- نسبة الإنجاز.
- المهام المتأخرة.
- المهام دون تحديث.
- المخاطر المفتوحة.
- القرارات المعلقة.
- جودة البيانات.

غير مطلوب في MVP:
- PDF متقدم.
- ذكاء اصطناعي.
- تنبؤات.

### 2. Tasks

المطلوب:
- عرض WBS.
- بحث وفلاتر.
- صفحة تفاصيل مهمة.
- owner.
- baseline dates.
- planned dates.
- actual dates.
- percent complete.
- progress status.
- schedule status.

غير مطلوب في MVP:
- Gantt احترافي كامل.
- تعديل جماعي متقدم.
- إدارة multi-project.

### 3. Daily Updates

المطلوب:
- قائمة مهامي.
- تحديث حالة المهمة.
- تحديث نسبة الإنجاز.
- إضافة ملخص تحديث.
- إضافة عائق.
- إضافة إجراء قادم.
- تحديد تاريخ التحديث القادم.

هذا هو قلب MVP.

### 4. Audit Log

المطلوب:
- تسجيل إنشاء التحديثات.
- تسجيل تعديل حالة المهمة.
- تسجيل تعديل نسبة الإنجاز.
- عرض سجل التغييرات للـ PMO.

غير مطلوب في MVP:
- واجهة بحث متقدمة داخل Audit Log.
- تصدير قانوني مفصل.

### 5. Risks

المطلوب:
- إنشاء خطر.
- probability.
- impact.
- severity.
- owner.
- treatment plan.
- linked task.

غير مطلوب في MVP:
- residual risk متقدم.
- heatmap متقدمة.

### 6. Decisions

المطلوب:
- إنشاء قرار.
- owner.
- priority.
- due date.
- status.
- linked task/risk.

غير مطلوب في MVP:
- دورة اعتماد متعددة المستويات.
- توقيع إلكتروني.

### 7. Data Import

المطلوب:
- استيراد WBS من CSV أو JSON في البداية.
- mapping بسيط للأعمدة.
- validation أساسي.

غير مطلوب في MVP:
- مزامنة لحظية مع Google Sheets.
- import wizard متقدم.

## المستخدمون في MVP

### PMO

- يستورد WBS.
- يراجع جودة البيانات.
- يرى Audit Log.
- يرى كل المهام.

### Project Manager

- يرى كل المهام.
- يرى المخاطر والقرارات.
- يعدل حالة عناصر المشروع.

### Workstream Owner

- يرى مهامه.
- يضيف تحديثات يومية.
- يرفع عوائق.

### Executive

- يرى Dashboard فقط.
- يرى تقارير مختصرة.

## خارج نطاق MVP

- غرفة العمليات.
- الميزانية والتكاليف.
- الموردون والعقود.
- المستندات المتقدمة.
- PDF متقدم.
- WhatsApp integration.
- Microsoft Teams/Slack integration.
- Multi-project portfolio.
- تطبيق جوال.

## معايير نجاح MVP

يعتبر MVP ناجحاً إذا:

1. يمكن استيراد WBS.
2. يمكن لكل مسؤول تحديث مهامه.
3. تظهر المهام المتأخرة بناءً على بيانات صحيحة.
4. كل تحديث يكتب في Audit Log.
5. Dashboard يعرض مؤشرات من قاعدة البيانات.
6. PMO يستطيع معرفة المهام التي لم تحدث.
7. لا توجد كلمة مرور أو سر داخل الواجهة.

## رحلة المستخدم الأساسية

1. PMO يستورد WBS.
2. النظام ينشئ المهام.
3. المسؤول يدخل Daily Updates.
4. يحدث النسبة والحالة.
5. إذا يوجد عائق، يكتبه.
6. Project Manager يرى العوائق والقرارات.
7. Executive يرى المؤشرات.

## أول إصدار مقترح

اسم الإصدار:
`v0.1 Operational MVP`

المدة المتوقعة:
2 إلى 4 أسابيع تطوير فعلي حسب جاهزية البيانات وحسابات Supabase/Auth.

## ترتيب البناء

1. Project setup.
2. Database schema.
3. Auth.
4. WBS import.
5. Tasks list/detail.
6. Daily update form.
7. Audit log.
8. Basic dashboard.
9. Risks and decisions basic screens.
10. Security review.

