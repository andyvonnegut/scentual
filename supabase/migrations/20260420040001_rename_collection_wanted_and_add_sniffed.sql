-- Rename the two personal_perfumes taxonomy flags (collection → owned,
-- wanted → desired) and introduce a third: sniffed (smelled but doesn't
-- own or want). Column renames preserve all data in place. The old
-- `in_collection OR in_wanted` CHECK was dropped in
-- 20260419020001_allow_bare_personal_perfumes.sql, so bare rows still work.

alter table public.personal_perfumes
  rename column in_collection to in_owned;
alter table public.personal_perfumes
  rename column in_wanted to in_desired;
alter table public.personal_perfumes
  rename column added_to_collection_at to added_to_owned_at;
alter table public.personal_perfumes
  rename column added_to_wanted_at to added_to_desired_at;

alter index personal_perfumes_collection_idx
  rename to personal_perfumes_owned_idx;
alter index personal_perfumes_wanted_idx
  rename to personal_perfumes_desired_idx;

alter table public.personal_perfumes
  add column in_sniffed boolean not null default false,
  add column added_to_sniffed_at timestamptz;

create index personal_perfumes_sniffed_idx
  on public.personal_perfumes (in_sniffed) where in_sniffed;
