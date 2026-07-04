# Advanced Operational Extensions

These extensions add operational control layers to the current MAYADEEN Command Center without changing authentication, roles, Google Apps Script, Slack, email, existing approvals, or existing Audit Log behavior.

## Added Modules

- Vendor Control Center with supplier scorecard, procurement links, permits, violations, escalations, evidence, and activity history.
- Evidence Center with linked files, images, notes, uploader, date/time, sensitivity, approval history, version history, and decision log.
- Issues / Incidents Center with conversion paths to escalation or vendor violation.
- Vendor Violations and Supplier Scorecard for corrective actions and vendor risk visibility.
- Field-Level Permissions matrix derived from the current `currentUser` object and existing `allowed_pages`, `can_approve`, `can_escalate`, and `can_manage_users` flags.
- Notification Preferences model for in-app, Slack, Email, and future WhatsApp critical-only routing with dedupe rules.
- Reports Generator with daily, weekly, and executive report text plus local TXT/CSV/PDF-print/PPT-outline export.
- Import / Export Center for CSV import and CSV export.
- Mobile Field Mode for quick field evidence, notes, incidents, and escalations.
- Risk Trigger Automation and Smart Readiness Score.

## Preservation Rules

- No Apps Script code was changed.
- No Slack or email integration was changed.
- No login or role model was changed.
- New field-level checks are additive and apply only to new module actions.
- WhatsApp remains a future critical-only option; no WhatsApp integration was added.
- PDF export uses browser print; PowerPoint export is an outline file, not an external integration.

## Optional Data Keys

If future `data_sync` responses include these keys, the UI can consume them:

- `evidence` or `evidence_records`
- `approval_history` or `digital_approval_history`
- `version_history`
- `issues`, `incidents`, or `issues_incidents`
- `vendor_violations` or `violations`
- `decision_log` or `decisions_log`

If absent, the modules use browser-local records and the templates in `data/`.
