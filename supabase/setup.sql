create extension if not exists pgcrypto;

create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  avatar_url text,
  role_id uuid references public.roles(id),
  monthly_wl_kpi numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
  add column if not exists monthly_wl_kpi numeric not null default 0;

alter table public.users
  add column if not exists avatar_url text;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'running',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects
  add column if not exists status text not null default 'running';

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(project_id, user_id)
);

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.board_members (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  unique(board_id, user_id)
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references public.boards(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  assigned_to uuid references public.users(id) on delete set null,
  status text not null default 'not_started',
  task_type text,
  quantity numeric,
  estimated_hours integer,
  due_date date,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks
  add column if not exists board_id uuid references public.boards(id) on delete set null;

alter table public.tasks
  alter column quantity type numeric using quantity::numeric;

alter table public.tasks replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tasks'
  ) then
    alter publication supabase_realtime add table public.tasks;
  end if;
end $$;

alter table public.roles disable row level security;
alter table public.users disable row level security;
alter table public.projects disable row level security;
alter table public.project_members disable row level security;
alter table public.boards disable row level security;
alter table public.board_members disable row level security;
alter table public.tasks disable row level security;

insert into public.roles (name, description, permissions)
values
  (
    'admin',
    'Administrator',
    array[
      'manage_users',
      'manage_roles',
      'manage_projects',
      'manage_tasks',
      'view_reports',
      'create_projects'
    ]::text[]
  ),
  (
    'member',
    'Member',
    array[
      'manage_tasks'
    ]::text[]
  )
on conflict (name) do nothing;

update public.roles
set permissions = array['manage_tasks']::text[]
where name = 'member';

grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
