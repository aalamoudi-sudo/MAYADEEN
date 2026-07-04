# Phase 4: Decisions, Risks, and Approvals

## الهدف

تحويل العوائق والتأخيرات من مجرد مؤشرات إلى عناصر تحكم رسمية:

- Risk Register
- Decision Center
- Approval Center

هذه المرحلة تجعل كل تأخير أو عائق له مالك، أثر، موعد، ومسار معالجة.

## لماذا هذه المرحلة مهمة

في Phase 3 عرفنا المهام الحرجة والمهام التي تحتاج تحديث. في Phase 4 نحول هذه المعرفة إلى إدارة:

- المهام الحرجة تصبح مخاطر.
- المهام المتأخرة أو المتوقفة قد تحتاج قرارات.
- المهام التي اسمها يحتوي اعتماد أو تعميد تصبح عناصر في مركز الاعتمادات.

## مركز القرارات

### متى ينشأ قرار؟

ينشأ قرار مبدئي إذا:

- المهمة حرجة وتحتاج تدخل من مدير المشروع أو الجهة المالكة.
- المهمة متأخرة ويظهر أن سبب التأخير قد يحتاج موافقة.
- المهمة مرتبطة باعتماد أو اختيار أو Go/No-Go.

### حقول القرار

- `decision_id`
- `linked_wbs_code`
- `title`
- `reason`
- `decision_owner`
- `priority`
- `due_date`
- `status`
- `impact_if_delayed`

### الأولويات

- `urgent`: يؤثر على المسار أو الافتتاح.
- `high`: يؤثر على فريق أو مخرج مهم.
- `medium`: يحتاج متابعة.
- `low`: توثيق فقط.

## سجل المخاطر

### متى ينشأ خطر؟

ينشأ خطر مبدئي إذا:

- المهمة `critical`.
- المهمة overdue.
- المهمة ضمن مسار قريب من الافتتاح.
- المهمة بلا تحديث مع تاريخ بداية قريب.

### حقول الخطر

- `risk_id`
- `linked_wbs_code`
- `title`
- `category`
- `probability`
- `impact`
- `severity`
- `owner`
- `treatment_plan`
- `due_date`
- `status`

### تصنيف المخاطر

- schedule
- operational
- technical
- supplier
- stakeholder
- financial
- safety
- other

## مركز الاعتمادات

### متى ينشأ اعتماد؟

ينشأ اعتماد مبدئي إذا احتوى اسم المهمة على كلمات مثل:

- اعتماد
- تعميد
- موافقة
- مراجعة
- اختيار
- توقيع

### حقول الاعتماد

- `approval_id`
- `linked_wbs_code`
- `type`
- `title`
- `requester`
- `approver`
- `due_date`
- `status`
- `notes`

## قواعد التوليد الأولي

هذه القواعد ليست بديلاً عن إدارة بشرية، لكنها تساعد على بناء سجل أولي:

1. كل مهمة critical تولد risk.
2. كل مهمة critical تولد decision مقترح إذا كانت تحتاج تصعيد.
3. كل مهمة تحتوي كلمة اعتماد أو تعميد تولد approval.
4. كل مهمة تحتوي توقيع تولد approval من نوع contract.
5. كل مهمة تحتوي اختيار أو مراجعة تولد approval من نوع review.

## حالات السجلات

### decision.status

- draft
- submitted
- under_review
- approved
- rejected
- escalated
- closed

### risk.status

- draft
- submitted
- under_review
- approved
- closed

### approval.status

- draft
- submitted
- under_review
- approved
- rejected
- closed

## مخرجات Phase 4

- `DECISIONS_RISKS_APPROVALS.md`
- `DECISION_RISK_APPROVAL_SPEC.md`
- `database/phase4_decisions_risks_approvals.sql`
- `scripts/build_control_registers.py`
- `data/risks_register.csv`
- `data/decisions_register.csv`
- `data/approvals_register.csv`
- `data/control_registers_report.json`
- `PHASE4_SUMMARY.md`

