# Decision, Risk, and Approval Specification

## الهدف

تحديد طريقة بناء سجلات القرارات والمخاطر والاعتمادات من بيانات Daily Control، ثم إدارتها لاحقاً داخل التطبيق.

## Input

المصدر الأساسي:

- `data/daily_control_queue.csv`

الحقول المستخدمة:

- `queue_bucket`
- `wbs_code`
- `title`
- `phase`
- `owner_name`
- `planned_finish`
- `relative_due`
- `schedule_status`
- `required_action`

## Risk Generation

### Rule R1: Critical Task Risk

إذا:

- `queue_bucket = critical`

ينشأ risk:

- category: `schedule`
- probability: `5`
- impact: `4`
- status: `submitted`
- treatment_plan: `تصعيد فوري وتحديث خطة التعافي`

### Rule R2: Overdue Task Risk

إذا:

- `queue_bucket = overdue`

ينشأ risk:

- category: `schedule`
- probability: `4`
- impact: `3`
- status: `draft`

### Rule R3: Stale Task Risk

إذا:

- `queue_bucket = stale`

لا ينشأ risk تلقائياً، لكنه يظهر في report كـ monitoring item.

## Decision Generation

### Rule D1: Critical Escalation Decision

إذا:

- `queue_bucket = critical`

ينشأ decision:

- priority: `urgent`
- status: `submitted`
- decision_owner: `مدير المشروع`
- impact_if_delayed: `استمرار التأخير قد يؤثر على المسار الزمني`

### Rule D2: Approval Keyword Decision

إذا احتوى العنوان على:

- `اعتماد`
- `تعميد`
- `موافقة`
- `اختيار`
- `Go/No-Go`

ينشأ decision إذا لم يكن موجوداً كاعتماد فقط.

## Approval Generation

### Rule A1: Approval Keywords

إذا احتوى العنوان على:

- `اعتماد`
- `تعميد`
- `موافقة`

ينشأ approval:

- type: `approval`
- status: `draft`

### Rule A2: Review Keywords

إذا احتوى العنوان على:

- `مراجعة`
- `اختيار`

ينشأ approval:

- type: `review`
- status: `draft`

### Rule A3: Contract Keywords

إذا احتوى العنوان على:

- `توقيع`
- `عقد`
- `عقود`

ينشأ approval:

- type: `contract`
- status: `draft`

## Deduplication

المفتاح المقترح:

- `linked_wbs_code + register_type`

لا يتم توليد أكثر من سجل من نفس النوع لنفس المهمة.

## Output CSV Fields

### risks_register.csv

- `risk_id`
- `linked_wbs_code`
- `title`
- `category`
- `probability`
- `impact`
- `severity`
- `owner_name`
- `treatment_plan`
- `due_date`
- `status`

### decisions_register.csv

- `decision_id`
- `linked_wbs_code`
- `title`
- `reason`
- `decision_owner`
- `priority`
- `due_date`
- `status`
- `impact_if_delayed`

### approvals_register.csv

- `approval_id`
- `linked_wbs_code`
- `type`
- `title`
- `requester`
- `approver`
- `due_date`
- `status`
- `notes`

## Human Review Required

كل السجلات الناتجة في Phase 4 تعتبر initial draft أو submitted suggestion. يجب على PMO أو Project Manager مراجعتها قبل اعتمادها في النظام.

