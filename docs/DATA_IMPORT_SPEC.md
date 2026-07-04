# KAG Data Import Specification

## الهدف

تحديد طريقة استيراد WBS من ملف HTML الحالي أو أي CSV/JSON لاحق إلى قاعدة بيانات KAG Command Center.

## مصادر الاستيراد المدعومة في Phase 2

1. `KAG_Dashboard_Final.html`
2. `data/wbs_raw.json`
3. `data/wbs_tasks.csv`
4. `data/wbs_milestones.csv`

## هيكل JSON القياسي

```json
{
  "generated": "2026-06-28 23:41",
  "rows": [
    {
      "row_type": "Task",
      "wbs_code": "1.001",
      "title": "...",
      "phase": "البدء",
      "owner_name": "مدير المشروع",
      "planned_start": "2026-06-07",
      "planned_finish": "2026-06-15",
      "notes": "",
      "baseline_start": "2026-06-07",
      "baseline_finish": "2026-06-15",
      "actual_start": "",
      "actual_finish": "",
      "percent_complete": 0,
      "progress_status": "not_started",
      "schedule_status": "overdue"
    }
  ]
}
```

## Mapping إلى قاعدة البيانات

### tasks

| Import Field | Database Field |
|---|---|
| wbs_code | tasks.wbs_code |
| title | tasks.title |
| phase | tasks.phase |
| owner_name | resolved to tasks.owner_id |
| planned_start | tasks.planned_start |
| planned_finish | tasks.planned_finish |
| baseline_start | tasks.baseline_start |
| baseline_finish | tasks.baseline_finish |
| actual_start | tasks.actual_start |
| actual_finish | tasks.actual_finish |
| percent_complete | tasks.percent_complete |
| progress_status | tasks.progress_status |
| schedule_status | tasks.schedule_status |
| notes | tasks.description |

### workstreams

في المرحلة الحالية لا يوجد workstream صريح. يمكن استنتاجه لاحقاً من:

- رقم WBS الرئيسي.
- أو phase.
- أو ملف mapping منفصل.

الاقتراح الأولي:

- كل milestone رئيسي برقم صحيح مثل `1`, `2`, `3` يصبح workstream.
- كل task مثل `1.001` يرتبط بـ workstream رقم `1`.

## Validation Rules

### Required

- `row_type`
- `wbs_code`
- `title`

### Dates

- التاريخ المقبول: `YYYY-MM-DD`.
- إذا كان `planned_start` موجوداً و`planned_finish` موجوداً، يجب ألا يكون finish قبل start.

### Uniqueness

- `wbs_code` يجب أن يكون فريداً داخل المشروع.

### Progress

- `percent_complete` بين 0 و100.
- إذا `actual_finish` موجود، يمكن اعتبار `progress_status = completed`.
- إذا `progress_status = completed` يجب أن تكون `percent_complete = 100`.

## Owner Resolution

في Phase 2، `owner_name` يبقى نصاً.

في Phase 3:

1. يبحث النظام عن profile بنفس الاسم أو البريد.
2. إذا لم يجد، ينشئ placeholder profile أو يطلب mapping يدوي.
3. لا يتم حذف owner_name الأصلي حتى بعد الربط.

## Import Modes

### Preview Mode

لا يكتب في قاعدة البيانات. يعرض:

- عدد الصفوف.
- عدد المهام.
- عدد المعالم.
- الأخطاء.
- التحذيرات.

### Commit Mode

يكتب في قاعدة البيانات:

- creates/updates workstreams.
- creates/updates tasks.
- writes audit log.

## Upsert Strategy

المفتاح:

- `project_id + wbs_code`

إذا موجود:

- يحدث الحقول التخطيطية فقط إذا المستخدم أكد overwrite.

إذا غير موجود:

- ينشئ task جديد.

## Data Quality Score

المعادلة الأولية:

```text
score = 100 - critical_errors * 10 - warnings * 2
minimum = 0
maximum = 100
```

مستويات الجودة:

- 90-100: ممتاز
- 75-89: جيد
- 50-74: يحتاج تنظيف
- أقل من 50: غير جاهز للاستيراد

## Audit Requirements

كل عملية import يجب أن تسجل:

- actor.
- source file.
- generated timestamp.
- rows count.
- created count.
- updated count.
- rejected count.
- validation report.

## Phase 2 Output Contract

أي سكربت استخراج يجب أن ينتج:

- raw normalized JSON.
- tasks CSV.
- milestones CSV.
- data quality report.

