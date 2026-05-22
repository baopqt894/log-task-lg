alter table public.users
  add column if not exists avatar_url text;

comment on column public.users.avatar_url is 'Public URL for the user profile avatar image.';
