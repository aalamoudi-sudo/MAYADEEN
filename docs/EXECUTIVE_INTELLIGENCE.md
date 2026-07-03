# Phase 5: Executive Intelligence

## الهدف

تحويل بيانات WBS وقائمة العمل اليومية والمخاطر والقرارات والاعتمادات إلى مؤشرات تنفيذية قابلة للتفسير والتتبع.

## مبدأ المرحلة

لا نعرض رقم تنفيذي إلا إذا كان مصدره واضحاً:

- المهام من `wbs_tasks.csv`
- الأولويات اليومية من `daily_control_queue.csv`
- المخاطر من `risks_register.csv`
- القرارات من `decisions_register.csv`
- الاعتمادات من `approvals_register.csv`
- جودة البيانات من `data_quality_report.json`

## المؤشرات التنفيذية الأساسية

### 1. Overall Completion

نسبة الإنجاز الحالية.

في المرحلة الحالية تبدأ من `percent_complete` في WBS المستخرج. بما أن البيانات لا تحتوي على تحديثات فعلية، ستكون النسبة 0 حتى تبدأ Phase 3 في استقبال تحديثات حقيقية.

### 2. Schedule Health

صحة الجدول:

- Critical tasks.
- Overdue tasks.
- Due soon tasks.
- On track tasks.

### 3. Risk Exposure

مستوى التعرض للمخاطر:

- عدد المخاطر المفتوحة.
- عدد المخاطر الحرجة.
- مجموع severity.
- أعلى 5 مخاطر.

### 4. Decision Pressure

ضغط القرارات:

- قرارات عاجلة.
- قرارات متأخرة.
- قرارات تحتاج المالك.

### 5. Approval Load

حجم الاعتمادات:

- إجمالي الاعتمادات.
- عقود.
- مراجعات.
- اعتمادات عامة.

### 6. Daily Control Compliance

الالتزام بالتحديث:

- مهام تحتاج تحديث.
- مهام حرجة.
- مسؤولون لديهم أعلى حمل.

### 7. Data Quality

جودة البيانات:

- score.
- أخطاء.
- تحذيرات.
- فجوات تشغيلية.

## Executive Health Score

درجة تنفيذية من 100.

المعادلة الأولية:

```text
score = 100
  - critical_tasks * 3
  - open_risks * 2
  - urgent_decisions * 2
  - data_quality_errors * 5
```

الحد الأدنى 0 والحد الأعلى 100.

## Executive Status

- 85-100: Green
- 65-84: Amber
- أقل من 65: Red

## Executive Narrative

يجب أن يخرج التقرير التنفيذي بثلاث جمل واضحة:

1. أين يقف المشروع الآن؟
2. ما أهم ما يحتاج تدخل؟
3. ما القرار أو الإجراء القادم؟

## مخرجات Phase 5

- `EXECUTIVE_INTELLIGENCE.md`
- `EXECUTIVE_METRICS_SPEC.md`
- `database/phase5_executive_intelligence.sql`
- `scripts/build_executive_snapshot.py`
- `data/executive_snapshot.json`
- `data/executive_report.md`
- `PHASE5_SUMMARY.md`

