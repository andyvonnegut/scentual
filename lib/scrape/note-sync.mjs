import { buildNoteMirrorRows, dedupeNoteNames, diffListingNoteRows } from "./notes.mjs";

function slugifyNoteName(input) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function chunk(items, size = 500) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function selectAll(db, table, selectClause, configureQuery) {
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    let query = db
      .from(table)
      .select(selectClause)
      .range(from, from + pageSize - 1);
    if (configureQuery) {
      query = configureQuery(query);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }

  return rows;
}

async function insertBatches(db, table, rows) {
  for (const batch of chunk(rows)) {
    const { error } = await db.from(table).insert(batch);
    if (error) throw error;
  }
}

export async function ensureCanonicalNotes(db, noteNames) {
  const deduped = dedupeNoteNames(noteNames);
  if (deduped.length === 0) return new Map();

  const slugsByName = new Map();
  const upsertRows = [];
  const seenSlugs = new Set();

  for (const name of deduped) {
    const slug = slugifyNoteName(name);
    slugsByName.set(name, slug);
    if (seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    upsertRows.push({ name, slug });
  }

  const { error: upsertError } = await db
    .from("notes")
    .upsert(upsertRows, { onConflict: "slug" });
  if (upsertError) throw upsertError;

  const byName = new Map();
  for (const slugBatch of chunk(upsertRows.map((row) => row.slug), 250)) {
    const { data, error } = await db
      .from("notes")
      .select("id, name, slug")
      .in("slug", slugBatch);
    if (error) throw error;

    for (const row of data ?? []) {
      byName.set(row.slug, row.id);
    }
  }

  const noteIdsByName = new Map();
  for (const [name, slug] of slugsByName) {
    const id = byName.get(slug);
    if (id) noteIdsByName.set(name, id);
  }
  return noteIdsByName;
}

export async function syncListingNoteRows(db, { listingId, noteNames }) {
  const desired = dedupeNoteNames(noteNames);
  const noteIdsByName = await ensureCanonicalNotes(db, desired);

  const { data: existingRows, error: existingError } = await db
    .from("perfume_source_notes")
    .select("id, raw_note_text")
    .eq("perfume_listing_id", listingId);
  if (existingError) throw existingError;

  const { deleteIds } = diffListingNoteRows(existingRows ?? [], desired);
  if (deleteIds.length > 0) {
    const { error: deleteError } = await db
      .from("perfume_source_notes")
      .delete()
      .in("id", deleteIds);
    if (deleteError) throw deleteError;
  }

  if (desired.length === 0) return;

  const upsertRows = desired.map((name) => ({
    perfume_listing_id: listingId,
    raw_note_text: name,
    normalized_note_id: noteIdsByName.get(name) ?? null,
  }));

  const { error: upsertError } = await db
    .from("perfume_source_notes")
    .upsert(upsertRows, {
      onConflict: "perfume_listing_id,raw_note_text",
    });
  if (upsertError) throw upsertError;
}

export async function rebuildCanonicalNotes(db) {
  const inactiveListings = await selectAll(
    db,
    "perfume_listings",
    "id",
    (query) => query.eq("active", false),
  );
  const inactiveIds = (inactiveListings ?? []).map((row) => row.id);
  for (const batch of chunk(inactiveIds)) {
    const { error } = await db
      .from("perfume_source_notes")
      .delete()
      .in("perfume_listing_id", batch);
    if (error) throw error;
  }

  const listingNotes = await selectAll(
    db,
    "perfume_source_notes",
    `
    raw_note_text,
    perfume_listing:perfume_listings!inner(
      active,
      retailer_id,
      perfume_id
    )
    `,
    (query) => query.eq("perfume_listing.active", true),
  );

  const flattened = (listingNotes ?? []).flatMap((row) => {
    const listing = Array.isArray(row.perfume_listing)
      ? row.perfume_listing[0]
      : row.perfume_listing;
    if (!listing || !row.raw_note_text) return [];
    return [
      {
        noteName: row.raw_note_text,
        retailerId: listing.retailer_id,
        perfumeId: listing.perfume_id,
      },
    ];
  });

  const mirror = buildNoteMirrorRows(flattened);
  const noteIdsByName = await ensureCanonicalNotes(db, mirror.canonicalNoteNames);

  const sourceRows = mirror.sourceNotes.map((row) => ({
    retailer_id: row.retailer_id,
    raw_note_name: row.raw_note_name,
    normalized_note_id: noteIdsByName.get(row.raw_note_name) ?? null,
  }));

  const seenPerfumePairs = new Set();
  const perfumeRows = mirror.perfumeNotes
    .map((row) => ({
      perfume_id: row.perfume_id,
      note_id: noteIdsByName.get(row.noteName) ?? null,
    }))
    .filter((row) => row.note_id !== null)
    .filter((row) => {
      const key = `${row.perfume_id}:${row.note_id}`;
      if (seenPerfumePairs.has(key)) return false;
      seenPerfumePairs.add(key);
      return true;
    });

  const { error: deleteSourceError } = await db
    .from("source_notes")
    .delete()
    .gte("id", 0);
  if (deleteSourceError) throw deleteSourceError;

  const { error: deletePerfumeError } = await db
    .from("perfume_notes")
    .delete()
    .gte("id", 0);
  if (deletePerfumeError) throw deletePerfumeError;

  if (sourceRows.length > 0) {
    await insertBatches(db, "source_notes", sourceRows);
  }

  if (perfumeRows.length > 0) {
    await insertBatches(db, "perfume_notes", perfumeRows);
  }

  const allNotes = await selectAll(db, "notes", "id, name");
  const keep = new Set(mirror.canonicalNoteNames);
  const staleIds = (allNotes ?? [])
    .filter((row) => !keep.has(row.name))
    .map((row) => row.id);

  for (const batch of chunk(staleIds)) {
    const { error } = await db.from("notes").delete().in("id", batch);
    if (error) throw error;
  }

  return {
    canonicalNotes: mirror.canonicalNoteNames.length,
    sourceNotes: sourceRows.length,
    perfumeNotes: perfumeRows.length,
    prunedNotes: staleIds.length,
  };
}
