-- KAG Command Center initial PostgreSQL schema
-- Target: Supabase / PostgreSQL

create extension if not exists "pgcrypto";

create type user_role as enum (
  'executive',
  'project_director',
  'project_manager',
  'pmo',
  'workstream_owner',
  'supplier',
  'viewer'
);

create type progress_status as enum (
  'not_started',
  'in_progress',
  'completed',
  'blocked',
  'cancelled'
);

create type schedule_status as enum (
  'on_track',
  'due_soon',
  'overdue',
  'critical',
  'no_dates'
);

create type workflow_status as enum (
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'escalated',
  'closed'
);

create type risk_category as enum (
  'schedule',
  'financial',
  'operational',
  'technical',
  'safety',
  'supplier',
  'stakeholder',
  'other'
);

create table profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text not null,
  email text unique not null,
  role user_role not null default 'viewer',
  organization text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid references profiles(id),
  start_date date,
  target_date date,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workstreams (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  description text,
  owner_id uuid references profiles(id),
  color text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, name)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  workstream_id uuid references workstreams(id),
  wbs_code text not null,
  title text not null,
  description text,
  phase text,
  owner_id uuid references profiles(id),
  baseline_start date,
  baseline_finish date,
  planned_start date,
  planned_finish date,
  actual_start date,
  actual_finish date,
  percent_complete numeric(5,2) not null default 0 check (percent_complete >= 0 and percent_complete <= 100),
  progress_status progress_status not null default 'not_started',
  schedule_status schedule_status not null default 'no_dates',
  priority text not null default 'normal',
  last_update_at timestamptz,
  source_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, wbs_code)
);

create table task_dependencies (
  id uuid primary key default gen_random_uuid(),
  predecessor_task_id uuid not null references tasks(id) on delete cascade,
  successor_task_id uuid not null references tasks(id) on delete cascade,
  dependency_type text not null default 'finish_to_start',
  created_at timestamptz not null default now(),
  unique(predecessor_task_id, successor_task_id)
);

create table task_updates (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  user_id uuid not null references profiles(id),
  percent_complete numeric(5,2) check (percent_complete >= 0 and percent_complete <= 100),
  progress_status progress_status,
  update_summary text,
  blocker text,
  next_action text,
  next_update_due date,
  created_at timestamptz not null default now()
);

create table risks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  linked_task_id uuid references tasks(id) on delete set null,
  title text not null,
  description text,
  category risk_category not null default 'other',
  probability int not null default 1 check (probability between 1 and 5),
  impact int not null default 1 check (impact between 1 and 5),
  severity int generated always as (probability * impact) stored,
  owner_id uuid references profiles(id),
  treatment_plan text,
  treatment_status workflow_status not null default 'draft',
  due_date date,
  residual_probability int check (residual_probability between 1 and 5),
  residual_impact int check (residual_impact between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  linked_task_id uuid references tasks(id) on delete set null,
  linked_risk_id uuid references risks(id) on delete set null,
  title text not null,
  description text,
  requester_id uuid references profiles(id),
  decision_owner_id uuid references profiles(id),
  priority text not null default 'normal',
  status workflow_status not null default 'draft',
  due_date date,
  impact_if_delayed text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  linked_task_id uuid references tasks(id) on delete set null,
  type text not null,
  title text not null,
  description text,
  requester_id uuid references profiles(id),
  approver_id uuid references profiles(id),
  status workflow_status not null default 'draft',
  due_date date,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  linked_task_id uuid references tasks(id) on delete set null,
  title text not null,
  type text,
  version text,
  status workflow_status not null default 'draft',
  owner_id uuid references profiles(id),
  storage_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table change_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  title text not null,
  reason text,
  scope_impact text,
  schedule_impact_days int not null default 0,
  cost_impact numeric(14,2),
  quality_impact text,
  requester_id uuid references profiles(id),
  approver_id uuid references profiles(id),
  status workflow_status not null default 'draft',
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_json jsonb,
  after_json jsonb,
  reason text,
  ip_address inet,
  created_at timestamptz not null default now()
);

create table dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  snapshot_date date not null,
  metrics jsonb not null,
  created_at timestamptz not null default now(),
  unique(project_id, snapshot_date)
);

create index idx_tasks_project on tasks(project_id);
create index idx_tasks_owner on tasks(owner_id);
create index idx_tasks_status on tasks(progress_status, schedule_status);
create index idx_task_updates_task on task_updates(task_id, created_at desc);
create index idx_risks_project on risks(project_id, severity desc);
create index idx_decisions_project_status on decisions(project_id, status);
create index idx_approvals_project_status on approvals(project_id, status);
create index idx_audit_entity on audit_logs(entity_type, entity_id, created_at desc);

alter table profiles enable row level security;
alter table projects enable row level security;
alter table workstreams enable row level security;
alter table tasks enable row level security;
alter table task_dependencies enable row level security;
alter table task_updates enable row level security;
alter table risks enable row level security;
alter table decisions enable row level security;
alter table approvals enable row level security;
alter table documents enable row level security;
alter table change_requests enable row level security;
alter table audit_logs enable row level security;
alter table dashboard_snapshots enable row level security;

-- MVP starter policies. Tighten these before production launch.
create policy "authenticated_read_profiles" on profiles
  for select using (auth.role() = 'authenticated');

create policy "authenticated_read_projects" on projects
  for select using (auth.role() = 'authenticated');

create policy "authenticated_read_workstreams" on workstreams
  for select using (auth.role() = 'authenticated');

create policy "authenticated_read_tasks" on tasks
  for select using (auth.role() = 'authenticated');

create policy "authenticated_read_task_updates" on task_updates
  for select using (auth.role() = 'authenticated');

create policy "authenticated_read_risks" on risks
  for select using (auth.role() = 'authenticated');

create policy "authenticated_read_decisions" on decisions
  for select using (auth.role() = 'authenticated');

create policy "authenticated_read_approvals" on approvals
  for select using (auth.role() = 'authenticated');

create policy "authenticated_read_documents" on documents
  for select using (auth.role() = 'authenticated');

create policy "authenticated_read_change_requests" on change_requests
  for select using (auth.role() = 'authenticated');

create policy "authenticated_insert_task_updates" on task_updates
  for insert with check (auth.role() = 'authenticated');

create policy "authenticated_insert_audit_logs" on audit_logs
  for insert with check (auth.role() = 'authenticated');

