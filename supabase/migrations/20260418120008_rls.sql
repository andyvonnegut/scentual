-- Enable RLS on every table. Public anon gets SELECT. No write policies =
-- writes are denied from the browser; server actions use the service role
-- key (which bypasses RLS) via lib/supabase/service.ts.

do $$
declare
  t text;
  public_tables text[] := array[
    'manufacturers', 'perfumes', 'retailers',
    'perfume_listings', 'listing_variants',
    'listing_price_history', 'listing_stock_history',
    'notes', 'source_notes', 'perfume_notes', 'perfume_source_notes',
    'personal_perfumes',
    'user_fragrance_note_tags', 'generic_tags',
    'personal_perfume_user_fragrance_note_tags',
    'personal_perfume_generic_tags',
    'journal_entries',
    'scrape_runs'
  ];
begin
  foreach t in array public_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to anon, authenticated using (true)',
      t || '_read',
      t
    );
  end loop;
end $$;
