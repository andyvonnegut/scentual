import { createClient } from "@/lib/supabase/server";

export type LibraryFilter = "all" | "collection" | "wanted" | "both";

export async function getSavedPerfumes(filter: LibraryFilter = "all") {
  const db = await createClient();
  let query = db
    .from("personal_perfumes")
    .select(
      `
      id, in_collection, in_wanted,
      size_owned_text, personal_note,
      added_to_collection_at, added_to_wanted_at, updated_at,
      perfume:perfumes!inner(
        id, name, slug,
        manufacturer:manufacturers(id, name, slug),
        perfume_notes(note:notes(id, name, slug))
      ),
      personal_perfume_user_fragrance_note_tags(
        user_fragrance_note_tag:user_fragrance_note_tags(id, name, slug)
      ),
      personal_perfume_generic_tags(
        generic_tag:generic_tags(id, name, slug)
      )
      `,
    )
    .order("updated_at", { ascending: false });

  if (filter === "collection") query = query.eq("in_collection", true);
  else if (filter === "wanted") query = query.eq("in_wanted", true);
  else if (filter === "both")
    query = query.eq("in_collection", true).eq("in_wanted", true);

  const { data } = await query;
  return data ?? [];
}

export async function getPersonalPerfumeByPerfumeId(perfumeId: number) {
  const db = await createClient();
  const { data } = await db
    .from("personal_perfumes")
    .select("*")
    .eq("perfume_id", perfumeId)
    .maybeSingle();
  return data;
}

export async function getAllFragranceNoteTags() {
  const db = await createClient();
  const { data } = await db
    .from("user_fragrance_note_tags")
    .select("id, name, slug")
    .order("name", { ascending: true });
  return data ?? [];
}

export async function getAllGenericTags() {
  const db = await createClient();
  const { data } = await db
    .from("generic_tags")
    .select("id, name, slug")
    .order("name", { ascending: true });
  return data ?? [];
}

export async function searchCatalogForLibrary(q: string, limit = 20) {
  if (!q.trim()) return [];
  const db = await createClient();
  const { data } = await db
    .from("perfumes")
    .select(
      "id, name, slug, manufacturer:manufacturers!inner(id, name, slug)",
    )
    .ilike("name", `%${q}%`)
    .order("name", { ascending: true })
    .limit(limit);
  return data ?? [];
}
