-- Stable-id uniqueness for listings.
-- Keying listings on (retailer_id, source_url) breaks when upstream retailers
-- change a product's URL handle (e.g. fixing bad vendor/title metadata).
-- For retailers that expose a stable product id, prefer that as the upsert
-- key. Partial index keeps rows with null source_product_id unaffected.
create unique index if not exists perfume_listings_retailer_product_unique
  on public.perfume_listings (retailer_id, source_product_id)
  where source_product_id is not null;
