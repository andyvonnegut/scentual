create table public.journal_entries (
  id bigint generated always as identity primary key,
  perfume_id bigint not null references public.perfumes(id) on delete cascade,
  title text,
  body text not null,
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index journal_entries_perfume_entry_date_idx
  on public.journal_entries (perfume_id, entry_date desc);
create index journal_entries_entry_date_idx
  on public.journal_entries (entry_date desc);

create trigger touch_journal_entries_updated_at
before update on public.journal_entries
for each row execute function public.touch_updated_at();
