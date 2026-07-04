# مركز الاعتمادات

## الهدف

مركز الاعتمادات يفصل طلبات الاعتماد عن القرارات والمخاطر، حتى يكون لكل اعتماد سجل واضح ومسؤول واستحقاق وحالة.

## اسم الشيت

ينشئ Apps Script شيت مستقل باسم:

`Approvals Register`

## الأعمدة

| العمود | الوصف |
| --- | --- |
| `approval_id` | رقم الاعتماد مثل `APP-001` |
| `linked_wbs_code` | كود المهمة أو المسار المرتبط |
| `type` | اعتماد، مراجعة، توقيع، تعميد |
| `title` | عنوان الاعتماد المطلوب |
| `requester` | طالب الاعتماد |
| `approver` | صاحب الاعتماد |
| `due_date` | تاريخ الاستحقاق |
| `status` | مطلوب، قيد المراجعة، معتمد، مرفوض، متأخر |
| `notes` | ملاحظات مختصرة |
| `created_at` | تاريخ الإنشاء |
| `updated_at` | آخر تحديث |

## الربط مع الداشبورد

عند نشر Apps Script كـ Web App، يرجع `doGet` البيانات بهذا الشكل:

```json
{
  "rows": [],
  "approvals": []
}
```

الداشبورد يقرأ `approvals` ويعرضها في صفحة `مركز الاعتمادات`.

## إرسال طلب اعتماد جديد

```bash
curl -X POST "WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action":"approval_request",
    "linked_wbs_code":"WBS-001",
    "type":"اعتماد",
    "title":"اعتماد مخطط التشغيل",
    "requester":"PMO",
    "approver":"مدير المشروع",
    "due_date":"2026-07-10",
    "status":"مطلوب",
    "notes":"يرتبط بمسار التشغيل"
  }'
```

## تحديث حالة اعتماد

```bash
curl -X POST "WEB_APP_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "action":"approval_update",
    "approval_id":"APP-001",
    "status":"معتمد",
    "approver":"مدير المشروع",
    "notes":"تم الاعتماد"
  }'
```

كل طلب أو تحديث يتم إرساله إلى Slack ويضاف إلى `Audit Log`.
