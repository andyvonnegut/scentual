delete from public.scrape_runs
where source_name = 'fragrantica';

delete from public.perfumes p
where p.fragrantica_url is not null
  and not exists (
    select 1
    from public.perfume_listings pl
    where pl.perfume_id = p.id
  );

delete from public.manufacturers m
where not exists (
  select 1
  from public.perfumes p
  where p.manufacturer_id = m.id
);

drop index if exists public.perfumes_fragrantica_url_unique;

alter table public.perfumes
  drop column if exists release_year,
  drop column if exists gender,
  drop column if exists notes_top,
  drop column if exists notes_middle,
  drop column if exists notes_base,
  drop column if exists fragrantica_rating,
  drop column if exists fragrantica_votes,
  drop column if exists fragrantica_longevity,
  drop column if exists fragrantica_sillage,
  drop column if exists fragrantica_url,
  drop column if exists fragrantica_last_synced_at;
