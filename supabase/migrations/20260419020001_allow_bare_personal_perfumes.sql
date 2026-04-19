-- Allow personal_perfumes rows that aren't in Collection or Wanted, so a user
-- can attach tags / notes to a perfume without first "saving" it. The CHECK
-- constraint on (in_collection OR in_wanted) previously forced every row to
-- belong to at least one list. Dropping it lets bare rows exist as a home for
-- tag attachments.

do $$
declare
  con_name text;
begin
  for con_name in
    select conname
    from pg_constraint
    where conrelid = 'public.personal_perfumes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%in_collection%'
      and pg_get_constraintdef(oid) ilike '%in_wanted%'
  loop
    execute format(
      'alter table public.personal_perfumes drop constraint %I',
      con_name
    );
  end loop;
end $$;
