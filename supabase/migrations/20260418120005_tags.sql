create table public.user_fragrance_note_tags (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch_user_fragrance_note_tags_updated_at
before update on public.user_fragrance_note_tags
for each row execute function public.touch_updated_at();

create table public.generic_tags (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch_generic_tags_updated_at
before update on public.generic_tags
for each row execute function public.touch_updated_at();

create table public.personal_perfume_user_fragrance_note_tags (
  id bigint generated always as identity primary key,
  personal_perfume_id bigint not null references public.personal_perfumes(id) on delete cascade,
  user_fragrance_note_tag_id bigint not null references public.user_fragrance_note_tags(id) on delete cascade,
  unique (personal_perfume_id, user_fragrance_note_tag_id)
);

create index personal_perfume_user_fragrance_note_tags_tag_idx
  on public.personal_perfume_user_fragrance_note_tags (user_fragrance_note_tag_id);

create table public.personal_perfume_generic_tags (
  id bigint generated always as identity primary key,
  personal_perfume_id bigint not null references public.personal_perfumes(id) on delete cascade,
  generic_tag_id bigint not null references public.generic_tags(id) on delete cascade,
  unique (personal_perfume_id, generic_tag_id)
);

create index personal_perfume_generic_tags_tag_idx
  on public.personal_perfume_generic_tags (generic_tag_id);
