-- Phase 8: Operational centers.
-- Additive schema only. Does not alter existing auth, roles, Slack, email, or notification tables.

create table if not exists procurement_requests (
  request_id text primary key,
  title text not null,
  supplier text,
  value numeric default 0,
  created_at date,
  approved_at date,
  owner text,
  priority text default 'متوسط',
  status text default 'طلب شراء جديد',
  approval_status text default 'بانتظار المراجعة',
  attachment text,
  notes text,
  updates text,
  linked_task text,
  linked_zone text,
  stage_due date,
  inserted_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists permits_register (
  permit_id text primary key,
  type text not null,
  party text,
  subject text,
  start_date date,
  end_date date,
  gate text,
  zone text,
  status text default 'قيد المراجعة',
  stage text default 'طلب تصريح جديد',
  approver text,
  reason text,
  attachment text,
  updates text,
  linked_supplier text,
  linked_task text,
  stage_due date,
  inserted_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists change_orders (
  change_order_id text primary key,
  title text not null,
  reason text,
  requester text check (requester in ('مالك المشروع', 'المشرف العام')),
  time_impact integer default 0,
  cost_impact numeric default 0,
  scope_impact text default 'متوسط',
  quality_impact text default 'متوسط',
  risk_level text default 'متوسط',
  status text default 'تحت المراجعة',
  stage text default 'طلب تغيير',
  attachment text,
  approval_log text,
  notes text,
  decision_log text,
  linked_items text,
  stage_due date,
  created_at date,
  inserted_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists automation_audit_log (
  audit_id text primary key,
  center text not null,
  record_id text,
  action text not null,
  detail text,
  actor text default 'Automation Engine',
  created_at date default current_date,
  dedupe_key text unique,
  inserted_at timestamptz default now()
);

create table if not exists escalation_records (
  escalation_id text primary key,
  item_id text,
  item_title text,
  item_type text,
  original_owner text,
  escalated_to text,
  created_at date default current_date,
  reason text,
  level text default 'Level 1',
  status text default 'نشط',
  sla_hours integer default 12,
  last_reply text,
  decision_needed text,
  attachments text,
  movement_log text,
  center text,
  severity text default 'متوسط',
  inserted_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists workflow_ownership_matrix (
  matrix_id bigserial primary key,
  workflow text not null,
  stage text not null,
  execution_owner text,
  review_owner text,
  approval_owner text,
  escalation_owner text,
  sla text,
  transition_condition text,
  first_alert text,
  first_escalation text,
  second_escalation text,
  critical_escalation text,
  inserted_at timestamptz default now()
);

create table if not exists person_performance_snapshot (
  snapshot_date date not null default current_date,
  person text not null,
  team text,
  assigned_tasks integer default 0,
  open_tasks integer default 0,
  delayed_tasks integer default 0,
  active_escalations integer default 0,
  average_response_time text,
  average_close_time text,
  compliance_rate numeric default 100,
  operational_pressure text,
  most_delayed_task_type text,
  last_activity date,
  needs_support boolean default false,
  primary key (snapshot_date, person)
);

create table if not exists evidence_records (
  evidence_id text primary key,
  linked_type text,
  linked_id text,
  title text,
  file_type text,
  file_url text,
  uploaded_by text,
  uploaded_at timestamptz default now(),
  notes text,
  sensitivity text default 'عادي',
  inserted_at timestamptz default now()
);

create table if not exists digital_approval_history (
  approval_history_id text primary key,
  record_type text,
  record_id text,
  decision text,
  approver text,
  decision_at timestamptz default now(),
  notes text,
  version text,
  inserted_at timestamptz default now()
);

create table if not exists version_history (
  version_history_id text primary key,
  record_type text,
  record_id text,
  field_name text,
  old_value text,
  new_value text,
  changed_by text,
  changed_at timestamptz default now(),
  inserted_at timestamptz default now()
);

create table if not exists issues_incidents (
  issue_id text primary key,
  title text not null,
  description text,
  vendor text,
  severity text default 'متوسط',
  status text default 'مفتوح',
  owner text,
  linked_item text,
  converted_to text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists vendor_violations (
  violation_id text primary key,
  vendor text,
  title text not null,
  severity text default 'متوسط',
  impact text,
  decision text,
  corrective_action text,
  status text default 'مفتوح',
  evidence_id text,
  owner text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists supplier_scorecard_snapshot (
  snapshot_date date not null default current_date,
  vendor text not null,
  score numeric default 100,
  status text,
  procurement_count integer default 0,
  permit_count integer default 0,
  violation_count integer default 0,
  escalation_count integer default 0,
  delayed_count integer default 0,
  missing_document_count integer default 0,
  primary key (snapshot_date, vendor)
);

create table if not exists field_permission_matrix (
  permission_id bigserial primary key,
  page_id text not null,
  action text not null,
  allowed_condition text,
  notes text,
  inserted_at timestamptz default now()
);

create table if not exists notification_preferences (
  preference_id bigserial primary key,
  event_type text not null,
  priority text,
  in_app boolean default true,
  slack boolean default false,
  email boolean default false,
  whatsapp_future text,
  dedupe_rule text,
  inserted_at timestamptz default now()
);

create table if not exists decision_log (
  decision_id text primary key,
  linked_type text,
  linked_id text,
  decision_owner text,
  decision_at timestamptz default now(),
  decision text,
  rationale text,
  expected_impact text,
  inserted_at timestamptz default now()
);

create index if not exists idx_procurement_status on procurement_requests(status);
create index if not exists idx_procurement_supplier on procurement_requests(supplier);
create index if not exists idx_permits_status_end on permits_register(status, end_date);
create index if not exists idx_change_orders_status_risk on change_orders(status, risk_level);
create index if not exists idx_audit_center_record on automation_audit_log(center, record_id);
create index if not exists idx_escalation_records_status_level on escalation_records(status, level);
create index if not exists idx_escalation_records_item on escalation_records(item_type, item_id);
create index if not exists idx_workflow_ownership_workflow on workflow_ownership_matrix(workflow, stage);
create index if not exists idx_evidence_linked_record on evidence_records(linked_type, linked_id);
create index if not exists idx_approval_history_record on digital_approval_history(record_type, record_id);
create index if not exists idx_version_history_record on version_history(record_type, record_id);
create index if not exists idx_issues_status_vendor on issues_incidents(status, vendor);
create index if not exists idx_vendor_violations_vendor_status on vendor_violations(vendor, status);
create index if not exists idx_decision_log_linked_record on decision_log(linked_type, linked_id);
