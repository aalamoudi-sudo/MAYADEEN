# Server-side path authorization

`apps-script/Code.gs` is the canonical core source. `apps-script/Inquiries.gs`
is the independent inquiry module. `apps-script/current-apps-script.gs` is a
generated, paste-ready bundle built with:

```bash
python3 -B scripts/build_apps_script_bundle.py
```

Never edit the bundle independently. A deployment must be built from these
sources and verified in staging; repository state does not identify the version
currently deployed by Google Apps Script.

## Full-access boundary

An active, authenticated account has cross-path access when either its Matrix
`access_level` is `full`, or its immutable username is one of the four required
governance identities: `atheer`, `ahmad.amoudi`, `abdulaziz.obaid`, or
`abdullah.almarhoom`. This does not mutate the User Access Matrix or bypass its
active-account/password checks.

## Record-to-path mapping

Authorization resolves a record's path in this order and **fails closed** when
no path can be proven:

1. Direct path fields: `path_scope`, `path`, `main_path`, `official_path`,
   `workstream`, `workstream_code`, `path_code`, `affected_paths`, `المسار الرسمي`,
   `المسار الرئيسي`, or `المسار`.
2. WBS aliases defined by `WBS_FIELD_ALIASES.mainPath`.
3. Linked references: `linked_wbs_code`, `wbs_code`, `task_id`, `linked_task`,
   `linked_task_id`, `affected_tasks`, `item_id`, `linked_id`, `record_reference`, or
   `reference_id`. References are resolved transitively (for example Decision
   -> Approval -> WBS).

Dataset mapping:

| Dataset | Authoritative path evidence |
|---|---|
| WBS / Tasks | WBS main-path aliases |
| Risks | direct path/workstream, otherwise a WBS reference |
| Approvals | direct path, otherwise `linked_wbs_code` |
| Decisions | direct path, otherwise `linked_id` to a scoped record |
| Escalations | direct path, otherwise `task_id`/`item_id` |
| Assignments | `path`, otherwise `wbs_code`/linked task |
| Meetings | direct path, otherwise linked WBS/task |
| Commitments | direct path, otherwise linked WBS/task |
| Files | direct path, otherwise linked WBS/task |
| Urgent Tasks | direct path, otherwise WBS/task reference |
| Employee Master | employee name/email referenced by an already scoped task |
| Baseline, RACI, workload, critical path, data quality | rebuilt from scoped WBS and scoped employees |
| Project Master / Project Settings | project-wide shared configuration, not workstream records |

Approval/escalation chain rows and any other path-owned record without direct or
linked evidence are not returned to non-full users. This is intentional: owner
names, titles, free text, and UI page visibility are never treated as path proof.

## Writes

Create operations require direct path evidence or a resolvable WBS reference.
Updates, deletes, approvals, and escalations authorize the existing server-side
record before mutation and also authorize the proposed record where applicable.
The client cannot grant itself access by supplying a different path.
