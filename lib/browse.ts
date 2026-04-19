export interface BrowseManufacturerOption {
  id: number;
  name: string;
  slug: string;
}

export interface BrowseNoteFilter {
  slug: string;
  name?: string;
}

export interface BrowseNoteOption {
  id: number;
  name: string;
  slug: string;
}

export interface BrowseFilterState {
  q?: string | null;
  manufacturerSlug?: string | null;
  notes?: BrowseNoteFilter[];
}

export interface BrowseFilters extends BrowseFilterState {
  limit?: number;
}

export interface BrowsePerfumeCard {
  id: number;
  name: string;
  slug: string;
  canonical_description: string | null;
  manufacturer: BrowseManufacturerOption | null;
  perfume_notes:
    | {
        note: {
          id: number;
          name: string;
          slug: string;
        } | null;
      }[]
    | null;
}

export interface BrowseSearchResponse {
  total: number;
  results: BrowsePerfumeCard[];
}

export function parseBrowseNoteParam(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const legacyMatch = trimmed.match(/^(store|user):(.*)$/);
  if (legacyMatch) {
    const slug = legacyMatch[2]?.trim();
    if (!slug) return null;
    return { slug } satisfies BrowseNoteFilter;
  }

  return { slug: trimmed } satisfies BrowseNoteFilter;
}

export function parseBrowseNoteParams(values: string[] | undefined) {
  const seen = new Set<string>();
  const parsed: BrowseNoteFilter[] = [];

  for (const value of values ?? []) {
    const note = parseBrowseNoteParam(value);
    if (!note) continue;
    if (seen.has(note.slug)) continue;
    seen.add(note.slug);
    parsed.push(note);
  }

  return parsed;
}

export function normalizeBrowseQuery(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function getBrowseTokens(value: string | null | undefined) {
  const tokens = normalizeBrowseQuery(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  return Array.from(new Set(tokens));
}

export function buildBrowseSearchParams(filters: BrowseFilterState) {
  const params = new URLSearchParams();
  const q = normalizeBrowseQuery(filters.q);
  const manufacturerSlug = filters.manufacturerSlug?.trim();

  if (q) params.set("q", q);
  if (manufacturerSlug) params.set("manufacturer", manufacturerSlug);

  const seen = new Set<string>();
  for (const note of filters.notes ?? []) {
    if (seen.has(note.slug)) continue;
    seen.add(note.slug);
    params.append("note", note.slug);
  }

  return params;
}
