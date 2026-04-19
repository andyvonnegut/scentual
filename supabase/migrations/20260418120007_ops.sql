create type public.scrape_run_type as enum ('initial', 'daily');
create type public.scrape_run_status as enum ('running', 'succeeded', 'failed');

create table public.scrape_runs (
  id bigint generated always as identity primary key,
  source_name text not null,
  run_type public.scrape_run_type not null,
  status public.scrape_run_status not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_seen integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  error_summary text
);

create index scrape_runs_source_started_idx
  on public.scrape_runs (source_name, started_at desc);
