#!/usr/bin/env python3
import argparse
import csv
import json
from collections import Counter
from datetime import datetime
from pathlib import Path


APPROVAL_KEYWORDS = ("اعتماد", "تعميد", "موافقة")
REVIEW_KEYWORDS = ("مراجعة", "اختيار")
CONTRACT_KEYWORDS = ("توقيع", "عقد", "عقود")


def read_csv(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path, rows, fieldnames):
    with Path(path).open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def contains_any(text, keywords):
    return any(k in text for k in keywords)


def approval_type(title):
    if contains_any(title, CONTRACT_KEYWORDS):
        return "contract"
    if contains_any(title, REVIEW_KEYWORDS):
        return "review"
    if contains_any(title, APPROVAL_KEYWORDS):
        return "approval"
    return ""


def make_risk_id(n):
    return f"RISK-{n:04d}"


def make_decision_id(n):
    return f"DEC-{n:04d}"


def make_approval_id(n):
    return f"APP-{n:04d}"


def build_registers(queue):
    risks = []
    decisions = []
    approvals = []
    risk_seen = set()
    decision_seen = set()
    approval_seen = set()

    for item in queue:
        code = item.get("wbs_code", "")
        title = item.get("title", "")
        bucket = item.get("queue_bucket", "")
        owner = item.get("owner_name", "") or "غير محدد"
        due = item.get("planned_finish", "")

        if bucket == "critical" and code not in risk_seen:
            risk_seen.add(code)
            risks.append({
                "risk_id": make_risk_id(len(risks) + 1),
                "linked_wbs_code": code,
                "title": f"تأخر حرج: {title}",
                "category": "schedule",
                "probability": 5,
                "impact": 4,
                "severity": 20,
                "owner_name": owner,
                "treatment_plan": "تصعيد فوري وتحديث خطة التعافي وتحديد مالك إجراء واضح",
                "due_date": due,
                "status": "submitted",
            })

        if bucket == "critical" and code not in decision_seen:
            decision_seen.add(code)
            decisions.append({
                "decision_id": make_decision_id(len(decisions) + 1),
                "linked_wbs_code": code,
                "title": f"قرار معالجة تأخر: {title}",
                "reason": item.get("relative_due", ""),
                "decision_owner": "مدير المشروع",
                "priority": "urgent",
                "due_date": due,
                "status": "submitted",
                "impact_if_delayed": "استمرار التأخير قد يؤثر على المسار الزمني ونقطة الافتتاح",
            })

        app_type = approval_type(title)
        if app_type and code not in approval_seen:
            approval_seen.add(code)
            approvals.append({
                "approval_id": make_approval_id(len(approvals) + 1),
                "linked_wbs_code": code,
                "type": app_type,
                "title": title,
                "requester": owner,
                "approver": "الجهة المالكة / مدير المشروع",
                "due_date": due,
                "status": "draft",
                "notes": "تم توليده أولياً من WBS ويحتاج مراجعة PMO",
            })

    return risks, decisions, approvals


def main():
    parser = argparse.ArgumentParser(description="Build initial risks, decisions, and approvals from daily queue")
    parser.add_argument("--queue", default="data/daily_control_queue.csv")
    parser.add_argument("--out-dir", default="data")
    args = parser.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    queue = read_csv(args.queue)
    risks, decisions, approvals = build_registers(queue)

    write_csv(out_dir / "risks_register.csv", risks, [
        "risk_id", "linked_wbs_code", "title", "category", "probability", "impact",
        "severity", "owner_name", "treatment_plan", "due_date", "status"
    ])
    write_csv(out_dir / "decisions_register.csv", decisions, [
        "decision_id", "linked_wbs_code", "title", "reason", "decision_owner",
        "priority", "due_date", "status", "impact_if_delayed"
    ])
    write_csv(out_dir / "approvals_register.csv", approvals, [
        "approval_id", "linked_wbs_code", "type", "title", "requester", "approver",
        "due_date", "status", "notes"
    ])

    report = {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "source": args.queue,
        "counts": {
            "queue_items": len(queue),
            "risks": len(risks),
            "decisions": len(decisions),
            "approvals": len(approvals),
            "approval_types": dict(Counter(a["type"] for a in approvals)),
            "risk_statuses": dict(Counter(r["status"] for r in risks)),
            "decision_priorities": dict(Counter(d["priority"] for d in decisions)),
        },
        "top_risks": risks[:10],
        "top_decisions": decisions[:10],
        "sample_approvals": approvals[:10],
    }
    (out_dir / "control_registers_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(json.dumps(report["counts"], ensure_ascii=False))


if __name__ == "__main__":
    main()

