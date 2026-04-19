"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { slugify } from "@/lib/scrape/normalize";

// Create-or-return helpers. Both return the tag row so callers can chain an
// attach immediately. Slug collision → return existing (idempotent create).

export async function createFragranceNoteTag(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const db = createServiceClient();
  const slug = slugify(trimmed);
  const { data } = await db
    .from("user_fragrance_note_tags")
    .upsert({ name: trimmed, slug }, { onConflict: "slug" })
    .select("id, name, slug")
    .single();
  revalidatePath("/collection");
  return data;
}

export async function createThemeTag(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const db = createServiceClient();
  const slug = slugify(trimmed);
  const { data } = await db
    .from("theme_tags")
    .upsert({ name: trimmed, slug }, { onConflict: "slug" })
    .select("id, name, slug")
    .single();
  revalidatePath("/collection");
  return data;
}

// One-shot actions that take a tag name and a personal_perfume_id. If the tag
// doesn't exist yet, create it; then attach. Powers the type-ahead UX on the
// perfume detail page.

export async function addFragranceNoteTagByName(
  personalPerfumeId: number,
  name: string,
) {
  const tag = await createFragranceNoteTag(name);
  if (!tag) return;
  const db = createServiceClient();
  await db
    .from("personal_perfume_user_fragrance_note_tags")
    .upsert(
      {
        personal_perfume_id: personalPerfumeId,
        user_fragrance_note_tag_id: tag.id,
      },
      {
        onConflict: "personal_perfume_id,user_fragrance_note_tag_id",
        ignoreDuplicates: true,
      },
    );
  revalidatePath("/", "layout");
}

export async function addThemeTagByName(
  personalPerfumeId: number,
  name: string,
) {
  const tag = await createThemeTag(name);
  if (!tag) return;
  const db = createServiceClient();
  await db
    .from("personal_perfume_theme_tags")
    .upsert(
      {
        personal_perfume_id: personalPerfumeId,
        theme_tag_id: tag.id,
      },
      {
        onConflict: "personal_perfume_id,theme_tag_id",
        ignoreDuplicates: true,
      },
    );
  revalidatePath("/", "layout");
}

export async function detachFragranceNoteTag(
  personalPerfumeId: number,
  tagId: number,
) {
  const db = createServiceClient();
  await db
    .from("personal_perfume_user_fragrance_note_tags")
    .delete()
    .eq("personal_perfume_id", personalPerfumeId)
    .eq("user_fragrance_note_tag_id", tagId);
  revalidatePath("/", "layout");
}

export async function detachThemeTag(
  personalPerfumeId: number,
  tagId: number,
) {
  const db = createServiceClient();
  await db
    .from("personal_perfume_theme_tags")
    .delete()
    .eq("personal_perfume_id", personalPerfumeId)
    .eq("theme_tag_id", tagId);
  revalidatePath("/", "layout");
}
