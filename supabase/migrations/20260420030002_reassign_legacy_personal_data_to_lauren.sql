-- Move legacy personal data from the bootstrap Google account to the real
-- Lauren Hickey account. This is guarded so it becomes a no-op on installs
-- that do not have both users, and it fails fast if rows already exist on the
-- destination account for the same perfume.

do $$
declare
  source_user_id uuid;
  destination_user_id uuid;
begin
  select id into source_user_id
  from auth.users
  where email = 'notlaurenhickey@gmail.com'
  order by created_at
  limit 1;

  select id into destination_user_id
  from auth.users
  where email = 'laurenhickey@gmail.com'
  order by created_at
  limit 1;

  if source_user_id is null or destination_user_id is null then
    return;
  end if;

  if source_user_id = destination_user_id then
    return;
  end if;

  if exists (
    select 1
    from public.personal_perfumes src
    join public.personal_perfumes dst
      on dst.user_id = destination_user_id
     and dst.perfume_id = src.perfume_id
    where src.user_id = source_user_id
  ) then
    raise exception
      'Cannot move legacy personal data: destination account already owns one or more of the same perfumes';
  end if;

  update public.personal_perfumes
  set user_id = destination_user_id
  where user_id = source_user_id;

  update public.personal_perfume_notes
  set user_id = destination_user_id
  where user_id = source_user_id;

  update public.personal_perfume_theme_tags
  set user_id = destination_user_id
  where user_id = source_user_id;

  update public.journal_entries
  set user_id = destination_user_id
  where user_id = source_user_id;
end $$;
