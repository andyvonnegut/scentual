-- Allow users to add their own scents from /collection.
--
-- A user-submitted row lives in the same perfumes/manufacturers tables as the
-- scraped catalog so that the existing (manufacturer_id, slug) dedup contract
-- is preserved. Privacy is enforced at the query layer (queries hide other
-- users' user-submitted rows). When the scraper later finds a matching scent,
-- ingestOne clears these flags in place, "promoting" the row to canonical
-- without touching the perfume id — every personal_perfumes row keeps working.

alter table public.manufacturers
  add column created_by_user_id uuid null references auth.users(id) on delete set null,
  add column is_user_submitted boolean not null default false;

alter table public.perfumes
  add column created_by_user_id uuid null references auth.users(id) on delete set null,
  add column is_user_submitted boolean not null default false;

create index manufacturers_created_by_user_id_idx
  on public.manufacturers (created_by_user_id)
  where created_by_user_id is not null;

create index perfumes_created_by_user_id_idx
  on public.perfumes (created_by_user_id)
  where created_by_user_id is not null;

-- Browser-originating writes only, scoped to the creator. Service-role
-- (scraper) writes bypass RLS entirely so the ingest pipeline is unaffected.
create policy manufacturers_insert_self
  on public.manufacturers for insert to authenticated
  with check (
    is_user_submitted = true
    and created_by_user_id = auth.uid()
  );

create policy manufacturers_update_self
  on public.manufacturers for update to authenticated
  using (created_by_user_id = auth.uid())
  with check (created_by_user_id = auth.uid());

create policy manufacturers_delete_self
  on public.manufacturers for delete to authenticated
  using (created_by_user_id = auth.uid());

create policy perfumes_insert_self
  on public.perfumes for insert to authenticated
  with check (
    is_user_submitted = true
    and created_by_user_id = auth.uid()
  );

create policy perfumes_update_self
  on public.perfumes for update to authenticated
  using (created_by_user_id = auth.uid())
  with check (created_by_user_id = auth.uid());

create policy perfumes_delete_self
  on public.perfumes for delete to authenticated
  using (created_by_user_id = auth.uid());
