-- Phase 4: Decisions, Risks, and Approvals database additions
-- Apply after database/schema.sql

alter table risks
  add column if not exists source text not null default 'manual',
  add column if not exists linked_wbs_code text;

alter table decisions
  add column if not exists source text not null default 'manual',
  add column if not exists linked_wbs_code text;

alter table approvals
  add column if not exists source text not null default 'manual',
  add column if not exists linked_wbs_code text;

create index if not exists idx_risks_linked_wbs_code on risks(linked_wbs_code);
create index if not exists idx_decisions_linked_wbs_code on decisions(linked_wbs_code);
create index if not exists idx_approvals_linked_wbs_code on approvals(linked_wbs_code);

create or replace view open_risks_summary as
select
  r.project_id,
  count(*) as open_risks,
  count(*) filter (where r.severity >= 20) as critical_risks,
  count(*) filter (where r.severity between 12 and 19) as high_risks,
  count(*) filter (where r.severity between 6 and 11) as medium_risks,
  count(*) filter (where r.treatment_status in ('draft', 'submitted', 'under_review', 'escalated')) as needs_action
from risks r
where r.treatment_status <> 'closed'
group by r.project_id;

create or replace view urgent_decisions as
select
  d.id,
  d.project_id,
  d.linked_task_id,
  d.linked_risk_id,
  d.linked_wbs_code,
  d.title,
  d.priority,
  d.status,
  d.due_date,
  d.impact_if_delayed,
  d.created_at,
  case
    when d.due_date is not null and d.due_date < current_date then 'overdue'
    when d.priority = 'urgent' then 'urgent'
    when d.due_date is not null and d.due_date <= current_date + 3 then 'due_soon'
    else 'normal'
  end as decision_pressure
from decisions d
where d.status in ('draft', 'submitted', 'under_review', 'escalated');

create or replace view pending_approvals as
select
  a.id,
  a.project_id,
  a.linked_task_id,
  a.linked_wbs_code,
  a.type,
  a.title,
  a.status,
  a.due_date,
  a.created_at,
  case
    when a.due_date is not null and a.due_date < current_date then 'overdue'
    when a.due_date is not null and a.due_date <= current_date + 7 then 'due_soon'
    else 'normal'
  end as approval_pressure
from approvals a
where a.status in ('draft', 'submitted', 'under_review', 'escalated');

create or replace view control_center_overview as
select
  p.id as project_id,
  p.name as project_name,
  coalesce(r.open_risks, 0) as open_risks,
  coalesce(r.critical_risks, 0) as critical_risks,
  coalesce(ud.urgent_decisions_count, 0) as urgent_decisions,
  coalesce(pa.pending_approvals_count, 0) as pending_approvals
from projects p
left join open_risks_summary r on r.project_id = p.id
left join (
  select project_id, count(*) as urgent_decisions_count
  from urgent_decisions
  where decision_pressure in ('urgent', 'overdue', 'due_soon')
  group by project_id
) ud on ud.project_id = p.id
left join (
  select project_id, count(*) as pending_approvals_count
  from pending_approvals
  group by project_id
) pa on pa.project_id = p.id;

