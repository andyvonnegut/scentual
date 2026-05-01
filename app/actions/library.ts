"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

async function loadPersonalRow(userId: string, perfumeId: number) {
  const db = await createClient();
  const { data: existing } = await db
    .from("personal_perfumes")
    .select("*")
    .eq("user_id", userId)
    .eq("perfume_id", perfumeId)
    .maybeSingle();
  return { db, existing };
}

export type PersonalRatingScale = "projection" | "overall" | "design";

type PersonalDataFields = {
  size_owned_text?: string | null;
  personal_note?: string | null;
  personal_narrative?: string | null;
  favorite?: boolean | null;
  projection_rating?: number | null;
  overall_rating?: number | null;
  design_rating?: number | null;
} | null;

type PersonalPerfumeInsert = Database["public"]["Tables"]["personal_perfumes"]["Insert"];
type PersonalPerfumeUpdate = Database["public"]["Tables"]["personal_perfumes"]["Update"];

function hasAnyRating(existing: PersonalDataFields) {
  if (!existing) return false;
  return (
    existing.projection_rating != null ||
    existing.overall_rating != null ||
    existing.design_rating != null
  );
}

function hasFavorite(existing: PersonalDataFields) {
  return existing?.favorite === true;
}

// A personal_perfumes row is worth keeping around (even with all three flags off)
// if the user has attached tags or written notes on it. Without this check,
// un-toggling the last list would silently cascade-delete their tags.
async function hasPersonalData(
  db: SupabaseClient,
  userId: string,
  personalId: number,
  existing: PersonalDataFields,
): Promise<boolean> {
  if (
    existing?.size_owned_text ||
    existing?.personal_note ||
    existing?.personal_narrative
  )
    return true;
  if (hasFavorite(existing)) return true;
  if (hasAnyRating(existing)) return true;
  const [noteCount, themeCount] = await Promise.all([
    db
      .from("personal_perfume_notes")
      .select("personal_perfume_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("personal_perfume_id", personalId),
    db
      .from("personal_perfume_theme_tags")
      .select("personal_perfume_id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("personal_perfume_id", personalId),
  ]);
  return (noteCount.count ?? 0) > 0 || (themeCount.count ?? 0) > 0;
}

function getRatingPatch(
  scale: PersonalRatingScale,
  rating: number | null,
): Pick<
  PersonalPerfumeInsert,
  "projection_rating" | "overall_rating" | "design_rating"
> {
  if (scale === "projection") return { projection_rating: rating };
  if (scale === "overall") return { overall_rating: rating };
  return { design_rating: rating };
}

export async function toggleOwned(perfumeId: number, next: boolean) {
  const user = await requireUser();
  const { db, existing } = await loadPersonalRow(user.id, perfumeId);
  const nowIso = new Date().toISOString();

  if (!existing) {
    if (!next) return;
    await db.from("personal_perfumes").insert({
      user_id: user.id,
      perfume_id: perfumeId,
      in_owned: true,
      added_to_owned_at: nowIso,
    });
  } else {
    const keepOther = existing.in_desired || existing.in_sniffed;
    const shouldPreserve =
      !next &&
      !keepOther &&
      (await hasPersonalData(db, user.id, existing.id, existing));
    if (!next && !keepOther && !shouldPreserve) {
      await db.from("personal_perfumes").delete().eq("id", existing.id);
    } else {
      await db
        .from("personal_perfumes")
        .update({
          in_owned: next,
          added_to_owned_at:
            next && !existing.in_owned
              ? nowIso
              : existing.added_to_owned_at,
        })
        .eq("id", existing.id);
    }
  }

  revalidatePath("/", "layout");
}

export async function toggleDesired(perfumeId: number, next: boolean) {
  const user = await requireUser();
  const { db, existing } = await loadPersonalRow(user.id, perfumeId);
  const nowIso = new Date().toISOString();

  if (!existing) {
    if (!next) return;
    await db.from("personal_perfumes").insert({
      user_id: user.id,
      perfume_id: perfumeId,
      in_desired: true,
      added_to_desired_at: nowIso,
    });
  } else {
    const keepOther = existing.in_owned || existing.in_sniffed;
    const shouldPreserve =
      !next &&
      !keepOther &&
      (await hasPersonalData(db, user.id, existing.id, existing));
    if (!next && !keepOther && !shouldPreserve) {
      await db.from("personal_perfumes").delete().eq("id", existing.id);
    } else {
      await db
        .from("personal_perfumes")
        .update({
          in_desired: next,
          added_to_desired_at:
            next && !existing.in_desired
              ? nowIso
              : existing.added_to_desired_at,
        })
        .eq("id", existing.id);
    }
  }

  revalidatePath("/", "layout");
}

export async function toggleSniffed(perfumeId: number, next: boolean) {
  const user = await requireUser();
  const { db, existing } = await loadPersonalRow(user.id, perfumeId);
  const nowIso = new Date().toISOString();

  if (!existing) {
    if (!next) return;
    await db.from("personal_perfumes").insert({
      user_id: user.id,
      perfume_id: perfumeId,
      in_sniffed: true,
      added_to_sniffed_at: nowIso,
    });
  } else {
    const keepOther = existing.in_owned || existing.in_desired;
    const shouldPreserve =
      !next &&
      !keepOther &&
      (await hasPersonalData(db, user.id, existing.id, existing));
    if (!next && !keepOther && !shouldPreserve) {
      await db.from("personal_perfumes").delete().eq("id", existing.id);
    } else {
      await db
        .from("personal_perfumes")
        .update({
          in_sniffed: next,
          added_to_sniffed_at:
            next && !existing.in_sniffed
              ? nowIso
              : existing.added_to_sniffed_at,
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
  const user = await requireUser();
  const db = await createClient();
  await db
    .from("personal_perfumes")
    .update(patch)
    .eq("user_id", user.id)
    .eq("perfume_id", perfumeId);
  revalidatePath("/", "layout");
}

export async function updatePersonalNarrative(
  perfumeId: number,
  narrative: string | null,
) {
  const user = await requireUser();
  const { db, existing } = await loadPersonalRow(user.id, perfumeId);
  const cleaned = narrative?.trim() ? narrative : null;

  if (!existing) {
    if (!cleaned) return;
    await db.from("personal_perfumes").insert({
      user_id: user.id,
      perfume_id: perfumeId,
      personal_narrative: cleaned,
    });
  } else {
    const nextExisting: PersonalPerfumeUpdate = {
      ...existing,
      personal_narrative: cleaned,
    };
    const shouldDelete =
      cleaned === null &&
      !existing.in_owned &&
      !existing.in_desired &&
      !existing.in_sniffed &&
      !(await hasPersonalData(db, user.id, existing.id, nextExisting));

    if (shouldDelete) {
      await db.from("personal_perfumes").delete().eq("id", existing.id);
    } else {
      await db
        .from("personal_perfumes")
        .update({ personal_narrative: cleaned })
        .eq("id", existing.id);
    }
  }

  revalidatePath("/", "layout");
}

export async function toggleFavorite(perfumeId: number, next: boolean) {
  const user = await requireUser();
  const { db, existing } = await loadPersonalRow(user.id, perfumeId);

  if (!existing) {
    if (!next) return;
    await db.from("personal_perfumes").insert({
      user_id: user.id,
      perfume_id: perfumeId,
      favorite: true,
    });
  } else {
    const nextExisting: PersonalPerfumeUpdate = {
      ...existing,
      favorite: next,
    };
    const shouldDelete =
      !next &&
      !existing.in_owned &&
      !existing.in_desired &&
      !existing.in_sniffed &&
      !(await hasPersonalData(db, user.id, existing.id, nextExisting));

    if (shouldDelete) {
      await db.from("personal_perfumes").delete().eq("id", existing.id);
    } else {
      await db
        .from("personal_perfumes")
        .update({ favorite: next })
        .eq("id", existing.id);
    }
  }

  revalidatePath("/", "layout");
}

export async function setPersonalRating(
  perfumeId: number,
  scale: PersonalRatingScale,
  rating: number | null,
) {
  if (rating !== null && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
    throw new Error("Rating must be an integer between 1 and 5, or null");
  }

  const user = await requireUser();
  const { db, existing } = await loadPersonalRow(user.id, perfumeId);
  const ratingPatch = getRatingPatch(scale, rating);

  if (!existing) {
    if (rating === null) return;
    await db.from("personal_perfumes").insert({
      user_id: user.id,
      perfume_id: perfumeId,
      ...ratingPatch,
    });
  } else {
    const nextExisting: PersonalPerfumeUpdate = {
      ...existing,
      ...ratingPatch,
    };
    const shouldDelete =
      rating === null &&
      !existing.in_owned &&
      !existing.in_desired &&
      !existing.in_sniffed &&
      !(await hasPersonalData(db, user.id, existing.id, nextExisting));

    if (shouldDelete) {
      await db.from("personal_perfumes").delete().eq("id", existing.id);
    } else {
      await db
        .from("personal_perfumes")
        .update(ratingPatch)
        .eq("id", existing.id);
    }
  }

  revalidatePath("/", "layout");
}
