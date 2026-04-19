"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { slugify } from "@/lib/scrape/normalize";
import type { SupabaseClient } from "@supabase/supabase-js";

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

// Returns the personal_perfumes row id for this perfume, creating a bare row
// (neither in_collection nor in_wanted) if one doesn't exist. Lets us hang
// tags on a perfume the user hasn't explicitly saved.
async function ensurePersonalPerfumeId(
  db: SupabaseClient,
  perfumeId: number,
): Promise<number | null> {
  const { data: existing } = await db
    .from("personal_perfumes")
    .select("id")
    .eq("perfume_id", perfumeId)
    .maybeSingle();
  if (existing?.id) return existing.id as number;
  const { data: inserted } = await db
    .from("personal_perfumes")
    .insert({ perfume_id: perfumeId })
    .select("id")
    .single();
  return (inserted?.id as number) ?? null;
}

async function getPersonalPerfumeId(
  db: SupabaseClient,
  perfumeId: number,
): Promise<number | null> {
  const { data } = await db
    .from("personal_perfumes")
    .select("id")
    .eq("perfume_id", perfumeId)
    .maybeSingle();
  return (data?.id as number) ?? null;
}

// One-shot actions keyed by perfumeId. If the personal_perfumes row doesn't
// exist yet, a bare row is created so the tag has somewhere to hang.

export async function addFragranceNoteTagByName(
  perfumeId: number,
  name: string,
) {
  const tag = await createFragranceNoteTag(name);
  if (!tag) return;
  const db = createServiceClient();
  const personalId = await ensurePersonalPerfumeId(db, perfumeId);
  if (!personalId) return;
  await db
    .from("personal_perfume_user_fragrance_note_tags")
    .upsert(
      {
        personal_perfume_id: personalId,
        user_fragrance_note_tag_id: tag.id,
      },
      {
        onConflict: "personal_perfume_id,user_fragrance_note_tag_id",
        ignoreDuplicates: true,
      },
    );
  revalidatePath("/", "layout");
}

export async function addThemeTagByName(perfumeId: number, name: string) {
  const tag = await createThemeTag(name);
  if (!tag) return;
  const db = createServiceClient();
  const personalId = await ensurePersonalPerfumeId(db, perfumeId);
  if (!personalId) return;
  await db
    .from("personal_perfume_theme_tags")
    .upsert(
      {
        personal_perfume_id: personalId,
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
  perfumeId: number,
  tagId: number,
) {
  const db = createServiceClient();
  const personalId = await getPersonalPerfumeId(db, perfumeId);
  if (!personalId) return;
  await db
    .from("personal_perfume_user_fragrance_note_tags")
    .delete()
    .eq("personal_perfume_id", personalId)
    .eq("user_fragrance_note_tag_id", tagId);
  revalidatePath("/", "layout");
}

export async function detachThemeTag(perfumeId: number, tagId: number) {
  const db = createServiceClient();
  const personalId = await getPersonalPerfumeId(db, perfumeId);
  if (!personalId) return;
  await db
    .from("personal_perfume_theme_tags")
    .delete()
    .eq("personal_perfume_id", personalId)
    .eq("theme_tag_id", tagId);
  revalidatePath("/", "layout");
}
