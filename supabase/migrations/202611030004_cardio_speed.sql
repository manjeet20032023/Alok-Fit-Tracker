alter table public.cardio_entries
  add column if not exists speed_kph numeric check (speed_kph is null or speed_kph >= 0);