import { createClient } from "@/lib/supabase/server";

export type LibraryFilter = "all" | "collection" | "wanted" | "both";

export async function getSavedPerfumes(filter: LibraryFilter = "all") {
  const db = await createClient();
  let query = db
    .from("personal_perfumes")
    .select(
      `
      id, in_collection, in_wanted, favorite,
      size_owned_text, personal_note,
      projection_rating, overall_rating, design_rating,
      added_to_collection_at, added_to_wanted_at, updated_at,
      perfume:perfumes!inner(
        id, name, slug,
        manufacturer:manufacturers(id, name, slug),
        perfume_notes(note:notes(id, name, slug))
      ),
      personal_perfume_notes(
        note:notes(id, name, slug)
      ),
      personal_perfume_theme_tags(
        theme_tag:theme_tags(id, name, slug)
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
    .select(
      `
      *,
      personal_perfume_notes(
        note:notes(id, name, slug)
      ),
      personal_perfume_theme_tags(
        theme_tag:theme_tags(id, name, slug)
      )
      `,
    )
    .eq("perfume_id", perfumeId)
    .maybeSingle();
  return data;
}

export async function getAllThemeTags() {
  const db = await createClient();
  const { data } = await db
    .from("theme_tags")
    .select("id, name, slug")
    .order("name", { ascending: true });
  return data ?? [];
}
