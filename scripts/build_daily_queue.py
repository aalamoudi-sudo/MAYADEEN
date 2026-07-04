#!/usr/bin/env python3
import argparse
import csv
import json
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path


RANKS = {
    "critical": 1,
    "overdue": 2,
    "blocked": 3,
    "due_soon": 4,
    "stale": 5,
    "in_progress": 6,
    "not_started": 7,
    "on_track": 8,
}


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def queue_bucket(row, today):
    status = row.get("schedule_status") or "on_track"
    progress = row.get("progress_status") or "not_started"
    planned_start = parse_date(row.get("planned_start"))
    planned_finish = parse_date(row.get("planned_finish"))

    if status in ("critical", "overdue", "due_soon"):
        return status
    if progress == "blocked":
        return "blocked"
    if progress == "in_progress":
        return "in_progress"
    if planned_start and planned_start <= today + timedelta(days=7):
        return "stale"
    return "not_started"


def relative_due(row, today):
    finish = parse_date(row.get("planned_finish"))
    if not finish:
        return "no due date"
    diff = (finish - today).days
    if diff == 0:
        return "due today"
    if diff > 0:
        return f"due in {diff} days"
    return f"overdue by {abs(diff)} days"


def read_csv(path):
    with Path(path).open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path, rows):
    if not rows:
        Path(path).write_text("", encoding="utf-8")
        return
    fieldnames = list(rows[0].keys())
    with Path(path).open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description="Build daily control queue from normalized WBS tasks")
    parser.add_argument("--tasks", default="data/wbs_tasks.csv")
    parser.add_argument("--out-csv", default="data/daily_control_queue.csv")
    parser.add_argument("--out-report", default="data/daily_control_report.json")
    parser.add_argument("--today", default=date.today().isoformat())
    args = parser.parse_args()

    today = parse_date(args.today)
    if not today:
        raise ValueError("--today must be YYYY-MM-DD")

    tasks = read_csv(args.tasks)
    queue = []
    by_owner = defaultdict(lambda: Counter())

    for row in tasks:
        bucket = queue_bucket(row, today)
        item = {
            "queue_rank": RANKS.get(bucket, 99),
            "queue_bucket": bucket,
            "wbs_code": row.get("wbs_code", ""),
            "title": row.get("title", ""),
            "phase": row.get("phase", ""),
            "owner_name": row.get("owner_name", "") or "غير محدد",
            "planned_start": row.get("planned_start", ""),
            "planned_finish": row.get("planned_finish", ""),
            "relative_due": relative_due(row, today),
            "percent_complete": row.get("percent_complete", "0"),
            "progress_status": row.get("progress_status", ""),
            "schedule_status": row.get("schedule_status", ""),
            "required_action": "",
        }

        if bucket == "critical":
            item["required_action"] = "تصعيد فوري وتحديث الحالة"
        elif bucket == "overdue":
            item["required_action"] = "تحديث سبب التأخير والإجراء القادم"
        elif bucket == "due_soon":
            item["required_action"] = "تأكيد الجاهزية قبل الاستحقاق"
        elif bucket == "stale":
            item["required_action"] = "إدخال تحديث يومي"
        else:
            item["required_action"] = "متابعة دورية"

        queue.append(item)
        by_owner[item["owner_name"]][bucket] += 1
        by_owner[item["owner_name"]]["total"] += 1

    queue.sort(key=lambda x: (int(x["queue_rank"]), x["owner_name"], x["planned_finish"], x["wbs_code"]))

    report = {
        "generated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "today": today.isoformat(),
        "counts": {
            "total_tasks": len(tasks),
            "queue_items": len(queue),
            "by_bucket": dict(Counter(item["queue_bucket"] for item in queue)),
            "owners": len(by_owner),
        },
        "top_owners": [
            {"owner_name": owner, **dict(counter)}
            for owner, counter in sorted(by_owner.items(), key=lambda kv: kv[1]["total"], reverse=True)[:15]
        ],
        "top_priority_items": queue[:25],
    }

    write_csv(args.out_csv, queue)
    Path(args.out_report).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps({
        "queue_items": len(queue),
        "owners": len(by_owner),
        "by_bucket": report["counts"]["by_bucket"],
        "out_csv": args.out_csv,
        "out_report": args.out_report,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

