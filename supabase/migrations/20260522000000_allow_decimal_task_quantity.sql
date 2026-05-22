alter table public.tasks
  alter column quantity type numeric using quantity::numeric;

comment on column public.tasks.quantity is 'Workload quantity in WL. Supports fractional values.';
