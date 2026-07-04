# Phase 3: Daily Control

## الهدف

بناء مركز التحديث اليومي ليصبح KAG Command Center نظام تشغيل فعلياً، وليس مجرد لوحة مؤشرات. هذه المرحلة تجعل كل مسؤول يدخل تحديثاً واضحاً على مهامه، وتوفر للـ PMO وProject Manager رؤية فورية للمهام الراكدة والعوائق.

## لماذا هذه المرحلة مهمة

بدون Daily Control:

- لا نعرف الإنجاز الحقيقي.
- لا نعرف من حدث ومتى.
- لا يمكن التفريق بين مهمة متأخرة ومهمة مكتملة.
- لا يوجد سجل عوائق أو إجراءات قادمة.

مع Daily Control:

- كل مهمة لها آخر تحديث.
- كل تحديث له صاحب ووقت.
- العوائق تظهر مبكراً.
- الإدارة ترى ما يحتاج تدخلاً.
- Audit Log يبدأ يعطي ثقة تشغيلية.

## تبويب مركز التحديث اليومي

### المستخدم: Workstream Owner

يرى:

- مهامي المتأخرة.
- مهامي المستحقة خلال 7 أيام.
- مهامي التي لم تحدث منذ 3 أيام.
- مهامي قيد التنفيذ.
- نموذج تحديث سريع.

### المستخدم: PMO

يرى:

- كل المهام دون تحديث.
- كل المسؤولين المتأخرين في التحديث.
- جودة الالتزام بالتحديث.
- تقرير يومي للمتابعة.

### المستخدم: Project Manager

يرى:

- عوائق مفتوحة.
- مهام حرجة.
- مهام تحتاج قرار.
- مهام تحتاج تصعيد.

## نموذج التحديث اليومي

الحقول:

- `task_id`
- `user_id`
- `percent_complete`
- `progress_status`
- `update_summary`
- `blocker`
- `next_action`
- `next_update_due`
- `needs_decision`
- `needs_escalation`
- `created_at`

## حالات التحديث

### not_started

لم تبدأ المهمة.

### in_progress

بدأ العمل.

### completed

اكتملت المهمة ويجب أن تكون نسبة الإنجاز 100.

### blocked

المهمة متوقفة بسبب عائق.

### cancelled

ألغيت المهمة بقرار رسمي.

## قواعد تشغيلية

- إذا `progress_status = completed` يجب أن تكون `percent_complete = 100`.
- إذا `percent_complete > 0` و`progress_status = not_started` يتم رفض التحديث.
- إذا يوجد `blocker` غير فارغ، تظهر المهمة في مركز العوائق.
- إذا `needs_decision = true` يتم إنشاء قرار أو اقتراح قرار.
- إذا لم تحدث المهمة خلال 3 أيام وهي قيد التنفيذ، تصبح `stale`.
- إذا انتهى تاريخ المهمة ولم تكتمل، تصبح `overdue` أو `critical`.

## مؤشرات Daily Control

- Tasks Updated Today
- Tasks Updated This Week
- Stale Tasks
- Blocked Tasks
- Updates Compliance
- Owners With No Updates
- Critical Tasks Needing PM Action

## رحلة العمل اليومية

1. المسؤول يفتح مركز التحديث اليومي.
2. يرى مهامه مرتبة حسب الأولوية.
3. يختار مهمة.
4. يدخل نسبة الإنجاز والحالة.
5. يكتب ملخص التحديث.
6. إذا يوجد عائق، يكتبه.
7. يحدد الإجراء القادم.
8. النظام يحفظ `task_update`.
9. النظام يحدث `tasks.last_update_at`.
10. النظام يكتب `audit_logs`.

## مخرجات Phase 3

- `DAILY_CONTROL.md`
- `DAILY_UPDATE_SPEC.md`
- `database/phase3_daily_control.sql`
- `scripts/build_daily_queue.py`
- `data/daily_control_queue.csv`
- `data/daily_control_report.json`
- `PHASE3_SUMMARY.md`

