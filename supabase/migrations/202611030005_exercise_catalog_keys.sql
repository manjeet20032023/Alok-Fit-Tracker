alter table public.exercises
  add column if not exists catalog_key text;

create unique index if not exists exercises_user_catalog_key_idx
  on public.exercises(user_id, catalog_key)
  where catalog_key is not null;