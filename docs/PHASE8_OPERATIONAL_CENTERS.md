# Phase 8 - Operational Centers

This phase adds independent operational centers to the current dashboard without changing authentication, roles, Slack, email, notification scripts, or security settings.

## Added Centers

- Procurement Center: purchase request register, supplier link, value, priority, approval status, attachments, notes, updates, and workflow.
- Permits Center: active, expired, and canceled permits for people, vehicles, and suppliers with gate, zone, approver, attachments, and workflow.
- Change Orders Center: change description, reason, requester, time/cost/scope/quality impact, risk, approvals, notes, decisions, and workflow. Change orders are restricted to `مالك المشروع` and `المشرف العام` only.
- Automation and Audit Log: local automation rules, deduplicated alerts, workflow breach detection, permit expiry alerts, high-risk change alerts, and audit trail.
- Escalation Center: active, closed, critical, late, and no-response escalations with SLA, decision request, transfer, notes, closure, and Audit Log registration.
- Command & Control Center: responsibility map, critical task board, person performance intelligence, decision board, workflow ownership matrix, smart assignment suggestions, and operational control map.
- Daily Command Brief and War Room Mode: instant executive summary and screen-friendly operational command display.
- Advanced operational extensions: Vendor Control Center, Evidence Center, Issues / Incidents Center, Vendor Violations, Supplier Scorecard, Reports Generator, Import / Export Center, Mobile Field Mode, Risk Trigger Automation, Decision Log, and Smart Readiness Score.

## Preservation Rules

- No existing permissions were changed.
- No existing Apps Script action was changed.
- No Slack integration was changed.
- No email integration was changed.
- No login, roles, or security settings were changed.
- Existing pages and functions remain in place.
- Change order ownership, assignment, approval, and escalation are limited to `مالك المشروع` and `المشرف العام`; this is enforced in the UI, local normalization, smart assignment, escalation transfer, and the optional SQL template.

## Data Integration

The UI can read these optional keys from the existing `data_sync` response if they are added later:

- `procurements` or `procurement_requests`
- `permits` or `permits_register`
- `change_orders`
- `audit_log` or `activity_log`
- `escalations` or `escalation_records`
- `evidence` or `evidence_records`
- `approval_history` or `digital_approval_history`
- `version_history`
- `issues`, `incidents`, or `issues_incidents`
- `vendor_violations` or `violations`
- `decision_log` or `decisions_log`

If those keys are absent, the centers use browser-local records and the CSV templates in `data/`.

## Added Templates

- `data/escalation_records_template.csv`
- `data/workflow_ownership_matrix_template.csv`
- `data/person_performance_template.csv`
- `data/vendor_control_template.csv`
- `data/evidence_center_template.csv`
- `data/digital_approval_history_template.csv`
- `data/version_history_template.csv`
- `data/issues_incidents_template.csv`
- `data/vendor_violations_template.csv`
- `data/supplier_scorecard_template.csv`
- `data/field_permissions_template.csv`
- `data/notification_preferences_template.csv`
- `data/decision_log_template.csv`
- `data/reports_generator_template.csv`
- `data/mobile_field_actions_template.csv`

See also `docs/ADVANCED_OPERATIONAL_EXTENSIONS.md`.
