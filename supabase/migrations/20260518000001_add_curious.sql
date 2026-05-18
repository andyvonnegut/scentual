-- Add a fourth personal_perfumes taxonomy flag: curious (interested but
-- not yet ready to mark as desired). Parallel to in_owned / in_desired /
-- in_sniffed. The original `in_collection OR in_wanted` CHECK was dropped
-- in 20260419020001_allow_bare_personal_perfumes.sql, so bare rows still
-- work with all four flags false.

alter table public.personal_perfumes
  add column in_curious boolean not null default false,
  add column added_to_curious_at timestamptz;

create index personal_perfumes_curious_idx
  on public.personal_perfumes (in_curious) where in_curious;
