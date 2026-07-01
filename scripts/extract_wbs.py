#!/usr/bin/env python3
import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path


def parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(str(value).strip(), "%Y-%m-%d").date()
    except ValueError:
        return None


def schedule_status(planned_start, planned_finish, progress_status, today):
    if not planned_start or not planned_finish:
        return "no_dates"
    if progress_status == "completed":
        return "on_track"
    days_to_finish = (planned_finish - today).days
    if days_to_finish < -14:
        return "critical"
    if days_to_finish < 0:
        return "overdue"
    if days_to_finish <= 7:
        return "due_soon"
    return "on_track"


def normalize_row(row, today):
    row_type = (row.get("type") or "").strip() or "Task"
    wbs_code = (row.get("code") or "").strip()
    title = (row.get("name") or "").strip()
    phase = (row.get("phase") or "").strip()
    owner_name = (row.get("owner") or "").strip()
    planned_start_raw = (row.get("start") or "").strip()
    planned_finish_raw = (row.get("end") or "").strip()
    notes = (row.get("notes") or "").strip()
    planned_start = parse_date(planned_start_raw)
    planned_finish = parse_date(planned_finish_raw)
    progress = "not_started"
    status = schedule_status(planned_start, planned_finish, progress, today)

    return {
        "row_type": row_type,
        "wbs_code": wbs_code,
        "title": title,
        "phase": phase,
        "owner_name": owner_name,
        "planned_start": planned_start_raw,
        "planned_finish": planned_finish_raw,
        "baseline_start": planned_start_raw,
        "baseline_finish": planned_finish_raw,
        "actual_start": "",
        "actual_finish": "",
        "percent_complete": 0,
        "progress_status": progress,
        "schedule_status": status,
        "notes": notes,
    }


def extract_embedded(html_text):
    match = re.search(r"const EMBEDDED=(\{.*?\});\nlet rows=", html_text, re.S)
    if not match:
        raise ValueError("Could not find EMBEDDED data block")
    return json.loads(match.group(1))


def validate(rows):
    errors = []
    warnings = []
    codes = Counter(row["wbs_code"] for row in rows if row["wbs_code"])

    for idx, row in enumerate(rows, start=1):
        prefix = f"row {idx} ({row.get('wbs_code') or 'no-code'})"
        if not row["row_type"]:
            errors.append({"row": idx, "code": row["wbs_code"], "message": "row_type is required"})
        if not row["wbs_code"]:
            errors.append({"row": idx, "code": row["wbs_code"], "message": "wbs_code is required"})
        if not row["title"]:
            errors.append({"row": idx, "code": row["wbs_code"], "message": "title is required"})
        if row["wbs_code"] and codes[row["wbs_code"]] > 1:
            errors.append({"row": idx, "code": row["wbs_code"], "message": "duplicate wbs_code"})

        start = parse_date(row["planned_start"])
        finish = parse_date(row["planned_finish"])
        if row["planned_start"] and not start:
            errors.append({"row": idx, "code": row["wbs_code"], "message": "invalid planned_start"})
        if row["planned_finish"] and not finish:
            errors.append({"row": idx, "code": row["wbs_code"], "message": "invalid planned_finish"})
        if start and finish and finish < start:
            errors.append({"row": idx, "code": row["wbs_code"], "message": "planned_finish before planned_start"})

        if row["row_type"] == "Task":
            if not row["owner_name"]:
                warnings.append({"row": idx, "code": row["wbs_code"], "message": "owner_name is missing"})
            if not row["phase"]:
                warnings.append({"row": idx, "code": row["wbs_code"], "message": "phase is missing"})
            if not row["planned_start"]:
                warnings.append({"row": idx, "code": row["wbs_code"], "message": "planned_start is missing"})
            if not row["planned_finish"]:
                warnings.append({"row": idx, "code": row["wbs_code"], "message": "planned_finish is missing"})

    score = max(0, min(100, 100 - len(errors) * 10 - len(warnings) * 2))
    return errors, warnings, score


def write_csv(path, rows):
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    fieldnames = list(rows[0].keys())
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description="Extract KAG WBS data from dashboard HTML")
    parser.add_argument("--input", default="KAG_Dashboard_Final.html")
    parser.add_argument("--out-dir", default="data")
    parser.add_argument("--today", default=date.today().isoformat())
    args = parser.parse_args()

    input_path = Path(args.input)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    today = parse_date(args.today)
    if not today:
        raise ValueError("--today must be YYYY-MM-DD")

    embedded = extract_embedded(input_path.read_text(encoding="utf-8"))
    normalized = [normalize_row(row, today) for row in embedded.get("rows", [])]
    tasks = [row for row in normalized if row["row_type"] == "Task"]
    milestones = [row for row in normalized if row["row_type"] == "Milestone"]
    errors, warnings, score = validate(normalized)

    report = {
        "source": str(input_path),
        "generated": embedded.get("generated", ""),
        "extracted_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "today": today.isoformat(),
        "counts": {
            "rows": len(normalized),
            "tasks": len(tasks),
            "milestones": len(milestones),
            "by_schedule_status": dict(Counter(row["schedule_status"] for row in normalized)),
            "by_phase": dict(Counter(row["phase"] or "غير محدد" for row in normalized)),
            "owners": len({row["owner_name"] for row in normalized if row["owner_name"]}),
        },
        "quality": {
            "score": score,
            "errors_count": len(errors),
            "warnings_count": len(warnings),
            "errors": errors,
            "warnings": warnings,
        },
    }

    raw = {
        "generated": embedded.get("generated", ""),
        "source": str(input_path),
        "rows": normalized,
    }

    (out_dir / "wbs_raw.json").write_text(json.dumps(raw, ensure_ascii=False, indent=2), encoding="utf-8")
    (out_dir / "data_quality_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    write_csv(out_dir / "wbs_tasks.csv", tasks)
    write_csv(out_dir / "wbs_milestones.csv", milestones)

    print(json.dumps({
        "rows": len(normalized),
        "tasks": len(tasks),
        "milestones": len(milestones),
        "quality_score": score,
        "errors": len(errors),
        "warnings": len(warnings),
        "out_dir": str(out_dir),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()

