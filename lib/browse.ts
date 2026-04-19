export type BrowseNoteSource = "store" | "user";

export interface BrowseManufacturerOption {
  id: number;
  name: string;
  slug: string;
}

export interface BrowseNoteFilter {
  source: BrowseNoteSource;
  slug: string;
  name?: string;
}

export interface BrowseNoteOption {
  id: number;
  name: string;
  slug: string;
  source: BrowseNoteSource;
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

  const [source, ...slugParts] = value.split(":");
  const slug = slugParts.join(":").trim();

  if ((source === "store" || source === "user") && slug) {
    return { source, slug } satisfies BrowseNoteFilter;
  }

  return null;
}

export function encodeBrowseNoteParam(
  note: Pick<BrowseNoteFilter, "source" | "slug">,
) {
  return `${note.source}:${note.slug}`;
}

export function parseBrowseNoteParams(values: string[] | undefined) {
  const seen = new Set<string>();
  const parsed: BrowseNoteFilter[] = [];

  for (const value of values ?? []) {
    const note = parseBrowseNoteParam(value);
    if (!note) continue;
    const key = encodeBrowseNoteParam(note);
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
    const encoded = encodeBrowseNoteParam(note);
    if (seen.has(encoded)) continue;
    seen.add(encoded);
    params.append("note", encoded);
  }

  return params;
}
