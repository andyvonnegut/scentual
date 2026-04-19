create table public.notes (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  note_family text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch_notes_updated_at
before update on public.notes
for each row execute function public.touch_updated_at();

create table public.source_notes (
  id bigint generated always as identity primary key,
  retailer_id bigint not null references public.retailers(id) on delete cascade,
  raw_note_name text not null,
  normalized_note_id bigint references public.notes(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (retailer_id, raw_note_name)
);

create index source_notes_normalized_idx on public.source_notes (normalized_note_id);

create table public.perfume_notes (
  id bigint generated always as identity primary key,
  perfume_id bigint not null references public.perfumes(id) on delete cascade,
  note_id bigint not null references public.notes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (perfume_id, note_id)
);

create index perfume_notes_note_idx on public.perfume_notes (note_id);

create table public.perfume_source_notes (
  id bigint generated always as identity primary key,
  perfume_listing_id bigint not null references public.perfume_listings(id) on delete cascade,
  raw_note_text text not null,
  normalized_note_id bigint references public.notes(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (perfume_listing_id, raw_note_text)
);

create index perfume_source_notes_listing_idx
  on public.perfume_source_notes (perfume_listing_id);
