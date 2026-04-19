insert into public.retailers (name, slug, base_url) values
  ('Ministry of Scent', 'ministryofscent', 'https://ministryofscent.com'),
  ('LuckyScent', 'luckyscent', 'https://www.luckyscent.com')
on conflict (slug) do nothing;

insert into public.notes (name, slug) values
  ('rose', 'rose'),
  ('iris', 'iris'),
  ('sandalwood', 'sandalwood'),
  ('incense', 'incense'),
  ('musk', 'musk'),
  ('vanilla', 'vanilla'),
  ('oud', 'oud'),
  ('jasmine', 'jasmine'),
  ('bergamot', 'bergamot'),
  ('patchouli', 'patchouli'),
  ('vetiver', 'vetiver'),
  ('amber', 'amber'),
  ('cedar', 'cedar'),
  ('leather', 'leather'),
  ('tobacco', 'tobacco'),
  ('neroli', 'neroli'),
  ('orange blossom', 'orange-blossom'),
  ('tuberose', 'tuberose'),
  ('ylang-ylang', 'ylang-ylang'),
  ('cardamom', 'cardamom'),
  ('saffron', 'saffron'),
  ('pink pepper', 'pink-pepper'),
  ('lavender', 'lavender'),
  ('mint', 'mint'),
  ('green tea', 'green-tea')
on conflict (slug) do nothing;
