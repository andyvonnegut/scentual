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

async function insertBatches(db, table, rows) {
  for (const batch of chunk(rows)) {
    const { error } = await db.from(table).insert(batch);
    if (error) throw error;
  }
}

export async function ensureCanonicalNotes(db, noteNames) {
  const deduped = dedupeNoteNames(noteNames);
  if (deduped.length === 0) return new Map();

  const upsertRows = deduped.map((name) => ({
    name,
    slug: slugifyNoteName(name),
  }));

  const { error: upsertError } = await db
    .from("notes")
    .upsert(upsertRows, { onConflict: "slug" });
  if (upsertError) throw upsertError;

  const slugs = upsertRows.map((row) => row.slug);
  const { data, error } = await db
    .from("notes")
    .select("id, name, slug")
    .in("slug", slugs);
  if (error) throw error;

  const byName = new Map();
  for (const row of data ?? []) {
    byName.set(row.name, row.id);
  }
  return byName;
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
  const { data: inactiveListings, error: inactiveError } = await db
    .from("perfume_listings")
    .select("id")
    .eq("active", false);
  if (inactiveError) throw inactiveError;

  const inactiveIds = (inactiveListings ?? []).map((row) => row.id);
  for (const batch of chunk(inactiveIds)) {
    const { error } = await db
      .from("perfume_source_notes")
      .delete()
      .in("perfume_listing_id", batch);
    if (error) throw error;
  }

  const { data: listingNotes, error: listingNotesError } = await db
    .from("perfume_source_notes")
    .select(
      `
      raw_note_text,
      perfume_listing:perfume_listings!inner(
        active,
        retailer_id,
        perfume_id
      )
      `,
    )
    .eq("perfume_listing.active", true);
  if (listingNotesError) throw listingNotesError;

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

  const perfumeRows = mirror.perfumeNotes.map((row) => ({
    perfume_id: row.perfume_id,
    note_id: noteIdsByName.get(row.noteName) ?? null,
  })).filter((row) => row.note_id !== null);

  const { error: deleteSourceError } = await db.from("source_notes").delete();
  if (deleteSourceError) throw deleteSourceError;

  const { error: deletePerfumeError } = await db.from("perfume_notes").delete();
  if (deletePerfumeError) throw deletePerfumeError;

  if (sourceRows.length > 0) {
    await insertBatches(db, "source_notes", sourceRows);
  }

  if (perfumeRows.length > 0) {
    await insertBatches(db, "perfume_notes", perfumeRows);
  }

  const { data: allNotes, error: allNotesError } = await db
    .from("notes")
    .select("id, name");
  if (allNotesError) throw allNotesError;

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
