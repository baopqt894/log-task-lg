const email = process.env.ADMIN_EMAIL
const fullName = process.env.ADMIN_FULL_NAME || 'Administrator'

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
}

function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`
}

requireEnv('ADMIN_EMAIL', email)

const sql = `
alter table public.roles disable row level security;
alter table public.users disable row level security;

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
      'manage_tasks',
      'create_projects'
    ]::text[]
  )
on conflict (name) do nothing;

insert into public.users (id, email, full_name, role_id, is_active)
select auth_user.id, auth_user.email, ${sqlString(fullName)}, role.id, true
from auth.users auth_user
cross join public.roles role
where auth_user.email = ${sqlString(email)}
  and role.name = 'admin'
on conflict (id) do update set
  email = excluded.email,
  full_name = excluded.full_name,
  role_id = excluded.role_id,
  is_active = true,
  updated_at = now();

select
  case
    when exists (select 1 from public.users where email = ${sqlString(email)})
      then 'admin profile ready'
    when exists (select 1 from auth.users where email = ${sqlString(email)})
      then 'auth user exists but profile insert failed'
    else 'auth user not found - create it in Authentication > Users first'
  end as status;
`

console.log('1. Create this user in Supabase Dashboard > Authentication > Users first:')
console.log(`   ${email}`)
console.log('')
console.log('2. Then run this SQL in Supabase SQL Editor:')
console.log(sql.trim())
