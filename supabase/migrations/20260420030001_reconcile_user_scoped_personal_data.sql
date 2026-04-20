-- Reconcile installs that missed the original per-user personal-data rollout.
-- The intended end-state already exists in the app code and architecture docs:
-- profiles are keyed by auth.users.id, and personal_* / journal rows are
-- scoped by user_id with authenticated write policies.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'touch_profiles_updated_at'
      and tgrelid = 'public.profiles'::regclass
  ) then
    create trigger touch_profiles_updated_at
    before update on public.profiles
    for each row execute function public.touch_updated_at();
  end if;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do update
  set display_name = excluded.display_name;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
      and tgrelid = 'auth.users'::regclass
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_self'
  ) then
    create policy profiles_select_self on public.profiles
      for select to authenticated
      using (id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_update_self'
  ) then
    create policy profiles_update_self on public.profiles
      for update to authenticated
      using (id = auth.uid())
      with check (id = auth.uid());
  end if;
end $$;

insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(coalesce(u.email, ''), '@', 1)
  )
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;

alter table public.personal_perfumes
  add column if not exists user_id uuid;

alter table public.personal_perfume_notes
  add column if not exists user_id uuid;

alter table public.personal_perfume_theme_tags
  add column if not exists user_id uuid;

alter table public.journal_entries
  add column if not exists user_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'personal_perfumes_user_id_fkey'
      and conrelid = 'public.personal_perfumes'::regclass
  ) then
    alter table public.personal_perfumes
      add constraint personal_perfumes_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'personal_perfume_notes_user_id_fkey'
      and conrelid = 'public.personal_perfume_notes'::regclass
  ) then
    alter table public.personal_perfume_notes
      add constraint personal_perfume_notes_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'personal_perfume_theme_tags_user_id_fkey'
      and conrelid = 'public.personal_perfume_theme_tags'::regclass
  ) then
    alter table public.personal_perfume_theme_tags
      add constraint personal_perfume_theme_tags_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'journal_entries_user_id_fkey'
      and conrelid = 'public.journal_entries'::regclass
  ) then
    alter table public.journal_entries
      add constraint journal_entries_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

do $$
declare
  target_user_id uuid;
  auth_user_count integer;
  unowned_rows integer;
begin
  select count(*) into auth_user_count from auth.users;

  select id into target_user_id
  from auth.users
  where email = 'notlaurenhickey@gmail.com'
  order by created_at
  limit 1;

  if target_user_id is null and auth_user_count = 1 then
    select id into target_user_id
    from auth.users
    order by created_at
    limit 1;
  end if;

  select
    coalesce((select count(*) from public.personal_perfumes where user_id is null), 0) +
    coalesce((select count(*) from public.personal_perfume_notes where user_id is null), 0) +
    coalesce((select count(*) from public.personal_perfume_theme_tags where user_id is null), 0) +
    coalesce((select count(*) from public.journal_entries where user_id is null), 0)
  into unowned_rows;

  if target_user_id is null and unowned_rows > 0 then
    raise exception
      'Cannot backfill personal data: no matching auth.users row found for the intended owner';
  end if;

  if target_user_id is not null then
    update public.personal_perfumes
    set user_id = target_user_id
    where user_id is null;

    update public.personal_perfume_notes
    set user_id = target_user_id
    where user_id is null;

    update public.personal_perfume_theme_tags
    set user_id = target_user_id
    where user_id is null;

    update public.journal_entries
    set user_id = target_user_id
    where user_id is null;
  end if;
end $$;

alter table public.personal_perfumes
  drop constraint if exists personal_perfumes_perfume_id_key;

create unique index if not exists personal_perfumes_user_perfume_uidx
  on public.personal_perfumes (user_id, perfume_id);

create index if not exists personal_perfumes_user_idx
  on public.personal_perfumes (user_id);

create index if not exists personal_perfume_notes_user_idx
  on public.personal_perfume_notes (user_id);

create index if not exists personal_perfume_theme_tags_user_idx
  on public.personal_perfume_theme_tags (user_id);

create index if not exists journal_entries_user_idx
  on public.journal_entries (user_id);

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_perfumes'
      and policyname = 'personal_perfumes_insert_self'
  ) then
    create policy personal_perfumes_insert_self
      on public.personal_perfumes for insert to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_perfumes'
      and policyname = 'personal_perfumes_update_self'
  ) then
    create policy personal_perfumes_update_self
      on public.personal_perfumes for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_perfumes'
      and policyname = 'personal_perfumes_delete_self'
  ) then
    create policy personal_perfumes_delete_self
      on public.personal_perfumes for delete to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_perfume_notes'
      and policyname = 'personal_perfume_notes_insert_self'
  ) then
    create policy personal_perfume_notes_insert_self
      on public.personal_perfume_notes for insert to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_perfume_notes'
      and policyname = 'personal_perfume_notes_update_self'
  ) then
    create policy personal_perfume_notes_update_self
      on public.personal_perfume_notes for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_perfume_notes'
      and policyname = 'personal_perfume_notes_delete_self'
  ) then
    create policy personal_perfume_notes_delete_self
      on public.personal_perfume_notes for delete to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_perfume_theme_tags'
      and policyname = 'personal_perfume_theme_tags_insert_self'
  ) then
    create policy personal_perfume_theme_tags_insert_self
      on public.personal_perfume_theme_tags for insert to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_perfume_theme_tags'
      and policyname = 'personal_perfume_theme_tags_update_self'
  ) then
    create policy personal_perfume_theme_tags_update_self
      on public.personal_perfume_theme_tags for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'personal_perfume_theme_tags'
      and policyname = 'personal_perfume_theme_tags_delete_self'
  ) then
    create policy personal_perfume_theme_tags_delete_self
      on public.personal_perfume_theme_tags for delete to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'journal_entries'
      and policyname = 'journal_entries_insert_self'
  ) then
    create policy journal_entries_insert_self
      on public.journal_entries for insert to authenticated
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'journal_entries'
      and policyname = 'journal_entries_update_self'
  ) then
    create policy journal_entries_update_self
      on public.journal_entries for update to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'journal_entries'
      and policyname = 'journal_entries_delete_self'
  ) then
    create policy journal_entries_delete_self
      on public.journal_entries for delete to authenticated
      using (user_id = auth.uid());
  end if;
end $$;
