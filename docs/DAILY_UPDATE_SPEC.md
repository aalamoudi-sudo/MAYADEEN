# Daily Update Specification

## الهدف

تعريف طريقة إدخال التحديثات اليومية على المهام، وكيف تتحول هذه التحديثات إلى مؤشرات تشغيلية وسجل تدقيق.

## Data Contract

```json
{
  "task_id": "uuid",
  "user_id": "uuid",
  "percent_complete": 35,
  "progress_status": "in_progress",
  "update_summary": "تم إنهاء مراجعة التصاميم الأولية",
  "blocker": "",
  "next_action": "إرسال النسخة للمالك للاعتماد",
  "next_update_due": "2026-07-04",
  "needs_decision": false,
  "needs_escalation": false
}
```

## Required Fields

- `task_id`
- `user_id`
- `percent_complete`
- `progress_status`
- `update_summary`

## Optional Fields

- `blocker`
- `next_action`
- `next_update_due`
- `needs_decision`
- `needs_escalation`

## Validation Rules

### Percent Complete

- يجب أن يكون بين 0 و100.
- إذا `progress_status = completed` يجب أن يساوي 100.
- إذا `progress_status = not_started` يجب أن يساوي 0.
- لا يسمح بانخفاض النسبة إلا بصلاحية PMO أو Project Manager.

### Progress Status

القيم المقبولة:

- `not_started`
- `in_progress`
- `completed`
- `blocked`
- `cancelled`

### Update Summary

- مطلوب.
- الحد الأدنى المقترح: 10 أحرف.
- يجب ألا يكون مجرد نقطة أو كلمة عامة مثل "تم".

### Blocker

إذا `progress_status = blocked`:

- `blocker` مطلوب.
- `next_action` مطلوب.

### Next Update Due

- مطلوب إذا المهمة ليست مكتملة أو ملغاة.
- يجب ألا يكون في الماضي.

## Side Effects

عند حفظ تحديث يومي:

1. يتم إنشاء صف في `task_updates`.
2. يتم تحديث `tasks.percent_complete`.
3. يتم تحديث `tasks.progress_status`.
4. يتم تحديث `tasks.last_update_at`.
5. يتم إعادة حساب `tasks.schedule_status`.
6. يتم إنشاء صف في `audit_logs`.
7. إذا يوجد عائق، تظهر المهمة في مركز العوائق.
8. إذا `needs_decision = true` تظهر في قائمة قرارات مقترحة.

## Audit Log Event

نوع الحدث:

`task_update_created`

الحقول:

- `actor_id`
- `entity_type = task`
- `entity_id = task_id`
- `action = task_update_created`
- `before_json`
- `after_json`
- `reason = daily_update`

## Stale Task Logic

المهمة تعتبر stale إذا:

- ليست مكتملة.
- ليست ملغاة.
- `last_update_at` فارغ، أو أقدم من 3 أيام.
- تاريخ البداية المخطط بدأ أو قريب خلال 7 أيام.

## Blocked Task Logic

المهمة تعتبر blocked إذا:

- آخر تحديث لها `progress_status = blocked`
- أو لديها blocker مفتوح.

## Daily Queue Sorting

ترتيب قائمة المهام اليومية:

1. critical
2. overdue
3. blocked
4. due_soon
5. stale
6. in_progress
7. not_started

## Notifications في مرحلة لاحقة

لا يتم إرسال تنبيهات خارجية في MVP. فقط تظهر داخل النظام.

في مرحلة لاحقة:

- Email للمهام الحرجة.
- Teams/Slack للقرارات.
- WhatsApp للعناصر عالية الأهمية فقط.

