"use server";

import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { slugify } from "@/lib/scrape/normalize";
import {
  toggleOwned,
  toggleDesired,
  toggleSniffed,
} from "@/app/actions/library";

export type ListKind = "owned" | "desired" | "sniffed";

export type CreateUserPerfumeResult =
  | { ok: true; perfumeId: number; redirectTo: string }
  | { ok: false; error: string };

export async function createUserPerfume(input: {
  manufacturerId: number | null;
  manufacturerName: string | null;
  perfumeName: string;
  listKind: ListKind;
}): Promise<CreateUserPerfumeResult> {
  const user = await requireUser();
  const db = await createClient();

  const perfumeName = input.perfumeName.trim();
  if (!perfumeName) {
    return { ok: false, error: "Perfume name is required." };
  }

  const hasManufacturerId = input.manufacturerId !== null;
  const manufacturerName = input.manufacturerName?.trim() ?? "";
  if (!hasManufacturerId && !manufacturerName) {
    return { ok: false, error: "House is required." };
  }

  // Resolve manufacturer.
  let manufacturerId: number;
  if (hasManufacturerId) {
    const { data: existing } = await db
      .from("manufacturers")
      .select("id")
      .eq("id", input.manufacturerId!)
      .maybeSingle();
    if (!existing) {
      return { ok: false, error: "House not found." };
    }
    manufacturerId = existing.id;
  } else {
    const slug = slugify(manufacturerName);
    if (!slug) {
      return { ok: false, error: "House name is not valid." };
    }
    const { data: bySlug } = await db
      .from("manufacturers")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (bySlug) {
      manufacturerId = bySlug.id;
    } else {
      const { data: created, error: insertErr } = await db
        .from("manufacturers")
        .insert({
          name: manufacturerName,
          slug,
          is_user_submitted: true,
          created_by_user_id: user.id,
        })
        .select("id")
        .single();
      if (insertErr || !created) {
        return {
          ok: false,
          error: insertErr?.message ?? "Could not create house.",
        };
      }
      manufacturerId = created.id;
    }
  }

  // Resolve perfume — collide silently into the existing row regardless of
  // whether it's canonical or another user's submission. (manufacturer_id,
  // slug) is the global dedup key for the perfumes table.
  const perfumeSlug = slugify(perfumeName);
  if (!perfumeSlug) {
    return { ok: false, error: "Perfume name is not valid." };
  }

  const { data: existingPerfume } = await db
    .from("perfumes")
    .select("id")
    .eq("manufacturer_id", manufacturerId)
    .eq("slug", perfumeSlug)
    .maybeSingle();

  let perfumeId: number;
  if (existingPerfume) {
    perfumeId = existingPerfume.id;
  } else {
    const { data: created, error: insertErr } = await db
      .from("perfumes")
      .insert({
        manufacturer_id: manufacturerId,
        name: perfumeName,
        slug: perfumeSlug,
        is_user_submitted: true,
        created_by_user_id: user.id,
      })
      .select("id")
      .single();
    if (insertErr || !created) {
      return {
        ok: false,
        error: insertErr?.message ?? "Could not create perfume.",
      };
    }
    perfumeId = created.id;
  }

  // Reuse the existing list-state actions so timestamps and dedup behave
  // identically to the catalog flow. These also call revalidatePath, so the
  // user's collection page picks up the new row immediately.
  if (input.listKind === "owned") {
    await toggleOwned(perfumeId, true);
  } else if (input.listKind === "desired") {
    await toggleDesired(perfumeId, true);
  } else {
    await toggleSniffed(perfumeId, true);
  }

  return {
    ok: true,
    perfumeId,
    redirectTo: `/collection?filter=${input.listKind}`,
  };
}
