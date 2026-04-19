"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";

async function upsertPersonal(perfumeId: number) {
  const db = createServiceClient();
  const { data: existing } = await db
    .from("personal_perfumes")
    .select("*")
    .eq("perfume_id", perfumeId)
    .maybeSingle();
  return { db, existing };
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
    if (!next && !keepWanted) {
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

  revalidatePath("/library");
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
    if (!next && !keepCollection) {
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

  revalidatePath("/library");
}

export async function updatePersonalMeta(
  perfumeId: number,
  patch: { size_owned_text?: string | null; personal_note?: string | null },
) {
  const db = createServiceClient();
  await db.from("personal_perfumes").update(patch).eq("perfume_id", perfumeId);
  revalidatePath("/library");
}
