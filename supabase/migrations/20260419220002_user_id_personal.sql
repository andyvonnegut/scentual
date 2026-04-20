-- Scope all personal data to an auth.users id.
-- user_id is nullable here so the migration can run before backfill.
-- After Andy signs in once and existing rows are assigned to his uuid, a
-- follow-up migration (20260419220004_user_id_notnull.sql) flips the columns
-- to NOT NULL.

alter table public.personal_perfumes
  add column user_id uuid references auth.users(id) on delete cascade;

alter table public.personal_perfume_notes
  add column user_id uuid references auth.users(id) on delete cascade;

alter table public.personal_perfume_theme_tags
  add column user_id uuid references auth.users(id) on delete cascade;

alter table public.journal_entries
  add column user_id uuid references auth.users(id) on delete cascade;

-- Replace the per-perfume unique on personal_perfumes with a composite
-- unique so two users can each have a row for the same perfume.
do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.personal_perfumes'::regclass
    and contype = 'u'
    and pg_get_constraintdef(oid) = 'UNIQUE (perfume_id)';
  if con_name is not null then
    execute format('alter table public.personal_perfumes drop constraint %I', con_name);
  end if;
end $$;

create unique index personal_perfumes_user_perfume_uidx
  on public.personal_perfumes (user_id, perfume_id);

-- Indexes to keep RLS-filtered reads fast.
create index personal_perfumes_user_idx on public.personal_perfumes (user_id);
create index personal_perfume_notes_user_idx on public.personal_perfume_notes (user_id);
create index personal_perfume_theme_tags_user_idx on public.personal_perfume_theme_tags (user_id);
create index journal_entries_user_idx on public.journal_entries (user_id);
