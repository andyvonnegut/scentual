-- Seed the user fragrance-note tag library from every canonical note the
-- scrapers have surfaced. Future scrapes add new notes; rerun this statement
-- or trigger it in scrape_runs post-processing if that matters later.
insert into public.user_fragrance_note_tags (name, slug)
select name, slug from public.notes
on conflict (slug) do nothing;
