create type public.price_change_type as enum ('initial', 'increase', 'decrease');
create type public.stock_change_type as enum ('initial', 'changed');

create table public.listing_price_history (
  id bigint generated always as identity primary key,
  listing_variant_id bigint not null references public.listing_variants(id) on delete cascade,
  price numeric(10, 2) not null,
  currency text not null default 'USD',
  observed_at timestamptz not null default now(),
  change_type public.price_change_type not null
);

create index listing_price_history_variant_idx
  on public.listing_price_history (listing_variant_id, observed_at desc);

create table public.listing_stock_history (
  id bigint generated always as identity primary key,
  listing_variant_id bigint not null references public.listing_variants(id) on delete cascade,
  stock_status public.stock_status not null,
  stock_raw text,
  observed_at timestamptz not null default now(),
  change_type public.stock_change_type not null
);

create index listing_stock_history_variant_idx
  on public.listing_stock_history (listing_variant_id, observed_at desc);
