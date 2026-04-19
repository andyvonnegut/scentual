create table public.personal_perfume_notes (
  id bigint generated always as identity primary key,
  personal_perfume_id bigint not null references public.personal_perfumes(id) on delete cascade,
  note_id bigint not null references public.notes(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (personal_perfume_id, note_id)
);

create index personal_perfume_notes_note_idx
  on public.personal_perfume_notes (note_id);

insert into public.personal_perfume_notes (personal_perfume_id, note_id)
select distinct legacy.personal_perfume_id, notes.id
from public.personal_perfume_user_fragrance_note_tags legacy
join public.user_fragrance_note_tags legacy_tags
  on legacy_tags.id = legacy.user_fragrance_note_tag_id
join public.notes
  on notes.slug = legacy_tags.slug
on conflict (personal_perfume_id, note_id) do nothing;

alter table public.personal_perfume_notes enable row level security;

create policy personal_perfume_notes_read
on public.personal_perfume_notes
for select
to anon, authenticated
using (true);

drop table public.personal_perfume_user_fragrance_note_tags;
drop table public.user_fragrance_note_tags;
