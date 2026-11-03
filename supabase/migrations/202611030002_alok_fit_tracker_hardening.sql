create table if not exists public.personal_records (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_name text not null,
  type text not null check (type in ('weight','reps_at_weight','estimated_1rm','duration','distance')),
  value numeric not null,
  unit text not null,
  workout_id uuid references public.workouts(id) on delete set null,
  achieved_at timestamptz not null,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.personal_records enable row level security;
drop policy if exists "personal_records_owner" on public.personal_records;
create policy "personal_records_owner" on public.personal_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists workout_exercises_workout_idx on public.workout_exercises(workout_id, sort_order);
create index if not exists workout_sets_workout_idx on public.workout_sets(workout_id, workout_exercise_id);
create index if not exists cardio_workout_idx on public.cardio_entries(workout_id);
create index if not exists measurements_user_date_idx on public.measurements(user_id, measured_at desc);
create index if not exists goals_user_status_idx on public.goals(user_id, status);
create index if not exists personal_records_user_exercise_idx on public.personal_records(user_id, exercise_name, achieved_at desc);
