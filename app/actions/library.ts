"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import type { SupabaseClient } from "@supabase/supabase-js";

async function upsertPersonal(perfumeId: number) {
  const db = createServiceClient();
  const { data: existing } = await db
    .from("personal_perfumes")
    .select("*")
    .eq("perfume_id", perfumeId)
    .maybeSingle();
  return { db, existing };
}

// A personal_perfumes row is worth keeping around (even with both flags off)
// if the user has attached tags or written notes on it. Without this check,
// un-toggling the last list would silently cascade-delete their tags.
async function hasPersonalData(
  db: SupabaseClient,
  personalId: number,
  existing: {
    size_owned_text?: string | null;
    personal_note?: string | null;
    rating?: number | null;
  } | null,
): Promise<boolean> {
  if (existing?.size_owned_text || existing?.personal_note) return true;
  if (existing?.rating != null) return true;
  const [noteCount, themeCount] = await Promise.all([
    db
      .from("personal_perfume_notes")
      .select("personal_perfume_id", { count: "exact", head: true })
      .eq("personal_perfume_id", personalId),
    db
      .from("personal_perfume_theme_tags")
      .select("personal_perfume_id", { count: "exact", head: true })
      .eq("personal_perfume_id", personalId),
  ]);
  return (noteCount.count ?? 0) > 0 || (themeCount.count ?? 0) > 0;
}

export async function toggleCollection(perfumeId: number, next: boolean) {
  const { db, existing } = await upsertPersonal(perfumeId);
  const nowIso = new Date().toISOString();

  if (!existing) {
    if (!next) return; // nothing to do
    await db.from("personal_perfumes").insert({
      perfume_id: perfumeId,
      in_collection: true,
      in_wanted: false,
      added_to_collection_at: nowIso,
    });
  } else {
    const keepWanted = existing.in_wanted;
    const shouldPreserve =
      !next &&
      !keepWanted &&
      (await hasPersonalData(db, existing.id, existing));
    if (!next && !keepWanted && !shouldPreserve) {
      await db.from("personal_perfumes").delete().eq("id", existing.id);
    } else {
      await db
        .from("personal_perfumes")
        .update({
          in_collection: next,
          added_to_collection_at:
            next && !existing.in_collection
              ? nowIso
              : existing.added_to_collection_at,
        })
        .eq("id", existing.id);
    }
  }

  revalidatePath("/", "layout");
}

export async function toggleWanted(perfumeId: number, next: boolean) {
  const { db, existing } = await upsertPersonal(perfumeId);
  const nowIso = new Date().toISOString();

  if (!existing) {
    if (!next) return;
    await db.from("personal_perfumes").insert({
      perfume_id: perfumeId,
      in_collection: false,
      in_wanted: true,
      added_to_wanted_at: nowIso,
    });
  } else {
    const keepCollection = existing.in_collection;
    const shouldPreserve =
      !next &&
      !keepCollection &&
      (await hasPersonalData(db, existing.id, existing));
    if (!next && !keepCollection && !shouldPreserve) {
      await db.from("personal_perfumes").delete().eq("id", existing.id);
    } else {
      await db
        .from("personal_perfumes")
        .update({
          in_wanted: next,
          added_to_wanted_at:
            next && !existing.in_wanted ? nowIso : existing.added_to_wanted_at,
        })
        .eq("id", existing.id);
    }
  }

  revalidatePath("/", "layout");
}

export async function updatePersonalMeta(
  perfumeId: number,
  patch: { size_owned_text?: string | null; personal_note?: string | null },
) {
  const db = createServiceClient();
  await db.from("personal_perfumes").update(patch).eq("perfume_id", perfumeId);
  revalidatePath("/", "layout");
}

export async function setRating(perfumeId: number, rating: number | null) {
  if (rating !== null && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
    throw new Error("Rating must be an integer between 1 and 5, or null");
  }

  const { db, existing } = await upsertPersonal(perfumeId);

  if (!existing) {
    if (rating === null) return;
    await db.from("personal_perfumes").insert({
      perfume_id: perfumeId,
      in_collection: false,
      in_wanted: false,
      rating,
    });
  } else {
    const shouldDelete =
      rating === null &&
      !existing.in_collection &&
      !existing.in_wanted &&
      !(await hasPersonalData(db, existing.id, { ...existing, rating: null }));

    if (shouldDelete) {
      await db.from("personal_perfumes").delete().eq("id", existing.id);
    } else {
      await db
        .from("personal_perfumes")
        .update({ rating })
        .eq("id", existing.id);
    }
  }

  revalidatePath("/", "layout");
}
