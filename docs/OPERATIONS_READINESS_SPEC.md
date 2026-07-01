# Operations Readiness Specification

## مصادر البيانات

يعتمد تقرير الجاهزية على:

- `data/executive_snapshot.json`
- `data/daily_control_report.json`
- `data/control_registers_report.json`
- `data/data_quality_report.json`

## مخرجات السكربت

ينتج السكربت:

- `data/operations_readiness_checklist.csv`
- `data/operations_room_report.json`
- `data/go_no_go_report.md`

## منطق القرار

### No-Go

يصدر القرار No-Go عند وجود أي من التالي:

- مهام حرجة مفتوحة أكبر من صفر.
- مخاطر حرجة مفتوحة أكبر من صفر.
- قرارات عاجلة معلقة أكبر من صفر.
- جودة بيانات أقل من 80.

### Conditional Go

يصدر القرار Conditional Go عند:

- عدم وجود blockers حرجة.
- وجود اعتمادات أو تحديثات متأخرة لكنها لا توقف الإطلاق.
- درجة الجاهزية بين 70 و 89.

### Go

يصدر القرار Go عند:

- عدم وجود blockers حرجة.
- درجة الجاهزية 90 أو أعلى.
- جميع محاور الجاهزية Ready.

## محاور الجاهزية

| المحور | القياس | الحالة المقبولة |
|---|---:|---|
| Schedule Recovery | المهام الحرجة | 0 |
| Risk Closure | المخاطر الحرجة | 0 |
| Decision Closure | القرارات العاجلة | 0 |
| Approval Cleanup | الاعتمادات المفتوحة | أقل من 25 أو لها خطة |
| Daily Control | المهام stale | أقل من 10% |
| Data Quality | جودة البيانات | 90 أو أعلى |
| Operations Setup | غرفة العمليات | جاهزة قبل التشغيل |

## حساب الدرجة

تبدأ درجة الجاهزية من 100 ثم تخصم:

- 4 نقاط لكل مهمة حرجة، بحد أقصى 28.
- 4 نقاط لكل خطر حرج، بحد أقصى 28.
- 3 نقاط لكل قرار عاجل، بحد أقصى 21.
- 10 نقاط إذا الاعتمادات المفتوحة أكثر من 100.
- 8 نقاط إذا المهام stale أكثر من 25% من إجمالي المهام.
- 20 نقطة إذا جودة البيانات أقل من 80.

الحد الأدنى للدرجة هو 0.

## الحقول المطلوبة

### Readiness Checklist

- `check_id`
- `category`
- `title`
- `owner`
- `status`
- `evidence`
- `required_action`
- `source_metric`

### Operations Room Report

- `generated_at`
- `go_no_go_status`
- `readiness_score`
- `blockers`
- `metrics`
- `required_actions`
- `next_review`

## حدود النسخة الحالية

هذه النسخة تبني تقرير جاهزية من البيانات المتوفرة حالياً. عند الانتقال إلى تطبيق فعلي، يجب ربطها بجداول قاعدة البيانات الحية وRealtime notifications.
