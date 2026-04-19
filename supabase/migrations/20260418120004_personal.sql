-- Unified library: one row per perfume, shared metadata across Collection/Wanted states.
create table public.personal_perfumes (
  id bigint generated always as identity primary key,
  perfume_id bigint not null unique references public.perfumes(id) on delete cascade,
  in_collection boolean not null default false,
  in_wanted boolean not null default false,
  size_owned_text text,
  personal_note text,
  added_to_collection_at timestamptz,
  added_to_wanted_at timestamptz,
  updated_at timestamptz not null default now(),
  check (in_collection or in_wanted)
);

create index personal_perfumes_collection_idx
  on public.personal_perfumes (in_collection) where in_collection;
create index personal_perfumes_wanted_idx
  on public.personal_perfumes (in_wanted) where in_wanted;

create trigger touch_personal_perfumes_updated_at
before update on public.personal_perfumes
for each row execute function public.touch_updated_at();
