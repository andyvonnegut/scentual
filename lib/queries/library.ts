import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

export type LibraryFilter = "all" | "owned" | "desired" | "sniffed";

export async function getSavedPerfumes(filter: LibraryFilter = "all") {
  const user = await getSessionUser();
  if (!user) return [];

  const db = await createClient();
  let query = db
    .from("personal_perfumes")
    .select(
      `
      id, in_owned, in_desired, in_sniffed, favorite,
      size_owned_text, personal_note,
      projection_rating, overall_rating, design_rating,
      added_to_owned_at, added_to_desired_at, added_to_sniffed_at, updated_at,
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
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (filter === "owned") query = query.eq("in_owned", true);
  else if (filter === "desired") query = query.eq("in_desired", true);
  else if (filter === "sniffed") query = query.eq("in_sniffed", true);

  const { data } = await query;
  return data ?? [];
}

export async function getPersonalPerfumeByPerfumeId(perfumeId: number) {
  const user = await getSessionUser();
  if (!user) return null;

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
    .eq("user_id", user.id)
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
