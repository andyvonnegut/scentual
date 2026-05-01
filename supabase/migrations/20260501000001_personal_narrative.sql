-- Per-user long-form narrative on a perfume. Lives alongside the existing
-- short personal_note. Stored as markdown source; rendering happens client-
-- side via the marked library, with marked's default html=false escaping
-- raw HTML so user-pasted <script> never reaches the DOM.

alter table public.personal_perfumes
  add column personal_narrative text null;
