create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  height_cm numeric,
  weight_kg numeric,
  goal text,
  weight_unit text not null default 'kg',
  distance_unit text not null default 'km',
  target_minutes integer not null default 135,
  theme text not null default 'light',
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(user_id)
);

create table if not exists public.workouts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  local_date date not null,
  timezone text not null,
  planned_focus text[] not null default '{}',
  status text not null check (status in ('in_progress','paused','completed','abandoned')),
  started_at timestamptz not null,
  paused_at timestamptz,
  last_resumed_at timestamptz,
  total_paused_seconds integer not null default 0 check (total_paused_seconds >= 0),
  completed_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  notes text not null default '',
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists workouts_user_date_idx on public.workouts(user_id, local_date);

create table if not exists public.exercises (
  id uuid primary key,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  muscle_groups text[] not null default '{}',
  equipment text not null default '',
  exercise_type text not null,
  instructions text not null default '',
  is_custom boolean not null default false,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.workout_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  name text not null,
  muscle_group text not null default '',
  section text not null check (section in ('weight','core')),
  sort_order integer not null default 0,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.workout_sets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_number integer not null check (set_number > 0),
  reps integer check (reps is null or reps >= 0),
  weight_kg numeric check (weight_kg is null or weight_kg >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  completed boolean not null default false,
  notes text not null default '',
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.cardio_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  activity_type text not null,
  duration_seconds integer not null check (duration_seconds >= 0),
  distance_meters numeric check (distance_meters is null or distance_meters >= 0),
  incline_percent numeric,
  heart_rate integer check (heart_rate is null or heart_rate >= 0),
  calories numeric check (calories is null or calories >= 0),
  notes text not null default '',
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.measurements (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  value numeric not null,
  unit text not null,
  measured_at timestamptz not null,
  note text not null default '',
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.goals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_value numeric not null,
  unit text not null,
  start_value numeric not null,
  start_date date not null,
  target_date date,
  status text not null check (status in ('active','paused','archived','completed')),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

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

create table if not exists public.progress_photos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('front','side','back','custom')),
  captured_at timestamptz not null,
  note text not null default '',
  storage_key text not null,
  content_type text not null,
  file_size_bytes bigint not null check (file_size_bytes >= 0),
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.workouts enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.cardio_entries enable row level security;
alter table public.measurements enable row level security;
alter table public.goals enable row level security;
alter table public.progress_photos enable row level security;
alter table public.personal_records enable row level security;

drop policy if exists "profiles_owner" on public.profiles;
drop policy if exists "workouts_owner" on public.workouts;
drop policy if exists "exercises_owner_or_seed" on public.exercises;
drop policy if exists "exercises_owner_write" on public.exercises;
drop policy if exists "exercises_owner_update" on public.exercises;
drop policy if exists "exercises_owner_delete" on public.exercises;
drop policy if exists "workout_exercises_owner" on public.workout_exercises;
drop policy if exists "workout_sets_owner" on public.workout_sets;
drop policy if exists "cardio_owner" on public.cardio_entries;
drop policy if exists "measurements_owner" on public.measurements;
drop policy if exists "goals_owner" on public.goals;
drop policy if exists "photos_owner" on public.progress_photos;
drop policy if exists "personal_records_owner" on public.personal_records;

drop policy if exists "progress_photos_owner_select" on storage.objects;
drop policy if exists "progress_photos_owner_insert" on storage.objects;
drop policy if exists "progress_photos_owner_delete" on storage.objects;

create policy "profiles_owner" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workouts_owner" on public.workouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercises_owner_or_seed" on public.exercises for select using (user_id is null or auth.uid() = user_id);
create policy "exercises_owner_write" on public.exercises for insert with check (auth.uid() = user_id);
create policy "exercises_owner_update" on public.exercises for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercises_owner_delete" on public.exercises for delete using (auth.uid() = user_id);
create policy "workout_exercises_owner" on public.workout_exercises for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_sets_owner" on public.workout_sets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cardio_owner" on public.cardio_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "measurements_owner" on public.measurements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals_owner" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "photos_owner" on public.progress_photos for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "personal_records_owner" on public.personal_records for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public) values ('progress-photos', 'progress-photos', false)
on conflict (id) do update set public = false;

create policy "progress_photos_owner_select" on storage.objects for select using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress_photos_owner_insert" on storage.objects for insert with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "progress_photos_owner_delete" on storage.objects for delete using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create index if not exists workout_exercises_workout_idx on public.workout_exercises(workout_id, sort_order);
create index if not exists workout_sets_workout_idx on public.workout_sets(workout_id, workout_exercise_id);
create index if not exists cardio_workout_idx on public.cardio_entries(workout_id);
create index if not exists measurements_user_date_idx on public.measurements(user_id, measured_at desc);
create index if not exists goals_user_status_idx on public.goals(user_id, status);
create index if not exists personal_records_user_exercise_idx on public.personal_records(user_id, exercise_name, achieved_at desc);
