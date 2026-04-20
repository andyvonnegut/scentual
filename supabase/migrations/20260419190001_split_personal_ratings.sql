-- Split the personal 1..5 rating into three independent scales.
-- Existing values migrate into projection_rating because the current atomizer
-- control is being reinterpreted as projection.

alter table public.personal_perfumes
  add column projection_rating smallint check (projection_rating between 1 and 5),
  add column overall_rating smallint check (overall_rating between 1 and 5),
  add column design_rating smallint check (design_rating between 1 and 5);

update public.personal_perfumes
set projection_rating = rating
where rating is not null;

alter table public.personal_perfumes
  drop column rating;
