alter table public.generic_tags rename to theme_tags;
alter trigger touch_generic_tags_updated_at on public.theme_tags
  rename to touch_theme_tags_updated_at;

alter table public.personal_perfume_generic_tags
  rename to personal_perfume_theme_tags;
alter table public.personal_perfume_theme_tags
  rename column generic_tag_id to theme_tag_id;

alter index personal_perfume_generic_tags_tag_idx
  rename to personal_perfume_theme_tags_tag_idx;

-- RLS policies keep the old name; drop + recreate to match.
drop policy if exists generic_tags_read on public.theme_tags;
drop policy if exists personal_perfume_generic_tags_read
  on public.personal_perfume_theme_tags;

create policy theme_tags_read on public.theme_tags
  for select to anon, authenticated using (true);
create policy personal_perfume_theme_tags_read
  on public.personal_perfume_theme_tags
  for select to anon, authenticated using (true);
