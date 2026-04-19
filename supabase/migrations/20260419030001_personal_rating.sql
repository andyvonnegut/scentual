-- Per-perfume personal rating on a 1..5 scale. Nullable — null means "not rated yet".
-- Lives on personal_perfumes alongside size_owned_text and personal_note. A row may exist
-- bare (both list flags false) purely to carry a rating; app/actions/library.ts treats
-- a non-null rating as personal data worth preserving when un-toggling list flags.

alter table public.personal_perfumes
  add column rating smallint check (rating between 1 and 5);
