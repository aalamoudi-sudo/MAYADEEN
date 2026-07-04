#!/usr/bin/env python3
import argparse
import csv
import json
from collections import Counter
from datetime import date, datetime
from pathlib import Path


def read_csv(path):
    p = Path(path)
    if not p.exists():
        return []
    with p.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def read_json(path, default):
    p = Path(path)
    if not p.exists():
        return default
    return json.loads(p.read_text(encoding="utf-8"))


def to_number(value, default=0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def health_status(score):
    if score >= 85:
        return "green"
    if score >= 65:
        return "amber"
    return "red"


def clamp(n, low=0, high=100):
    return max(low, min(high, n))


def build_snapshot(args):
    tasks = read_csv(args.tasks)
    queue = read_csv(args.queue)
    risks = read_csv(args.risks)
    decisions = read_csv(args.decisions)
    approvals = read_csv(args.approvals)
    quality = read_json(args.quality, {"quality": {"score": 0, "errors_count": 0, "warnings_count": 0}})

    completion = round(sum(to_number(t.get("percent_complete")) for t in tasks) / len(tasks), 2) if tasks else 0
    queue_buckets = Counter(q.get("queue_bucket") for q in queue)
    open_risks = [r for r in risks if r.get("status") != "closed"]
    critical_risks = [r for r in open_risks if to_number(r.get("severity")) >= 20]
    urgent_decisions = [d for d in decisions if d.get("priority") == "urgent" and d.get("status") != "closed"]
    submitted_decisions = [d for d in decisions if d.get("status") == "submitted"]
    pending_approvals = [a for a in approvals if a.get("status") in ("draft", "submitted", "under_review", "escalated")]
    approval_types = Counter(a.get("type") for a in pending_approvals)
    quality_info = quality.get("quality", {})

    score = 100
    score -= queue_buckets.get("critical", 0) * 3
    score -= len(open_risks) * 2
    score -= len(urgent_decisions) * 2
    score -= int(quality_info.get("errors_count", 0)) * 5
    score = clamp(score)

    actions = []
    if queue_buckets.get("critical", 0):
        actions.append("تحديث فوري لخطة التعافي للمهام الحرجة")
    if urgent_decisions:
        actions.append("عقد مراجعة قرارات عاجلة مع مدير المشروع")
    if len(pending_approvals) > 50:
        actions.append("تنظيف سجل الاعتمادات وتحديد الاعتمادات المؤثرة فقط")
    if int(quality_info.get("score", 0)) < 90:
        actions.append("تنظيف البيانات قبل اعتماد التقرير التنفيذي")
    if not actions:
        actions.append("استمرار المتابعة الدورية")

    snapshot = {
        "snapshot_date": args.date,
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "overall": {
            "health_score": score,
            "health_status": health_status(score),
            "completion_pct": completion,
        },
        "schedule": {
            "total_tasks": len(tasks),
            "critical": queue_buckets.get("critical", 0),
            "overdue": queue_buckets.get("overdue", 0),
            "due_soon": queue_buckets.get("due_soon", 0),
            "stale": queue_buckets.get("stale", 0),
            "not_started": queue_buckets.get("not_started", 0),
        },
        "risks": {
            "open": len(open_risks),
            "critical": len(critical_risks),
            "severity_total": int(sum(to_number(r.get("severity")) for r in open_risks)),
            "top": open_risks[:5],
        },
        "decisions": {
            "urgent": len(urgent_decisions),
            "submitted": len(submitted_decisions),
            "top": urgent_decisions[:5],
        },
        "approvals": {
            "total": len(pending_approvals),
            "by_type": dict(approval_types),
            "sample": pending_approvals[:5],
        },
        "data_quality": {
            "score": quality_info.get("score", 0),
            "errors": quality_info.get("errors_count", 0),
            "warnings": quality_info.get("warnings_count", 0),
        },
        "recommended_actions": actions,
    }
    return snapshot


def write_report(path, snapshot):
    status_ar = {
        "green": "أخضر",
        "amber": "أصفر",
        "red": "أحمر",
    }.get(snapshot["overall"]["health_status"], snapshot["overall"]["health_status"])

    lines = [
        "# KAG Executive Report",
        "",
        f"تاريخ اللقطة: `{snapshot['snapshot_date']}`",
        "",
        "## الملخص التنفيذي",
        "",
        f"- الحالة التنفيذية: **{status_ar}**",
        f"- درجة الصحة: **{snapshot['overall']['health_score']} / 100**",
        f"- نسبة الإنجاز الحالية: **{snapshot['overall']['completion_pct']}%**",
        f"- المهام الحرجة: **{snapshot['schedule']['critical']}**",
        f"- المخاطر المفتوحة: **{snapshot['risks']['open']}**",
        f"- القرارات العاجلة: **{snapshot['decisions']['urgent']}**",
        f"- الاعتمادات المعلقة: **{snapshot['approvals']['total']}**",
        "",
        "## قراءة الوضع",
        "",
    ]

    if snapshot["overall"]["health_status"] == "red":
        lines.append("المشروع يحتاج تدخل إداري مباشر بسبب وجود مهام حرجة ومخاطر وقرارات عاجلة.")
    elif snapshot["overall"]["health_status"] == "amber":
        lines.append("المشروع تحت المراقبة ويحتاج معالجة العناصر المؤثرة قبل أن تتحول إلى تأخير حرج.")
    else:
        lines.append("المشروع يبدو مستقراً تنفيذياً مع استمرار المتابعة الدورية.")

    lines.extend([
        "",
        "## مؤشرات الجدول",
        "",
        f"- إجمالي المهام: {snapshot['schedule']['total_tasks']}",
        f"- حرجة: {snapshot['schedule']['critical']}",
        f"- تحتاج تحديث: {snapshot['schedule']['stale']}",
        f"- لم تبدأ: {snapshot['schedule']['not_started']}",
        "",
        "## المخاطر والقرارات",
        "",
        f"- المخاطر الحرجة: {snapshot['risks']['critical']}",
        f"- مجموع شدة المخاطر: {snapshot['risks']['severity_total']}",
        f"- القرارات المقدمة: {snapshot['decisions']['submitted']}",
        "",
        "## الإجراءات الموصى بها",
        "",
    ])

    for action in snapshot["recommended_actions"]:
        lines.append(f"- {action}")

    lines.extend([
        "",
        "## ملاحظة",
        "",
        "هذه اللقطة مبنية على بيانات WBS وقوائم التحكم المولدة آلياً. يجب مراجعة السجلات الأولية بواسطة PMO قبل اعتمادها كتقرير رسمي.",
        "",
    ])

    Path(path).write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Build executive snapshot and report")
    parser.add_argument("--date", default=date.today().isoformat())
    parser.add_argument("--tasks", default="data/wbs_tasks.csv")
    parser.add_argument("--queue", default="data/daily_control_queue.csv")
    parser.add_argument("--risks", default="data/risks_register.csv")
    parser.add_argument("--decisions", default="data/decisions_register.csv")
    parser.add_argument("--approvals", default="data/approvals_register.csv")
    parser.add_argument("--quality", default="data/data_quality_report.json")
    parser.add_argument("--out-json", default="data/executive_snapshot.json")
    parser.add_argument("--out-report", default="data/executive_report.md")
    args = parser.parse_args()

    snapshot = build_snapshot(args)
    Path(args.out_json).write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")
    write_report(args.out_report, snapshot)
    print(json.dumps({
        "health_score": snapshot["overall"]["health_score"],
        "health_status": snapshot["overall"]["health_status"],
        "critical_tasks": snapshot["schedule"]["critical"],
        "open_risks": snapshot["risks"]["open"],
        "urgent_decisions": snapshot["decisions"]["urgent"],
        "pending_approvals": snapshot["approvals"]["total"],
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

