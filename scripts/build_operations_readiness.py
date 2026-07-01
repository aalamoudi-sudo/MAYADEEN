#!/usr/bin/env python3
"""Build Phase 7 operations room readiness outputs from generated controls."""

from __future__ import annotations

import csv
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def load_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def clamp(value: int, low: int = 0, high: int = 100) -> int:
    return max(low, min(high, value))


def readiness_score(metrics: dict) -> int:
    score = 100
    score -= min(metrics["critical_tasks"] * 4, 28)
    score -= min(metrics["critical_risks"] * 4, 28)
    score -= min(metrics["urgent_decisions"] * 3, 21)
    if metrics["pending_approvals"] > 100:
        score -= 10
    if metrics["total_tasks"] and metrics["stale_tasks"] / metrics["total_tasks"] > 0.25:
        score -= 8
    if metrics["data_quality_score"] < 80:
        score -= 20
    return clamp(score)


def status_for(ok: bool, warning: bool = False) -> str:
    if ok:
        return "ready"
    if warning:
        return "at_risk"
    return "not_ready"


def build_checks(metrics: dict) -> list[dict]:
    stale_ratio = (
        metrics["stale_tasks"] / metrics["total_tasks"]
        if metrics["total_tasks"]
        else 1
    )
    return [
        {
            "check_id": "OPS-CHK-001",
            "category": "Schedule Recovery",
            "title": "Close or rebaseline all critical tasks",
            "owner": "Project Manager / PMO",
            "status": status_for(metrics["critical_tasks"] == 0),
            "evidence": f"{metrics['critical_tasks']} critical tasks currently open",
            "required_action": "Escalate each critical task and assign recovery owner/date",
            "source_metric": "schedule.critical",
        },
        {
            "check_id": "OPS-CHK-002",
            "category": "Risk Closure",
            "title": "Close critical risks or approve treatment plans",
            "owner": "Project Manager",
            "status": status_for(metrics["critical_risks"] == 0),
            "evidence": f"{metrics['critical_risks']} critical risks currently open",
            "required_action": "Approve treatment plan and mitigation owner for every critical risk",
            "source_metric": "risks.critical",
        },
        {
            "check_id": "OPS-CHK-003",
            "category": "Decision Closure",
            "title": "Resolve urgent decisions blocking readiness",
            "owner": "Project Director",
            "status": status_for(metrics["urgent_decisions"] == 0),
            "evidence": f"{metrics['urgent_decisions']} urgent decisions pending",
            "required_action": "Hold decision session and record decision outcome",
            "source_metric": "decisions.urgent",
        },
        {
            "check_id": "OPS-CHK-004",
            "category": "Approval Cleanup",
            "title": "Reduce pending approvals to launch-safe threshold",
            "owner": "PMO / Approval Owners",
            "status": status_for(metrics["pending_approvals"] < 25, metrics["pending_approvals"] < 100),
            "evidence": f"{metrics['pending_approvals']} approvals pending",
            "required_action": "Separate launch-blocking approvals from non-blocking approvals",
            "source_metric": "approvals.total",
        },
        {
            "check_id": "OPS-CHK-005",
            "category": "Daily Control",
            "title": "Refresh stale task updates",
            "owner": "Workstream Owners",
            "status": status_for(stale_ratio <= 0.10, stale_ratio <= 0.25),
            "evidence": f"{metrics['stale_tasks']} stale tasks out of {metrics['total_tasks']}",
            "required_action": "Require every owner to update today status and next action",
            "source_metric": "schedule.stale",
        },
        {
            "check_id": "OPS-CHK-006",
            "category": "Data Quality",
            "title": "Confirm data is reliable for executive decisions",
            "owner": "PMO",
            "status": status_for(metrics["data_quality_score"] >= 90, metrics["data_quality_score"] >= 80),
            "evidence": f"Data quality score is {metrics['data_quality_score']}",
            "required_action": "Fix validation errors before executive reporting",
            "source_metric": "data_quality.score",
        },
        {
            "check_id": "OPS-CHK-007",
            "category": "Operations Setup",
            "title": "Activate daily operations room rhythm",
            "owner": "Operations Lead",
            "status": "at_risk",
            "evidence": "Phase 7 structure generated; live team assignments still required",
            "required_action": "Assign operations lead, review cadence, escalation channels, and launch-day rota",
            "source_metric": "manual.operations_setup",
        },
    ]


def decide_go_no_go(score: int, metrics: dict) -> tuple[str, list[str]]:
    blockers = []
    if metrics["critical_tasks"] > 0:
        blockers.append(f"{metrics['critical_tasks']} critical tasks are still open")
    if metrics["critical_risks"] > 0:
        blockers.append(f"{metrics['critical_risks']} critical risks are still open")
    if metrics["urgent_decisions"] > 0:
        blockers.append(f"{metrics['urgent_decisions']} urgent decisions are still pending")
    if metrics["data_quality_score"] < 80:
        blockers.append("data quality is below executive decision threshold")

    if blockers:
        return "no_go", blockers
    if score >= 90:
        return "go", blockers
    return "conditional_go", blockers


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def write_markdown(path: Path, report: dict, checks: list[dict]) -> None:
    lines = [
        "# KAG Go/No-Go Report",
        "",
        f"Generated at: {report['generated_at']}",
        f"Next review: {report['next_review']}",
        "",
        f"Decision: {report['go_no_go_status'].upper()}",
        f"Readiness score: {report['readiness_score']}/100",
        "",
        "## Blockers",
        "",
    ]
    if report["blockers"]:
        lines.extend(f"- {item}" for item in report["blockers"])
    else:
        lines.append("- No launch-blocking blockers detected.")
    lines.extend(["", "## Required Actions", ""])
    lines.extend(f"- {item}" for item in report["required_actions"])
    lines.extend(["", "## Readiness Checks", ""])
    for check in checks:
        lines.append(
            f"- {check['check_id']} | {check['status']} | {check['category']} | {check['title']}"
        )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    executive = load_json(DATA / "executive_snapshot.json")
    daily = load_json(DATA / "daily_control_report.json")

    metrics = {
        "health_score": int(executive["overall"]["health_score"]),
        "completion_pct": float(executive["overall"]["completion_pct"]),
        "total_tasks": int(executive["schedule"]["total_tasks"]),
        "critical_tasks": int(executive["schedule"]["critical"]),
        "stale_tasks": int(executive["schedule"]["stale"]),
        "not_started_tasks": int(executive["schedule"]["not_started"]),
        "critical_risks": int(executive["risks"]["critical"]),
        "open_risks": int(executive["risks"]["open"]),
        "urgent_decisions": int(executive["decisions"]["urgent"]),
        "pending_approvals": int(executive["approvals"]["total"]),
        "data_quality_score": int(executive["data_quality"]["score"]),
        "owners": int(daily["counts"]["owners"]),
    }

    score = readiness_score(metrics)
    decision, blockers = decide_go_no_go(score, metrics)
    checks = build_checks(metrics)
    now = datetime.now(timezone.utc)
    next_review = now + timedelta(days=1)

    required_actions = [
        check["required_action"]
        for check in checks
        if check["status"] in {"not_ready", "at_risk"}
    ]

    report = {
        "generated_at": now.replace(microsecond=0).isoformat(),
        "go_no_go_status": decision,
        "readiness_score": score,
        "next_review": next_review.replace(microsecond=0).isoformat(),
        "metrics": metrics,
        "blockers": blockers,
        "required_actions": required_actions,
        "readiness_counts": {
            "ready": sum(1 for item in checks if item["status"] == "ready"),
            "at_risk": sum(1 for item in checks if item["status"] == "at_risk"),
            "not_ready": sum(1 for item in checks if item["status"] == "not_ready"),
        },
    }

    write_csv(DATA / "operations_readiness_checklist.csv", checks)
    (DATA / "operations_room_report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_markdown(DATA / "go_no_go_report.md", report, checks)

    print(f"Generated operations readiness: {decision} ({score}/100)")
    print(f"Blockers: {len(blockers)}")


if __name__ == "__main__":
    main()
