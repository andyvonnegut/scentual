import { createClient } from "@/lib/supabase/server";

export async function getRecentPerfumes(limit = 12) {
  const db = await createClient();
  const { data } = await db
    .from("perfumes")
    .select(
      "id, name, slug, created_at, manufacturer:manufacturers(id, name, slug)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function getRecentlyUpdatedPerfumes(limit = 12) {
  const db = await createClient();
  const { data } = await db
    .from("perfumes")
    .select(
      "id, name, slug, updated_at, manufacturer:manufacturers(id, name, slug)",
    )
    .order("updated_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export interface BrowseFilters {
  q?: string;
  manufacturerSlug?: string;
  noteSlug?: string;
  limit?: number;
}

export async function searchPerfumes(filters: BrowseFilters) {
  const db = await createClient();
  let query = db
    .from("perfumes")
    .select(
      `
      id, name, slug, canonical_description,
      manufacturer:manufacturers!inner(id, name, slug),
      perfume_notes${filters.noteSlug ? "!inner" : ""}(
        note:notes${filters.noteSlug ? "!inner" : ""}(id, name, slug)
      )
      `,
    )
    .order("name", { ascending: true })
    .limit(filters.limit ?? 60);

  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  if (filters.manufacturerSlug) {
    query = query.eq("manufacturer.slug", filters.manufacturerSlug);
  }
  if (filters.noteSlug) {
    query = query.eq("perfume_notes.note.slug", filters.noteSlug);
  }

  const { data } = await query;
  return data ?? [];
}

export async function searchCatalog(q: string, limit = 25) {
  const trimmed = q.trim();
  if (!trimmed) return [];
  const db = await createClient();
  const pattern = `%${trimmed}%`;

  const selectShape =
    "id, name, slug, manufacturer:manufacturers!inner(id, name, slug)";

  const [byName, byHouse] = await Promise.all([
    db
      .from("perfumes")
      .select(selectShape)
      .ilike("name", pattern)
      .order("name", { ascending: true })
      .limit(limit),
    db
      .from("perfumes")
      .select(selectShape)
      .ilike("manufacturer.name", pattern)
      .order("name", { ascending: true })
      .limit(limit),
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

export async function getAllManufacturers() {
  const db = await createClient();
  const { data } = await db
    .from("manufacturers")
    .select("id, name, slug")
    .order("name", { ascending: true });
  return data ?? [];
}

export async function getAllNotes() {
  const db = await createClient();
  const { data } = await db
    .from("notes")
    .select("id, name, slug")
    .order("name", { ascending: true });
  return data ?? [];
}

export async function getPerfumeByManufacturerAndSlug(
  manufacturerSlug: string,
  perfumeSlug: string,
) {
  const db = await createClient();

  const { data: manufacturer } = await db
    .from("manufacturers")
    .select("id, name, slug")
    .eq("slug", manufacturerSlug)
    .maybeSingle();
  if (!manufacturer) return null;

  const { data: perfume } = await db
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
      ),
      journal_entries(id, title, body, entry_date, created_at),
      personal_perfumes(
        id, in_collection, in_wanted,
        size_owned_text, personal_note,
        added_to_collection_at, added_to_wanted_at
      )
      `,
    )
    .eq("manufacturer_id", manufacturer.id)
    .eq("slug", perfumeSlug)
    .maybeSingle();

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

export async function getManufacturerBySlug(slug: string) {
  const db = await createClient();
  const { data } = await db
    .from("manufacturers")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function getPerfumesByManufacturer(manufacturerId: number) {
  const db = await createClient();
  const { data } = await db
    .from("perfumes")
    .select("id, name, slug, created_at")
    .eq("manufacturer_id", manufacturerId)
    .order("name", { ascending: true });
  return data ?? [];
}
