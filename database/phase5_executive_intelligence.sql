-- Phase 5: Executive Intelligence database additions
-- Apply after previous phase SQL files

create or replace view executive_schedule_metrics as
select
  project_id,
  count(*) as total_tasks,
  avg(percent_complete)::numeric(5,2) as completion_pct,
  count(*) filter (where schedule_status = 'critical') as critical_tasks,
  count(*) filter (where schedule_status = 'overdue') as overdue_tasks,
  count(*) filter (where schedule_status = 'due_soon') as due_soon_tasks,
  count(*) filter (
    where progress_status not in ('completed', 'cancelled')
      and (last_update_at is null or last_update_at < now() - interval '3 days')
  ) as stale_tasks
from tasks
group by project_id;

create or replace view executive_risk_metrics as
select
  project_id,
  count(*) filter (where treatment_status <> 'closed') as open_risks,
  count(*) filter (where treatment_status <> 'closed' and severity >= 20) as critical_risks,
  coalesce(sum(severity) filter (where treatment_status <> 'closed'), 0) as severity_total
from risks
group by project_id;

create or replace view executive_decision_metrics as
select
  project_id,
  count(*) filter (where status in ('draft', 'submitted', 'under_review', 'escalated')) as open_decisions,
  count(*) filter (where priority = 'urgent' and status in ('draft', 'submitted', 'under_review', 'escalated')) as urgent_decisions,
  count(*) filter (where due_date < current_date and status in ('draft', 'submitted', 'under_review', 'escalated')) as overdue_decisions
from decisions
group by project_id;

create or replace view executive_approval_metrics as
select
  project_id,
  count(*) filter (where status in ('draft', 'submitted', 'under_review', 'escalated')) as pending_approvals,
  count(*) filter (where type = 'contract' and status in ('draft', 'submitted', 'under_review', 'escalated')) as contract_approvals,
  count(*) filter (where type = 'review' and status in ('draft', 'submitted', 'under_review', 'escalated')) as review_approvals
from approvals
group by project_id;

create or replace view executive_overview as
select
  p.id as project_id,
  p.name as project_name,
  coalesce(s.total_tasks, 0) as total_tasks,
  coalesce(s.completion_pct, 0) as completion_pct,
  coalesce(s.critical_tasks, 0) as critical_tasks,
  coalesce(s.overdue_tasks, 0) as overdue_tasks,
  coalesce(s.stale_tasks, 0) as stale_tasks,
  coalesce(r.open_risks, 0) as open_risks,
  coalesce(r.critical_risks, 0) as critical_risks,
  coalesce(d.urgent_decisions, 0) as urgent_decisions,
  coalesce(a.pending_approvals, 0) as pending_approvals,
  greatest(
    0,
    least(
      100,
      100
      - coalesce(s.critical_tasks, 0) * 3
      - coalesce(r.open_risks, 0) * 2
      - coalesce(d.urgent_decisions, 0) * 2
    )
  ) as health_score,
  case
    when greatest(0, least(100, 100 - coalesce(s.critical_tasks, 0) * 3 - coalesce(r.open_risks, 0) * 2 - coalesce(d.urgent_decisions, 0) * 2)) >= 85 then 'green'
    when greatest(0, least(100, 100 - coalesce(s.critical_tasks, 0) * 3 - coalesce(r.open_risks, 0) * 2 - coalesce(d.urgent_decisions, 0) * 2)) >= 65 then 'amber'
    else 'red'
  end as health_status
from projects p
left join executive_schedule_metrics s on s.project_id = p.id
left join executive_risk_metrics r on r.project_id = p.id
left join executive_decision_metrics d on d.project_id = p.id
left join executive_approval_metrics a on a.project_id = p.id;

