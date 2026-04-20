"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/scrape/normalize";
import type { SupabaseClient } from "@supabase/supabase-js";

type TagRef = {
  id: number;
  name: string;
  slug?: string;
};

// notes + theme_tags are shared catalog tables (cross-user). Adding a new
// name inserts into a canonical table that all users see; we use the service
// client for those writes since anyone can propose a new label.

export async function upsertCanonicalNote(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  await requireUser();
  const db = createServiceClient();
  const slug = slugify(trimmed);
  const { data } = await db
    .from("notes")
    .upsert({ name: trimmed, slug }, { onConflict: "slug" })
    .select("id, name, slug")
    .single();
  revalidatePath("/collection");
  return data;
}

export async function createThemeTag(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  await requireUser();
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

// Returns the user's personal_perfumes row id for this perfume, creating a
// bare row (neither in_collection nor in_wanted) if one doesn't exist. Lets
// us hang notes or tags on a perfume the user hasn't explicitly saved.
async function ensurePersonalPerfumeId(
  db: SupabaseClient,
  userId: string,
  perfumeId: number,
): Promise<number | null> {
  const { data: existing } = await db
    .from("personal_perfumes")
    .select("id")
    .eq("user_id", userId)
    .eq("perfume_id", perfumeId)
    .maybeSingle();
  if (existing?.id) return existing.id as number;
  const { data: inserted } = await db
    .from("personal_perfumes")
    .insert({ user_id: userId, perfume_id: perfumeId })
    .select("id")
    .single();
  return (inserted?.id as number) ?? null;
}

async function getPersonalPerfumeId(
  db: SupabaseClient,
  userId: string,
  perfumeId: number,
): Promise<number | null> {
  const { data } = await db
    .from("personal_perfumes")
    .select("id")
    .eq("user_id", userId)
    .eq("perfume_id", perfumeId)
    .maybeSingle();
  return (data?.id as number) ?? null;
}

export async function addPersonalNoteByName(
  perfumeId: number,
  name: string,
): Promise<TagRef | null> {
  const note = await upsertCanonicalNote(name);
  if (!note) return null;
  const user = await requireUser();
  const db = await createClient();
  const personalId = await ensurePersonalPerfumeId(db, user.id, perfumeId);
  if (!personalId) return null;
  await db
    .from("personal_perfume_notes")
    .upsert(
      {
        user_id: user.id,
        personal_perfume_id: personalId,
        note_id: note.id,
      },
      {
        onConflict: "personal_perfume_id,note_id",
        ignoreDuplicates: true,
      },
    );
  revalidatePath("/", "layout");
  return note;
}

export async function addThemeTagByName(
  perfumeId: number,
  name: string,
): Promise<TagRef | null> {
  const tag = await createThemeTag(name);
  if (!tag) return null;
  const user = await requireUser();
  const db = await createClient();
  const personalId = await ensurePersonalPerfumeId(db, user.id, perfumeId);
  if (!personalId) return null;
  await db
    .from("personal_perfume_theme_tags")
    .upsert(
      {
        user_id: user.id,
        personal_perfume_id: personalId,
        theme_tag_id: tag.id,
      },
      {
        onConflict: "personal_perfume_id,theme_tag_id",
        ignoreDuplicates: true,
      },
    );
  revalidatePath("/", "layout");
  return tag;
}

export async function detachPersonalNote(
  perfumeId: number,
  noteId: number,
) {
  const user = await requireUser();
  const db = await createClient();
  const personalId = await getPersonalPerfumeId(db, user.id, perfumeId);
  if (!personalId) return;
  await db
    .from("personal_perfume_notes")
    .delete()
    .eq("user_id", user.id)
    .eq("personal_perfume_id", personalId)
    .eq("note_id", noteId);
  revalidatePath("/", "layout");
}

export async function detachThemeTag(perfumeId: number, tagId: number) {
  const user = await requireUser();
  const db = await createClient();
  const personalId = await getPersonalPerfumeId(db, user.id, perfumeId);
  if (!personalId) return;
  await db
    .from("personal_perfume_theme_tags")
    .delete()
    .eq("user_id", user.id)
    .eq("personal_perfume_id", personalId)
    .eq("theme_tag_id", tagId);
  revalidatePath("/", "layout");
}
