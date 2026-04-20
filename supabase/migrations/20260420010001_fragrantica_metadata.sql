alter table public.perfumes
  add column release_year integer,
  add column gender text,
  add column notes_top text[] not null default '{}'::text[],
  add column notes_middle text[] not null default '{}'::text[],
  add column notes_base text[] not null default '{}'::text[],
  add column fragrantica_rating real,
  add column fragrantica_votes integer,
  add column fragrantica_longevity text,
  add column fragrantica_sillage text,
  add column fragrantica_url text,
  add column fragrantica_last_synced_at timestamptz;

create unique index perfumes_fragrantica_url_unique
  on public.perfumes (fragrantica_url)
  where fragrantica_url is not null;
