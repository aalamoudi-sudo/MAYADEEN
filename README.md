# KAG Project Command Center

KAG Project Command Center is a project control-room blueprint and dashboard package for managing schedule, daily updates, risks, decisions, approvals, executive reporting, cybersecurity readiness, and launch operations.

## Contents

- `index.html`: GitHub-safe dashboard version.
- `docs/`: product blueprint, roadmap, phase plans, security review, and operational specifications.
- `database/`: PostgreSQL/Supabase schema and phase SQL files.
- `scripts/`: data-processing scripts for WBS extraction, daily control, registers, executive snapshots, and operations readiness.
- `data/`: generated safe reports and readiness outputs.

## Current Phase Status

The project planning foundation is complete across 7 phases:

1. Technical Foundation
2. Data Foundation
3. Daily Control
4. Decisions, Risks, and Approvals
5. Executive Intelligence
6. Security, Governance, and Permissions
7. Operations Room and Scale

## Current Go/No-Go Result

The latest generated operations report shows:

- Status: `NO_GO`
- Readiness score: `5/100`
- Main blockers: critical tasks, critical risks, and urgent decisions.

See:

- `data/operations_room_report.json`
- `data/go_no_go_report.md`
- `docs/PHASE7_SUMMARY.md`

## Run Reports Locally

Use Python 3:

```bash
python3 -B scripts/build_daily_queue.py
python3 -B scripts/build_control_registers.py
python3 -B scripts/build_executive_snapshot.py
python3 -B scripts/build_operations_readiness.py
```

## Security Notes

This package uses the GitHub-safe dashboard file as `index.html`.

Before publishing publicly:

- Do not commit real secrets, tokens, API keys, or private Apps Script URLs.
- Do not publish internal WBS raw data unless the repository is private and approved.
- Use environment variables for production integrations.
- Apply Supabase Row Level Security before real user access.

## Recommended Next Step

Convert this package into a working application using:

- Next.js
- Supabase PostgreSQL/Auth/RLS
- Vercel
- Slack or Microsoft Teams notifications
- GitHub security scanning
