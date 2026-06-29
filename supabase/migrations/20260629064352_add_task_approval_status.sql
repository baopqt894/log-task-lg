alter table public.tasks
  add column if not exists approval_status text not null default 'pending';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_approval_status_check'
  ) then
    alter table public.tasks
      add constraint tasks_approval_status_check
      check (approval_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

comment on column public.tasks.approval_status is 'Admin approval status for KPI counting: pending, approved, or rejected.';
