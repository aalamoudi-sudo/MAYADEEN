-- Phase 7: Operations Room and Scale
-- Review before applying to production Supabase.

create type incident_priority as enum ('p1', 'p2', 'p3', 'p4');
create type incident_status as enum ('open', 'in_progress', 'resolved', 'closed', 'cancelled');
create type readiness_status as enum ('ready', 'at_risk', 'not_ready', 'waived');
create type go_no_go_status as enum ('go', 'conditional_go', 'no_go');

create table operation_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  event_time timestamptz not null default now(),
  title text not null,
  event_type text not null,
  severity text not null default 'info',
  linked_task_id uuid references tasks(id) on delete set null,
  linked_risk_id uuid references risks(id) on delete set null,
  linked_decision_id uuid references decisions(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table incidents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  incident_no text not null,
  title text not null,
  description text,
  priority incident_priority not null default 'p3',
  status incident_status not null default 'open',
  owner_id uuid references profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  due_at timestamptz,
  resolved_at timestamptz,
  resolution text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, incident_no)
);

create table readiness_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  check_code text not null,
  category text not null,
  title text not null,
  owner_id uuid references profiles(id) on delete set null,
  status readiness_status not null default 'not_ready',
  evidence text,
  required_action text,
  due_date date,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, check_code)
);

create table team_status_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  workstream_id uuid references workstreams(id) on delete set null,
  owner_id uuid references profiles(id) on delete set null,
  status readiness_status not null default 'not_ready',
  summary text not null,
  blockers text,
  support_needed text,
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table go_no_go_reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  review_date date not null default current_date,
  readiness_score integer not null check (readiness_score between 0 and 100),
  status go_no_go_status not null,
  decision_summary text not null,
  blockers_summary text,
  decision_owner_id uuid references profiles(id) on delete set null,
  next_review_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_operation_events_project_time on operation_events(project_id, event_time desc);
create index idx_incidents_project_status on incidents(project_id, status, priority);
create index idx_readiness_checks_project_status on readiness_checks(project_id, status, category);
create index idx_team_status_project_reported on team_status_updates(project_id, reported_at desc);
create index idx_go_no_go_project_date on go_no_go_reviews(project_id, review_date desc);

alter table operation_events enable row level security;
alter table incidents enable row level security;
alter table readiness_checks enable row level security;
alter table team_status_updates enable row level security;
alter table go_no_go_reviews enable row level security;

create policy operation_events_read_authenticated on operation_events
  for select using (auth.role() = 'authenticated');

create policy operation_events_create_authenticated on operation_events
  for insert with check (auth.role() = 'authenticated');

create policy incidents_read_authenticated on incidents
  for select using (auth.role() = 'authenticated');

create policy incidents_manage_pm_pmo on incidents
  for all using (can_manage_project())
  with check (can_manage_project());

create policy incidents_create_authenticated on incidents
  for insert with check (auth.role() = 'authenticated');

create policy readiness_checks_read_authenticated on readiness_checks
  for select using (auth.role() = 'authenticated');

create policy readiness_checks_manage_pm_pmo on readiness_checks
  for all using (can_manage_project())
  with check (can_manage_project());

create policy team_status_updates_read_authenticated on team_status_updates
  for select using (auth.role() = 'authenticated');

create policy team_status_updates_create_authenticated on team_status_updates
  for insert with check (auth.role() = 'authenticated');

create policy go_no_go_reviews_read_authenticated on go_no_go_reviews
  for select using (auth.role() = 'authenticated');

create policy go_no_go_reviews_manage_leadership on go_no_go_reviews
  for all using (
    has_any_role(array['project_director','project_manager','pmo']::user_role[])
  )
  with check (
    has_any_role(array['project_director','project_manager','pmo']::user_role[])
  );

create view open_incidents as
select
  i.project_id,
  i.incident_no,
  i.title,
  i.priority,
  i.status,
  p.full_name as owner_name,
  i.opened_at,
  i.due_at
from incidents i
left join profiles p on p.id = i.owner_id
where i.status in ('open', 'in_progress');

create view readiness_overview as
select
  project_id,
  category,
  count(*) as total_checks,
  count(*) filter (where status = 'ready') as ready_checks,
  count(*) filter (where status = 'at_risk') as at_risk_checks,
  count(*) filter (where status = 'not_ready') as not_ready_checks,
  round(
    (count(*) filter (where status = 'ready')::numeric / nullif(count(*), 0)) * 100,
    2
  ) as readiness_pct
from readiness_checks
group by project_id, category;

create view operations_room_overview as
select
  p.id as project_id,
  p.name as project_name,
  coalesce(count(distinct i.id) filter (where i.status in ('open', 'in_progress')), 0) as open_incidents,
  coalesce(count(distinct i.id) filter (where i.priority = 'p1' and i.status in ('open', 'in_progress')), 0) as p1_incidents,
  coalesce(count(distinct rc.id) filter (where rc.status = 'not_ready'), 0) as not_ready_checks,
  coalesce(count(distinct rc.id) filter (where rc.status = 'at_risk'), 0) as at_risk_checks,
  max(g.review_date) as latest_go_no_go_review
from projects p
left join incidents i on i.project_id = p.id
left join readiness_checks rc on rc.project_id = p.id
left join go_no_go_reviews g on g.project_id = p.id
group by p.id, p.name;
