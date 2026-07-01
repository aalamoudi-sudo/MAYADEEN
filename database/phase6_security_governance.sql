-- Phase 6: Security, Governance, and Permissions
-- Review before applying to production Supabase.

create or replace function current_profile_id()
returns uuid
language sql
stable
as $$
  select id
  from profiles
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function current_user_role()
returns user_role
language sql
stable
as $$
  select role
  from profiles
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function has_any_role(roles user_role[])
returns boolean
language sql
stable
as $$
  select coalesce(current_user_role() = any(roles), false)
$$;

create or replace function can_manage_project()
returns boolean
language sql
stable
as $$
  select has_any_role(array['project_director','project_manager','pmo']::user_role[])
$$;

create or replace function can_read_audit_log()
returns boolean
language sql
stable
as $$
  select has_any_role(array['project_director','project_manager','pmo']::user_role[])
$$;

-- Replace broad MVP policies with stricter policies.
drop policy if exists authenticated_read_profiles on profiles;
drop policy if exists authenticated_read_projects on projects;
drop policy if exists authenticated_read_workstreams on workstreams;
drop policy if exists authenticated_read_tasks on tasks;
drop policy if exists authenticated_read_task_updates on task_updates;
drop policy if exists authenticated_read_risks on risks;
drop policy if exists authenticated_read_decisions on decisions;
drop policy if exists authenticated_read_approvals on approvals;
drop policy if exists authenticated_read_documents on documents;
drop policy if exists authenticated_read_change_requests on change_requests;
drop policy if exists authenticated_insert_task_updates on task_updates;
drop policy if exists authenticated_insert_audit_logs on audit_logs;

create policy profiles_read_authenticated on profiles
  for select using (auth.role() = 'authenticated');

create policy profiles_update_self_or_admin on profiles
  for update using (
    id = current_profile_id()
    or has_any_role(array['project_director','pmo']::user_role[])
  );

create policy projects_read_authenticated on projects
  for select using (auth.role() = 'authenticated');

create policy projects_manage_admin on projects
  for all using (can_manage_project())
  with check (can_manage_project());

create policy workstreams_read_authenticated on workstreams
  for select using (auth.role() = 'authenticated');

create policy workstreams_manage_admin on workstreams
  for all using (can_manage_project())
  with check (can_manage_project());

create policy tasks_read_authenticated on tasks
  for select using (auth.role() = 'authenticated');

create policy tasks_update_manager_or_owner on tasks
  for update using (
    can_manage_project()
    or owner_id = current_profile_id()
  )
  with check (
    can_manage_project()
    or owner_id = current_profile_id()
  );

create policy tasks_insert_manager_or_pmo on tasks
  for insert with check (can_manage_project());

create policy task_updates_read_authenticated on task_updates
  for select using (auth.role() = 'authenticated');

create policy task_updates_insert_manager_or_owner on task_updates
  for insert with check (
    can_manage_project()
    or exists (
      select 1
      from tasks t
      where t.id = task_updates.task_id
        and t.owner_id = current_profile_id()
    )
  );

create policy risks_read_authenticated on risks
  for select using (auth.role() = 'authenticated');

create policy risks_manage_pm_pmo on risks
  for all using (can_manage_project())
  with check (can_manage_project());

create policy risks_create_owner_linked on risks
  for insert with check (
    can_manage_project()
    or exists (
      select 1
      from tasks t
      where t.id = risks.linked_task_id
        and t.owner_id = current_profile_id()
    )
  );

create policy decisions_read_authenticated on decisions
  for select using (auth.role() = 'authenticated');

create policy decisions_manage_pm_pmo on decisions
  for all using (can_manage_project())
  with check (can_manage_project());

create policy decisions_create_authenticated on decisions
  for insert with check (auth.role() = 'authenticated');

create policy approvals_read_authenticated on approvals
  for select using (auth.role() = 'authenticated');

create policy approvals_manage_pm_pmo on approvals
  for all using (can_manage_project())
  with check (can_manage_project());

create policy approvals_create_authenticated on approvals
  for insert with check (auth.role() = 'authenticated');

create policy documents_read_authenticated on documents
  for select using (auth.role() = 'authenticated');

create policy documents_manage_pm_pmo_or_owner on documents
  for all using (
    can_manage_project()
    or owner_id = current_profile_id()
  )
  with check (
    can_manage_project()
    or owner_id = current_profile_id()
  );

create policy change_requests_read_authenticated on change_requests
  for select using (auth.role() = 'authenticated');

create policy change_requests_create_authenticated on change_requests
  for insert with check (auth.role() = 'authenticated');

create policy change_requests_manage_pm_pmo_director on change_requests
  for update using (
    has_any_role(array['project_director','project_manager','pmo']::user_role[])
  )
  with check (
    has_any_role(array['project_director','project_manager','pmo']::user_role[])
  );

create policy audit_logs_read_governance on audit_logs
  for select using (can_read_audit_log());

create policy audit_logs_insert_authenticated on audit_logs
  for insert with check (auth.role() = 'authenticated');

create policy dashboard_snapshots_read_authenticated on dashboard_snapshots
  for select using (auth.role() = 'authenticated');

create policy dashboard_snapshots_manage_pm_pmo on dashboard_snapshots
  for all using (can_manage_project())
  with check (can_manage_project());

