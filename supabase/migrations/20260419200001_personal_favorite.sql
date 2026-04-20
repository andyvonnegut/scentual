-- Add a personal favorite flag per perfume.
-- A bare personal_perfumes row may exist solely to carry favorite state.

alter table public.personal_perfumes
  add column favorite boolean not null default false;
