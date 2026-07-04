# Phase 2: Data Foundation

## الهدف

تحويل بيانات WBS الحالية من بيانات مدمجة داخل HTML إلى ملفات منظمة قابلة للاستيراد في قاعدة البيانات، مع قاموس بيانات واضح وقواعد جودة تمنع المؤشرات المضللة.

## حالة البيانات الحالية

مصدر البيانات الحالي:

- `KAG_Dashboard_Final.html`
- داخل ثابت JavaScript باسم `EMBEDDED`

حجم البيانات:

- إجمالي الصفوف: 486
- المهام: 452
- المعالم: 34

الحقول الحالية:

- `type`
- `code`
- `name`
- `phase`
- `owner`
- `start`
- `end`
- `notes`

الفجوات:

- لا يوجد `status`.
- لا يوجد `percent_complete`.
- لا يوجد `actual_start`.
- لا يوجد `actual_finish`.
- لا يوجد `baseline_start`.
- لا يوجد `baseline_finish`.
- لا يوجد `last_update_at`.
- لا يوجد `updated_by`.
- لا يوجد task id ثابت غير `code`.

## مبدأ التحويل

البيانات الحالية تصلح كـ WBS أولي، لكنها لا تصلح وحدها لتحديد الإنجاز الفعلي.

القواعد:

- `code` يصبح `wbs_code` وليس primary key.
- كل صف يحصل على `id` داخلي لاحقاً في قاعدة البيانات.
- `start` و`end` الحالية تحفظ كـ `planned_start` و`planned_finish`.
- في أول import يمكن نسخها أيضاً إلى `baseline_start` و`baseline_finish`.
- `actual_start` و`actual_finish` تبقى فارغة حتى يحدثها المستخدم.
- `percent_complete` يبدأ بـ `0`.
- `progress_status` يبدأ حسب التاريخ فقط كتقدير، وليس كحقيقة إنجاز.

## قاموس بيانات WBS

| Current Field | Target Field | Required | Notes |
|---|---|---:|---|
| type | row_type | Yes | `Task` أو `Milestone` |
| code | wbs_code | Yes | فريد داخل المشروع |
| name | title | Yes | اسم المهمة أو المعلم |
| phase | phase | No | PMBOK phase |
| owner | owner_name | No | يطابق لاحقاً profile/user |
| start | planned_start | No | تاريخ مخطط |
| end | planned_finish | No | تاريخ مخطط |
| notes | notes | No | ملاحظات أو عدد المهام |

## أعمدة التشغيل المطلوبة

هذه الأعمدة يجب إضافتها في قاعدة البيانات أو ملف الاستيراد المطور:

- `baseline_start`
- `baseline_finish`
- `actual_start`
- `actual_finish`
- `percent_complete`
- `progress_status`
- `schedule_status`
- `priority`
- `last_update_at`
- `updated_by`
- `workstream`
- `dependency_codes`

## حالات الإنجاز

`progress_status`:

- `not_started`
- `in_progress`
- `completed`
- `blocked`
- `cancelled`

قاعدة مهمة:

لا تتحول المهمة إلى `completed` بسبب انتهاء التاريخ فقط.

## حالات الجدول الزمني

`schedule_status`:

- `on_track`
- `due_soon`
- `overdue`
- `critical`
- `no_dates`

المنطق الأولي:

- لا تاريخ بداية أو نهاية: `no_dates`
- تاريخ النهاية قبل اليوم والمهمة غير مكتملة: `overdue`
- تاريخ النهاية خلال 7 أيام والمهمة غير مكتملة: `due_soon`
- مهمة متأخرة أكثر من 14 يوم: `critical`
- غير ذلك: `on_track`

## قواعد جودة البيانات

### أخطاء حرجة

- `wbs_code` فارغ.
- `title` فارغ.
- تكرار `wbs_code` داخل المشروع.
- `planned_finish` قبل `planned_start`.
- تاريخ غير قابل للقراءة.

### تحذيرات

- `owner_name` فارغ.
- `phase` فارغ لمهمة.
- `planned_start` فارغ.
- `planned_finish` فارغ.
- `notes` يحتوي عدد مهام في صف معلم ولا يطابق عدد المهام الفعلية تحته.

## مخرجات Phase 2

سيتم إنتاج الملفات التالية:

- `data/wbs_raw.json`
- `data/wbs_tasks.csv`
- `data/wbs_milestones.csv`
- `data/data_quality_report.json`
- `scripts/extract_wbs.py`
- `DATA_IMPORT_SPEC.md`

## معيار نجاح Phase 2

تعتبر المرحلة مكتملة عندما:

1. يتم استخراج WBS من HTML إلى JSON.
2. يتم فصل المهام والمعالم إلى CSV.
3. يتم توليد تقرير جودة البيانات.
4. تكون البيانات جاهزة للاستيراد في قاعدة البيانات.
5. يتم توثيق mapping من HTML إلى schema الجديد.

