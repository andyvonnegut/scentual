-- Repair historical note rows where a trailing ", and note" was parsed into a
-- leading "and note" value. Only merge rows that collapse into an existing
-- canonical note name; broader malformed note cleanup is intentionally out of
-- scope here.

with convertible_rows as (
  select
    psn.id,
    psn.perfume_listing_id,
    regexp_replace(psn.raw_note_text, '^and\s+', '', 'i') as stripped_note,
    n.id as target_note_id
  from public.perfume_source_notes psn
  join public.notes n
    on n.name = regexp_replace(psn.raw_note_text, '^and\s+', '', 'i')
  where psn.raw_note_text ~* '^and\s+'
),
conflicting_rows as (
  select convertible.id
  from convertible_rows convertible
  join public.perfume_source_notes existing
    on existing.perfume_listing_id = convertible.perfume_listing_id
   and existing.raw_note_text = convertible.stripped_note
),
deleted_conflicts as (
  delete from public.perfume_source_notes
  where id in (select id from conflicting_rows)
  returning id
)
update public.perfume_source_notes psn
set
  raw_note_text = convertible.stripped_note,
  normalized_note_id = convertible.target_note_id
from convertible_rows convertible
where psn.id = convertible.id
  and not exists (
    select 1
    from deleted_conflicts deleted
    where deleted.id = psn.id
  );

update public.perfume_source_notes psn
set normalized_note_id = n.id
from public.notes n
where psn.raw_note_text = n.name;

update public.perfume_source_notes psn
set normalized_note_id = null
where not exists (
  select 1
  from public.notes n
  where n.name = psn.raw_note_text
);

delete from public.source_notes;

insert into public.source_notes (retailer_id, raw_note_name, normalized_note_id)
select distinct
  pl.retailer_id,
  psn.raw_note_text,
  n.id as normalized_note_id
from public.perfume_source_notes psn
join public.perfume_listings pl
  on pl.id = psn.perfume_listing_id
 and pl.active = true
left join public.notes n
  on n.name = psn.raw_note_text;

delete from public.perfume_notes;

insert into public.perfume_notes (perfume_id, note_id)
select distinct
  pl.perfume_id,
  n.id as note_id
from public.perfume_source_notes psn
join public.perfume_listings pl
  on pl.id = psn.perfume_listing_id
 and pl.active = true
join public.notes n
  on n.name = psn.raw_note_text;

delete from public.notes n
where not exists (
  select 1
  from public.perfume_source_notes psn
  join public.perfume_listings pl
    on pl.id = psn.perfume_listing_id
   and pl.active = true
  where psn.raw_note_text = n.name
);
