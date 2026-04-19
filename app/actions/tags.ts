"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { slugify } from "@/lib/scrape/normalize";

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
  revalidatePath("/tags");
  revalidatePath("/library");
  return data;
}

export async function createGenericTag(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const db = createServiceClient();
  const slug = slugify(trimmed);
  const { data } = await db
    .from("generic_tags")
    .upsert({ name: trimmed, slug }, { onConflict: "slug" })
    .select("id, name, slug")
    .single();
  revalidatePath("/tags");
  revalidatePath("/library");
  return data;
}

export async function attachFragranceNoteTag(
  personalPerfumeId: number,
  tagId: number,
) {
  const db = createServiceClient();
  await db
    .from("personal_perfume_user_fragrance_note_tags")
    .upsert(
      {
        personal_perfume_id: personalPerfumeId,
        user_fragrance_note_tag_id: tagId,
      },
      {
        onConflict: "personal_perfume_id,user_fragrance_note_tag_id",
        ignoreDuplicates: true,
      },
    );
  revalidatePath("/library");
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
  revalidatePath("/library");
}

export async function attachGenericTag(
  personalPerfumeId: number,
  tagId: number,
) {
  const db = createServiceClient();
  await db
    .from("personal_perfume_generic_tags")
    .upsert(
      {
        personal_perfume_id: personalPerfumeId,
        generic_tag_id: tagId,
      },
      {
        onConflict: "personal_perfume_id,generic_tag_id",
        ignoreDuplicates: true,
      },
    );
  revalidatePath("/library");
}

export async function detachGenericTag(
  personalPerfumeId: number,
  tagId: number,
) {
  const db = createServiceClient();
  await db
    .from("personal_perfume_generic_tags")
    .delete()
    .eq("personal_perfume_id", personalPerfumeId)
    .eq("generic_tag_id", tagId);
  revalidatePath("/library");
}
