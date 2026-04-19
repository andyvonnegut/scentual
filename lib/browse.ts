export interface BrowseManufacturerOption {
  id: number;
  name: string;
  slug: string;
}

export interface BrowseExactNoteFilter {
  type: "exact";
  slug: string;
  name?: string;
}

export interface BrowseTextNoteFilter {
  type: "text";
  query: string;
  name?: string;
}

export type BrowseNoteFilter = BrowseExactNoteFilter | BrowseTextNoteFilter;

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

export function isBrowseExactNoteFilter(
  value: BrowseNoteFilter,
): value is BrowseExactNoteFilter {
  return value.type === "exact";
}

export function normalizeBrowseNoteQuery(value: string | null | undefined) {
  return value?.trim() ?? "";
}

export function getBrowseNoteFilterKey(note: BrowseNoteFilter) {
  return isBrowseExactNoteFilter(note)
    ? `note:${note.slug}`
    : `note_q:${note.query.toLowerCase()}`;
}

export function parseBrowseExactNoteParam(value: string | null | undefined) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const legacyMatch = trimmed.match(/^(store|user):(.*)$/);
  if (legacyMatch) {
    const slug = legacyMatch[2]?.trim();
    if (!slug) return null;
    return { type: "exact", slug } satisfies BrowseExactNoteFilter;
  }

  return { type: "exact", slug: trimmed } satisfies BrowseExactNoteFilter;
}

export function parseBrowseTextNoteParam(value: string | null | undefined) {
  const query = normalizeBrowseNoteQuery(value);
  if (!query) return null;
  return { type: "text", query, name: query } satisfies BrowseTextNoteFilter;
}

export function parseBrowseNoteParams(
  exactValues: string[] | undefined,
  textValues: string[] | undefined = [],
) {
  const seen = new Set<string>();
  const parsed: BrowseNoteFilter[] = [];

  for (const value of exactValues ?? []) {
    const note = parseBrowseExactNoteParam(value);
    if (!note) continue;
    const key = getBrowseNoteFilterKey(note);
    if (seen.has(key)) continue;
    seen.add(key);
    parsed.push(note);
  }

  for (const value of textValues) {
    const note = parseBrowseTextNoteParam(value);
    if (!note) continue;
    const key = getBrowseNoteFilterKey(note);
    if (seen.has(key)) continue;
    seen.add(key);
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
    const key = getBrowseNoteFilterKey(note);
    if (seen.has(key)) continue;
    seen.add(key);
    if (isBrowseExactNoteFilter(note)) {
      params.append("note", note.slug);
    } else {
      params.append("note_q", note.query);
    }
  }

  return params;
}
