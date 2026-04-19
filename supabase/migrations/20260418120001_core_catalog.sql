-- Shared trigger function to bump updated_at.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.manufacturers (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch_manufacturers_updated_at
before update on public.manufacturers
for each row execute function public.touch_updated_at();

create table public.perfumes (
  id bigint generated always as identity primary key,
  manufacturer_id bigint not null references public.manufacturers(id) on delete restrict,
  name text not null,
  slug text not null,
  canonical_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manufacturer_id, slug)
);

create index perfumes_manufacturer_idx on public.perfumes (manufacturer_id);
create index perfumes_created_at_idx on public.perfumes (created_at desc);
create index perfumes_updated_at_idx on public.perfumes (updated_at desc);

create trigger touch_perfumes_updated_at
before update on public.perfumes
for each row execute function public.touch_updated_at();

create table public.retailers (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  base_url text not null
);

create table public.perfume_listings (
  id bigint generated always as identity primary key,
  perfume_id bigint not null references public.perfumes(id) on delete cascade,
  retailer_id bigint not null references public.retailers(id) on delete restrict,
  source_url text not null,
  source_product_id text,
  source_title text not null,
  source_description text,
  active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_scraped_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (retailer_id, source_url)
);

create index perfume_listings_perfume_idx on public.perfume_listings (perfume_id);
create index perfume_listings_retailer_idx on public.perfume_listings (retailer_id);

create trigger touch_perfume_listings_updated_at
before update on public.perfume_listings
for each row execute function public.touch_updated_at();

create type public.stock_status as enum (
  'in_stock', 'out_of_stock', 'low_stock', 'unavailable', 'unknown'
);

create table public.listing_variants (
  id bigint generated always as identity primary key,
  perfume_listing_id bigint not null references public.perfume_listings(id) on delete cascade,
  size_label text not null,
  size_value_ml numeric(8, 2),
  current_price numeric(10, 2),
  currency text not null default 'USD',
  current_stock_status public.stock_status not null default 'unknown',
  current_stock_raw text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (perfume_listing_id, size_label)
);

create index listing_variants_listing_idx on public.listing_variants (perfume_listing_id);

create trigger touch_listing_variants_updated_at
before update on public.listing_variants
for each row execute function public.touch_updated_at();
