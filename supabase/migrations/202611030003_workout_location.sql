alter table public.workouts
  add column if not exists location text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workouts_location_check'
      and conrelid = 'public.workouts'::regclass
  ) then
    alter table public.workouts
      add constraint workouts_location_check
      check (location is null or location in ('gym', 'home', 'other'));
  end if;
end
$$;