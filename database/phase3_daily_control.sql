-- Phase 3: Daily Control database additions
-- Apply after database/schema.sql

alter table task_updates
  add column if not exists needs_decision boolean not null default false,
  add column if not exists needs_escalation boolean not null default false;

alter table tasks
  add column if not exists is_stale boolean not null default false,
  add column if not exists blocker_open boolean not null default false;

create or replace function calculate_schedule_status(
  p_progress progress_status,
  p_planned_finish date,
  p_today date default current_date
)
returns schedule_status
language plpgsql
immutable
as $$
begin
  if p_planned_finish is null then
    return 'no_dates';
  end if;

  if p_progress in ('completed', 'cancelled') then
    return 'on_track';
  end if;

  if p_planned_finish < p_today - 14 then
    return 'critical';
  end if;

  if p_planned_finish < p_today then
    return 'overdue';
  end if;

  if p_planned_finish <= p_today + 7 then
    return 'due_soon';
  end if;

  return 'on_track';
end;
$$;

create or replace function validate_daily_update()
returns trigger
language plpgsql
as $$
begin
  if new.percent_complete is not null and (new.percent_complete < 0 or new.percent_complete > 100) then
    raise exception 'percent_complete must be between 0 and 100';
  end if;

  if new.progress_status = 'completed' and coalesce(new.percent_complete, 0) <> 100 then
    raise exception 'completed updates must have percent_complete = 100';
  end if;

  if new.progress_status = 'not_started' and coalesce(new.percent_complete, 0) <> 0 then
    raise exception 'not_started updates must have percent_complete = 0';
  end if;

  if new.progress_status = 'blocked' and coalesce(trim(new.blocker), '') = '' then
    raise exception 'blocked updates require blocker';
  end if;

  if new.progress_status not in ('completed', 'cancelled') and new.next_update_due is null then
    raise exception 'active updates require next_update_due';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_daily_update on task_updates;
create trigger trg_validate_daily_update
before insert or update on task_updates
for each row execute function validate_daily_update();

create or replace function apply_task_update()
returns trigger
language plpgsql
as $$
declare
  before_state jsonb;
  after_state jsonb;
begin
  select to_jsonb(t) into before_state
  from tasks t
  where t.id = new.task_id;

  update tasks
  set
    percent_complete = coalesce(new.percent_complete, percent_complete),
    progress_status = coalesce(new.progress_status, progress_status),
    last_update_at = new.created_at,
    blocker_open = coalesce(trim(new.blocker), '') <> '',
    is_stale = false,
    schedule_status = calculate_schedule_status(
      coalesce(new.progress_status, progress_status),
      planned_finish,
      current_date
    ),
    actual_start = case
      when actual_start is null and coalesce(new.percent_complete, 0) > 0 then current_date
      else actual_start
    end,
    actual_finish = case
      when new.progress_status = 'completed' then current_date
      else actual_finish
    end,
    updated_at = now()
  where id = new.task_id;

  select to_jsonb(t) into after_state
  from tasks t
  where t.id = new.task_id;

  insert into audit_logs (
    actor_id,
    entity_type,
    entity_id,
    action,
    before_json,
    after_json,
    reason
  )
  values (
    new.user_id,
    'task',
    new.task_id,
    'task_update_created',
    before_state,
    after_state,
    'daily_update'
  );

  return new;
end;
$$;

drop trigger if exists trg_apply_task_update on task_updates;
create trigger trg_apply_task_update
after insert on task_updates
for each row execute function apply_task_update();

create or replace view daily_control_queue as
select
  t.id,
  t.project_id,
  t.wbs_code,
  t.title,
  t.phase,
  t.owner_id,
  p.full_name as owner_name,
  t.planned_start,
  t.planned_finish,
  t.percent_complete,
  t.progress_status,
  t.schedule_status,
  t.last_update_at,
  case
    when t.progress_status in ('completed', 'cancelled') then false
    when t.last_update_at is null and (t.planned_start is null or t.planned_start <= current_date + 7) then true
    when t.last_update_at < now() - interval '3 days' then true
    else false
  end as is_stale_now,
  t.blocker_open,
  case
    when t.schedule_status = 'critical' then 1
    when t.schedule_status = 'overdue' then 2
    when t.blocker_open then 3
    when t.schedule_status = 'due_soon' then 4
    when t.last_update_at is null then 5
    else 9
  end as queue_rank
from tasks t
left join profiles p on p.id = t.owner_id
where t.progress_status not in ('completed', 'cancelled');

create or replace view owner_update_compliance as
select
  owner_id,
  count(*) as open_tasks,
  count(*) filter (
    where last_update_at is not null and last_update_at >= now() - interval '3 days'
  ) as updated_recently,
  count(*) filter (
    where last_update_at is null or last_update_at < now() - interval '3 days'
  ) as stale_tasks
from tasks
where progress_status not in ('completed', 'cancelled')
group by owner_id;

