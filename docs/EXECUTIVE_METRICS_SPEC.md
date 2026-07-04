# Executive Metrics Specification

## الهدف

تحديد مؤشرات القيادة التنفيذية وكيفية حسابها من ملفات البيانات الحالية.

## Input Files

- `data/wbs_tasks.csv`
- `data/daily_control_queue.csv`
- `data/risks_register.csv`
- `data/decisions_register.csv`
- `data/approvals_register.csv`
- `data/data_quality_report.json`

## Snapshot Contract

```json
{
  "snapshot_date": "2026-07-01",
  "overall": {
    "health_score": 50,
    "health_status": "red",
    "completion_pct": 0
  },
  "schedule": {
    "total_tasks": 452,
    "critical": 9,
    "stale": 241,
    "not_started": 202
  },
  "risks": {
    "open": 9,
    "critical": 9,
    "severity_total": 180
  },
  "decisions": {
    "urgent": 9,
    "submitted": 9
  },
  "approvals": {
    "total": 197,
    "contract": 9,
    "review": 9,
    "approval": 179
  },
  "data_quality": {
    "score": 100,
    "errors": 0,
    "warnings": 0
  }
}
```

## Metric Definitions

### completion_pct

```text
average(percent_complete)
```

في المرحلة الحالية غالباً 0 لأن التحديثات اليومية لم تدخل بعد.

### critical_tasks

عدد عناصر `daily_control_queue.csv` حيث:

```text
queue_bucket = critical
```

### stale_tasks

عدد عناصر `daily_control_queue.csv` حيث:

```text
queue_bucket = stale
```

### open_risks

عدد سجلات `risks_register.csv` حيث:

```text
status != closed
```

### critical_risks

عدد سجلات المخاطر حيث:

```text
severity >= 20
```

### urgent_decisions

عدد سجلات القرارات حيث:

```text
priority = urgent
```

### pending_approvals

عدد الاعتمادات حيث:

```text
status in draft, submitted, under_review, escalated
```

## Health Score Formula

```text
score = 100
score -= critical_tasks * 3
score -= open_risks * 2
score -= urgent_decisions * 2
score -= data_quality_errors * 5
score = clamp(score, 0, 100)
```

## Health Status

- `green`: score >= 85
- `amber`: score >= 65 and score < 85
- `red`: score < 65

## Executive Action Rules

### Rule E1: Critical Tasks

إذا critical_tasks > 0:

الإجراء:
`تحديث فوري لخطة التعافي للمهام الحرجة`

### Rule E2: Urgent Decisions

إذا urgent_decisions > 0:

الإجراء:
`عقد مراجعة قرارات عاجلة مع مدير المشروع`

### Rule E3: Pending Approvals

إذا pending_approvals > 50:

الإجراء:
`تنظيف سجل الاعتمادات وتحديد الاعتمادات المؤثرة فقط`

### Rule E4: Data Quality

إذا data_quality_score < 90:

الإجراء:
`تنظيف البيانات قبل اعتماد التقرير التنفيذي`

## Report Sections

التقرير التنفيذي يجب أن يحتوي:

1. Executive Summary.
2. Health Score.
3. Schedule Status.
4. Risk and Decision Pressure.
5. Approval Load.
6. Top Intervention Items.
7. Next Recommended Actions.

