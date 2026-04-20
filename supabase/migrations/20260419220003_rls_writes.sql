-- Per-user write policies for the four user-scoped tables. Reads already
-- have anon+authenticated select policies from 20260418120008_rls.sql; we
-- keep those (public catalog browsing still shows counts etc.), but writes
-- from the browser must match auth.uid().
--
-- Service-role clients (scrapers, cron) bypass RLS entirely, so this does
-- not affect the ingestion pipeline.

create policy personal_perfumes_insert_self
  on public.personal_perfumes for insert to authenticated
  with check (user_id = auth.uid());

create policy personal_perfumes_update_self
  on public.personal_perfumes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy personal_perfumes_delete_self
  on public.personal_perfumes for delete to authenticated
  using (user_id = auth.uid());

create policy personal_perfume_notes_insert_self
  on public.personal_perfume_notes for insert to authenticated
  with check (user_id = auth.uid());

create policy personal_perfume_notes_update_self
  on public.personal_perfume_notes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy personal_perfume_notes_delete_self
  on public.personal_perfume_notes for delete to authenticated
  using (user_id = auth.uid());

create policy personal_perfume_theme_tags_insert_self
  on public.personal_perfume_theme_tags for insert to authenticated
  with check (user_id = auth.uid());

create policy personal_perfume_theme_tags_update_self
  on public.personal_perfume_theme_tags for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy personal_perfume_theme_tags_delete_self
  on public.personal_perfume_theme_tags for delete to authenticated
  using (user_id = auth.uid());

create policy journal_entries_insert_self
  on public.journal_entries for insert to authenticated
  with check (user_id = auth.uid());

create policy journal_entries_update_self
  on public.journal_entries for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy journal_entries_delete_self
  on public.journal_entries for delete to authenticated
  using (user_id = auth.uid());
