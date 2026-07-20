# P1 Batch 1 — Project Master, Central Settings, Coding Service

## Scope
This batch implements only the first P1 slice for Staging:
- `Project Master` central register.
- `Project Settings` central settings register.
- Backend-only unique code generation service.
- `Audit Log` entries for setup, Project Master writes, prefix approval, code generation, and migration reporting.

No Production deployment, email sending, Slack notification, trigger installation, or automatic migration of legacy codes is included in this batch.

## New Google Sheets

### Project Master
Columns:
- `project_id`
- `project_name`
- `project_prefix`
- `prefix_status`
- `project_owner`
- `opening_date`
- `timezone`
- `status`
- `created_at`
- `updated_at`
- `approved_by`
- `approved_at`

Default project status is `بانتظار اعتماد PMO`. Prefixes are not inferred; code generation is blocked unless `prefix_status` is `معتمد` and `project_prefix` is present.

### Project Settings
Columns:
- `setting_key`
- `setting_value`
- `status`
- `project_id`
- `description`
- `created_at`
- `updated_at`
- `approved_by`
- `approved_at`

### Code Sequences
Columns:
- `project_id`
- `entity_type`
- `sequence_key`
- `last_sequence`
- `updated_at`
- `updated_by`

### Code Registry
Columns:
- `generated_code`
- `project_id`
- `entity_type`
- `wbs_code`
- `path_code`
- `version`
- `code_date`
- `sequence`
- `created_at`
- `created_by`
- `source_action`
- `notes`

### Code Migration Report
Columns:
- `detected_at`
- `record_type`
- `row_number`
- `existing_code`
- `project_id`
- `entity_type`
- `compatibility_status`
- `issue`
- `recommended_action`

## Backend Actions
All actions require an authenticated session and the existing manage-users backend permission gate.

- `project_master_ensure`: creates/validates governance sheets only.
- `project_master_create`: creates or updates a Project Master row without approving the prefix.
- `project_prefix_approve`: explicitly approves a provided prefix for an existing project.
- `generate_project_code`: generates a unique code only after prefix approval.
- `code_migration_report`: creates a compatibility report for existing task codes without changing them.

## Code Generation Rules
- Uses `LockService.getScriptLock()` to prevent concurrent sequence collisions.
- Does not use row number as a sequence source.
- Includes project, entity type, WBS code, path code, version, and date in the sequence key when provided.
- Stores every generated code in `Code Registry` and checks for collisions before writing.
- Does not alter existing task/WBS codes.

## Audit Log
Every write/setup/report operation appends to the existing `Audit Log` and marks `result` as `no_email_no_notification` where applicable.

## Rollback
1. Revert the commit for this batch.
2. Restore `apps-script/Code.gs` from the dated backup under `backups/` if needed.
3. In Staging only, remove the newly created governance sheets if they were created and no longer needed.
4. Do not run trigger install/remove functions as part of rollback.
