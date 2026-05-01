import { createClient } from "@/lib/supabase/server";
import {
  getBrowseTokens,
  isBrowseExactNoteFilter,
  type BrowseFilters,
  type BrowsePerfumeCard,
  type BrowseSearchResponse,
} from "@/lib/browse";

const BROWSE_SELECT = `
  id, name, slug, canonical_description,
  manufacturer:manufacturers!inner(id, name, slug),
  perfume_notes(
    note:notes(id, name, slug)
  )
`;

// Privacy filter for user-submitted catalog rows. A perfume or manufacturer is
// visible to: (a) anyone if it isn't user-submitted, or (b) only its creator
// if it is. We enforce this at the query layer rather than RLS because the
// scraper uses the service-role client (which bypasses RLS) and we don't want
// to special-case its reads.
function visibilityClause(userId: string | null) {
  return userId
    ? `is_user_submitted.eq.false,created_by_user_id.eq.${userId}`
    : null;
}

function applyVisibility<T>(query: T, userId: string | null): T {
  const clause = visibilityClause(userId);
  const q = query as unknown as {
    or: (s: string) => unknown;
    eq: (column: string, value: unknown) => unknown;
  };
  return (clause ? q.or(clause) : q.eq("is_user_submitted", false)) as T;
}

export async function getRecentPerfumes(limit = 12, userId: string | null = null) {
  const db = await createClient();
  const query = db
    .from("perfumes")
    .select(
      "id, name, slug, created_at, manufacturer:manufacturers(id, name, slug)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  const { data } = await applyVisibility(query, userId);
  return data ?? [];
}

export async function getRecentlyUpdatedPerfumes(
  limit = 12,
  userId: string | null = null,
) {
  const db = await createClient();
  const query = db
    .from("perfumes")
    .select(
      "id, name, slug, updated_at, manufacturer:manufacturers(id, name, slug)",
    )
    .order("updated_at", { ascending: false })
    .limit(limit);
  const { data } = await applyVisibility(query, userId);
  return data ?? [];
}

type PerfumeIdRow = { id: number };
type PerfumeNoteRow = { perfume_id: number };
type PersonalPerfumeJoin =
  | { perfume_id: number | null }
  | { perfume_id: number | null }[]
  | null;
type PersonalNoteRow = { personal_perfume: PersonalPerfumeJoin };

function extractPerfumeId(join: PersonalPerfumeJoin) {
  if (Array.isArray(join)) return join[0]?.perfume_id ?? null;
  return join?.perfume_id ?? null;
}

function intersectIdSets(sets: Set<number>[]) {
  if (sets.length === 0) return new Set<number>();

  const [first, ...rest] = [...sets].sort((a, b) => a.size - b.size);
  const result = new Set(first);

  for (const set of rest) {
    for (const id of result) {
      if (!set.has(id)) result.delete(id);
    }
  }

  return result;
}

function rowsToIdSet(rows: PerfumeIdRow[] | PerfumeNoteRow[] | null | undefined) {
  return new Set((rows ?? []).map((row) => ("id" in row ? row.id : row.perfume_id)));
}

function personalRowsToIdSet(rows: PersonalNoteRow[] | null | undefined) {
  const ids = new Set<number>();

  for (const row of rows ?? []) {
    const perfumeId = extractPerfumeId(row.personal_perfume);
    if (perfumeId) ids.add(perfumeId);
  }

  return ids;
}

async function getPerfumeIdsForManufacturerSlug(
  manufacturerSlug: string,
  userId: string | null,
) {
  const db = await createClient();
  const query = db
    .from("perfumes")
    .select("id, manufacturer:manufacturers!inner(slug)")
    .eq("manufacturer.slug", manufacturerSlug);

  const { data } = await applyVisibility(query, userId);
  return rowsToIdSet(data as PerfumeIdRow[] | null | undefined);
}

async function getPerfumeIdsForStoreNoteSlug(slug: string) {
  const db = await createClient();
  const { data } = await db
    .from("perfume_notes")
    .select("perfume_id, note:notes!inner(slug)")
    .eq("note.slug", slug);

  return rowsToIdSet(data as PerfumeNoteRow[] | null | undefined);
}

async function getPerfumeIdsForPersonalNoteSlug(userId: string, slug: string) {
  const db = await createClient();
  const { data } = await db
    .from("personal_perfume_notes")
    .select(
      `
      personal_perfume:personal_perfumes!inner(perfume_id),
      note:notes!inner(slug)
      `,
    )
    .eq("user_id", userId)
    .eq("note.slug", slug);

  return personalRowsToIdSet(data as PersonalNoteRow[] | null | undefined);
}

async function getPerfumeIdsForNoteSlug(slug: string, userId: string | null) {
  if (!userId) {
    return await getPerfumeIdsForStoreNoteSlug(slug);
  }
  const [storeIds, personalIds] = await Promise.all([
    getPerfumeIdsForStoreNoteSlug(slug),
    getPerfumeIdsForPersonalNoteSlug(userId, slug),
  ]);

  return new Set([...storeIds, ...personalIds]);
}

async function getPerfumeIdsForStoreNoteQuery(query: string) {
  const db = await createClient();
  const pattern = `%${query}%`;
  const { data } = await db
    .from("perfume_notes")
    .select("perfume_id, note:notes!inner(name)")
    .ilike("note.name", pattern);

  return rowsToIdSet(data as PerfumeNoteRow[] | null | undefined);
}

async function getPerfumeIdsForPersonalNoteQuery(userId: string, query: string) {
  const db = await createClient();
  const pattern = `%${query}%`;
  const { data } = await db
    .from("personal_perfume_notes")
    .select(
      `
      personal_perfume:personal_perfumes!inner(perfume_id),
      note:notes!inner(name)
      `,
    )
    .eq("user_id", userId)
    .ilike("note.name", pattern);

  return personalRowsToIdSet(data as PersonalNoteRow[] | null | undefined);
}

async function getPerfumeIdsForNoteQuery(query: string, userId: string | null) {
  if (!userId) {
    return await getPerfumeIdsForStoreNoteQuery(query);
  }
  const [storeIds, personalIds] = await Promise.all([
    getPerfumeIdsForStoreNoteQuery(query),
    getPerfumeIdsForPersonalNoteQuery(userId, query),
  ]);

  return new Set([...storeIds, ...personalIds]);
}

async function getPerfumeIdsForToken(token: string, userId: string | null) {
  const db = await createClient();
  const pattern = `%${token}%`;
  const personalBranch = userId
    ? db
        .from("personal_perfume_notes")
        .select(
          `
          personal_perfume:personal_perfumes!inner(perfume_id),
          note:notes!inner(name)
          `,
        )
        .eq("user_id", userId)
        .ilike("note.name", pattern)
    : null;

  const byNameQuery = applyVisibility(
    db.from("perfumes").select("id").ilike("name", pattern),
    userId,
  );
  const byHouseQuery = applyVisibility(
    db
      .from("perfumes")
      .select("id, manufacturer:manufacturers!inner(name)")
      .ilike("manufacturer.name", pattern),
    userId,
  );

  const [byName, byHouse, byStoreNote, byPersonalNote] = await Promise.all([
    byNameQuery,
    byHouseQuery,
    db
      .from("perfume_notes")
      .select("perfume_id, note:notes!inner(name)")
      .ilike("note.name", pattern),
    personalBranch ?? Promise.resolve({ data: null }),
  ]);

  const ids = new Set<number>();

  for (const id of rowsToIdSet(byName.data as PerfumeIdRow[] | null | undefined)) {
    ids.add(id);
  }
  for (const id of rowsToIdSet(byHouse.data as PerfumeIdRow[] | null | undefined)) {
    ids.add(id);
  }
  for (const id of rowsToIdSet(
    byStoreNote.data as PerfumeNoteRow[] | null | undefined,
  )) {
    ids.add(id);
  }
  for (const id of personalRowsToIdSet(
    byPersonalNote.data as PersonalNoteRow[] | null | undefined,
  )) {
    ids.add(id);
  }

  return ids;
}

async function fetchBrowseRowsByIds(
  ids: number[],
  limit: number,
  userId: string | null,
) {
  const db = await createClient();
  const query = db
    .from("perfumes")
    .select(BROWSE_SELECT)
    .in("id", ids)
    .order("name", { ascending: true })
    .limit(limit);

  const { data } = await applyVisibility(query, userId);
  return (data ?? []) as BrowsePerfumeCard[];
}

export async function browsePerfumes(
  filters: BrowseFilters,
  userId: string | null = null,
): Promise<BrowseSearchResponse> {
  const limit = filters.limit ?? 60;
  const tokens = getBrowseTokens(filters.q);
  const manufacturerSlug = filters.manufacturerSlug?.trim();
  const notes = filters.notes ?? [];
  const hasFilters =
    tokens.length > 0 || Boolean(manufacturerSlug) || notes.length > 0;

  if (!hasFilters) {
    const db = await createClient();
    const query = db
      .from("perfumes")
      .select(BROWSE_SELECT, { count: "exact" })
      .order("name", { ascending: true })
      .limit(limit);
    const { data, count } = await applyVisibility(query, userId);

    return {
      total: count ?? 0,
      results: (data ?? []) as BrowsePerfumeCard[],
    };
  }

  if (manufacturerSlug && tokens.length === 0 && notes.length === 0) {
    const db = await createClient();
    const query = db
      .from("perfumes")
      .select(BROWSE_SELECT, { count: "exact" })
      .eq("manufacturer.slug", manufacturerSlug)
      .order("name", { ascending: true })
      .limit(limit);
    const { data, count } = await applyVisibility(query, userId);

    return {
      total: count ?? 0,
      results: (data ?? []) as BrowsePerfumeCard[],
    };
  }

  const constraintPromises: Promise<Set<number>>[] = [];

  if (manufacturerSlug) {
    constraintPromises.push(
      getPerfumeIdsForManufacturerSlug(manufacturerSlug, userId),
    );
  }

  for (const note of notes) {
    constraintPromises.push(
      isBrowseExactNoteFilter(note)
        ? getPerfumeIdsForNoteSlug(note.slug, userId)
        : getPerfumeIdsForNoteQuery(note.query, userId),
    );
  }

  for (const token of tokens) {
    constraintPromises.push(getPerfumeIdsForToken(token, userId));
  }

  const idSets = await Promise.all(constraintPromises);
  if (idSets.some((set) => set.size === 0)) {
    return { total: 0, results: [] };
  }

  const matchingIds = [...intersectIdSets(idSets)];
  if (matchingIds.length === 0) {
    return { total: 0, results: [] };
  }

  const results = await fetchBrowseRowsByIds(matchingIds, limit, userId);
  return {
    total: matchingIds.length,
    results,
  };
}

export async function searchCatalog(
  q: string,
  userId: string | null = null,
  options: { limit?: number; manufacturerId?: number | null } = {},
) {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const limit = options.limit ?? 25;
  const db = await createClient();
  const pattern = `%${trimmed}%`;

  const selectShape =
    "id, name, slug, manufacturer:manufacturers!inner(id, name, slug)";

  const baseByName = db
    .from("perfumes")
    .select(selectShape)
    .ilike("name", pattern)
    .order("name", { ascending: true })
    .limit(limit);
  const baseByHouse = db
    .from("perfumes")
    .select(selectShape)
    .ilike("manufacturer.name", pattern)
    .order("name", { ascending: true })
    .limit(limit);

  const scopedByName = options.manufacturerId
    ? baseByName.eq("manufacturer_id", options.manufacturerId)
    : baseByName;
  const scopedByHouse = options.manufacturerId
    ? baseByHouse.eq("manufacturer_id", options.manufacturerId)
    : baseByHouse;

  const [byName, byHouse] = await Promise.all([
    applyVisibility(scopedByName, userId),
    applyVisibility(scopedByHouse, userId),
  ]);

  const seen = new Set<number>();
  const merged: NonNullable<typeof byName.data> = [];
  for (const row of [...(byName.data ?? []), ...(byHouse.data ?? [])]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}

export async function searchManufacturers(
  q: string,
  userId: string | null = null,
  limit = 8,
) {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const db = await createClient();
  const pattern = `%${trimmed}%`;

  const query = db
    .from("manufacturers")
    .select("id, name, slug")
    .ilike("name", pattern)
    .order("name", { ascending: true })
    .limit(limit);
  const { data } = await applyVisibility(query, userId);
  return data ?? [];
}

export async function getAllManufacturers(userId: string | null = null) {
  const db = await createClient();
  const query = db
    .from("manufacturers")
    .select("id, name, slug")
    .order("name", { ascending: true });
  const { data } = await applyVisibility(query, userId);
  return data ?? [];
}

export async function getAllNotes() {
  const db = await createClient();
  const pageSize = 1000;
  const notes: { id: number; name: string; slug: string }[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("notes")
      .select("id, name, slug")
      .order("name", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    notes.push(...data);
    if (data.length < pageSize) break;
  }

  return notes;
}

export async function getPerfumeByManufacturerAndSlug(
  manufacturerSlug: string,
  perfumeSlug: string,
  userId: string | null = null,
) {
  const db = await createClient();

  const manufacturerQuery = db
    .from("manufacturers")
    .select("id, name, slug")
    .eq("slug", manufacturerSlug);
  const { data: manufacturer } = await applyVisibility(
    manufacturerQuery,
    userId,
  ).maybeSingle();
  if (!manufacturer) return null;

  // Personal data (personal_perfumes, journal_entries) is loaded separately
  // via user-scoped queries so it cannot leak across users.
  const perfumeQuery = db
    .from("perfumes")
    .select(
      `
      id, name, slug, canonical_description, created_at, updated_at,
      manufacturer:manufacturers(id, name, slug),
      perfume_notes(note:notes(id, name, slug)),
      perfume_listings(
        id, source_url, source_title, source_description, active,
        last_seen_at, last_scraped_at,
        retailer:retailers(id, name, slug, base_url),
        listing_variants(
          id, size_label, size_value_ml,
          current_price, currency,
          current_stock_status, current_stock_raw,
          last_seen_at
        )
      )
      `,
    )
    .eq("manufacturer_id", manufacturer.id)
    .eq("slug", perfumeSlug);
  const { data: perfume } = await applyVisibility(
    perfumeQuery,
    userId,
  ).maybeSingle();

  return perfume;
}

export async function getPriceHistory(listingVariantId: number) {
  const db = await createClient();
  const { data } = await db
    .from("listing_price_history")
    .select("id, price, currency, observed_at, change_type")
    .eq("listing_variant_id", listingVariantId)
    .order("observed_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function getStockHistory(listingVariantId: number) {
  const db = await createClient();
  const { data } = await db
    .from("listing_stock_history")
    .select("id, stock_status, stock_raw, observed_at, change_type")
    .eq("listing_variant_id", listingVariantId)
    .order("observed_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function getManufacturerBySlug(
  slug: string,
  userId: string | null = null,
) {
  const db = await createClient();
  const query = db
    .from("manufacturers")
    .select("id, name, slug")
    .eq("slug", slug);
  const { data } = await applyVisibility(query, userId).maybeSingle();
  return data;
}

export async function getPerfumesByManufacturer(
  manufacturerId: number,
  userId: string | null = null,
) {
  const db = await createClient();
  const query = db
    .from("perfumes")
    .select("id, name, slug, created_at")
    .eq("manufacturer_id", manufacturerId)
    .order("name", { ascending: true });
  const { data } = await applyVisibility(query, userId);
  return data ?? [];
}
