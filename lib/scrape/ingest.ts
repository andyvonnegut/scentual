import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { ScrapedPerfume } from "./types";
import { normalizeNoteName, slugify } from "./normalize";

type ServiceClient = SupabaseClient<Database>;

export interface IngestCounts {
  seen: number;
  created: number;
  updated: number;
  priceChanges: number;
  stockChanges: number;
}

export interface IngestContext {
  db: ServiceClient;
  retailerId: number;
  seenListingIds: Set<number>;
}

export async function ingestOne(
  ctx: IngestContext,
  scraped: ScrapedPerfume,
  counts: IngestCounts,
): Promise<void> {
  const { db, retailerId } = ctx;
  counts.seen++;

  // 1. Manufacturer (global unique slug).
  const manufacturerSlug = slugify(scraped.manufacturerName);
  const { data: manufacturer, error: mErr } = await db
    .from("manufacturers")
    .upsert(
      { name: scraped.manufacturerName, slug: manufacturerSlug },
      { onConflict: "slug" },
    )
    .select("id")
    .single();
  if (mErr || !manufacturer) throw mErr ?? new Error("manufacturer upsert failed");

  // 2. Perfume (manufacturer_id + slug).
  const perfumeSlug = slugify(scraped.name);
  const { data: perfume, error: pErr } = await db
    .from("perfumes")
    .upsert(
      {
        manufacturer_id: manufacturer.id,
        name: scraped.name,
        slug: perfumeSlug,
        canonical_description: null,
      },
      { onConflict: "manufacturer_id,slug" },
    )
    .select("id")
    .single();
  if (pErr || !perfume) throw pErr ?? new Error("perfume upsert failed");

  // 3. Listing — prefer stable (retailer_id, source_product_id); fall back to
  // (retailer_id, source_url) for retailers that don't expose a stable id.
  // Keying on source_url breaks when the upstream handle changes (e.g. the
  // retailer fixes bad product metadata), leaving stale URLs in our DB.
  const nowIso = new Date().toISOString();
  let existingListing: { id: number } | null = null;
  if (scraped.sourceProductId) {
    const { data } = await db
      .from("perfume_listings")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("source_product_id", scraped.sourceProductId)
      .maybeSingle();
    existingListing = data ?? null;
  }
  if (!existingListing) {
    const { data } = await db
      .from("perfume_listings")
      .select("id")
      .eq("retailer_id", retailerId)
      .eq("source_url", scraped.sourceUrl)
      .maybeSingle();
    existingListing = data ?? null;
  }

  let listingId: number;
  if (existingListing) {
    listingId = existingListing.id;
    await db
      .from("perfume_listings")
      .update({
        last_seen_at: nowIso,
        last_scraped_at: nowIso,
        active: true,
        source_url: scraped.sourceUrl,
        source_title: scraped.sourceTitle,
        source_description: scraped.sourceDescription,
        source_product_id: scraped.sourceProductId,
      })
      .eq("id", listingId);
    counts.updated++;
  } else {
    const { data: newListing, error: lErr } = await db
      .from("perfume_listings")
      .insert({
        perfume_id: perfume.id,
        retailer_id: retailerId,
        source_url: scraped.sourceUrl,
        source_product_id: scraped.sourceProductId,
        source_title: scraped.sourceTitle,
        source_description: scraped.sourceDescription,
      })
      .select("id")
      .single();
    if (lErr || !newListing) throw lErr ?? new Error("listing insert failed");
    listingId = newListing.id;
    counts.created++;
  }
  ctx.seenListingIds.add(listingId);

  // 4. Variants + price/stock diffing.
  for (const v of scraped.variants) {
    const { data: existingVariant } = await db
      .from("listing_variants")
      .select("id, current_price, current_stock_status")
      .eq("perfume_listing_id", listingId)
      .eq("size_label", v.sizeLabel)
      .maybeSingle();

    if (existingVariant) {
      const existingPrice =
        existingVariant.current_price === null
          ? null
          : Number(existingVariant.current_price);
      const priceChanged =
        v.currentPrice !== null && existingPrice !== v.currentPrice;
      const stockChanged =
        existingVariant.current_stock_status !== v.currentStockStatus;

      await db
        .from("listing_variants")
        .update({
          current_price: v.currentPrice,
          current_stock_status: v.currentStockStatus,
          current_stock_raw: v.currentStockRaw,
          last_seen_at: nowIso,
        })
        .eq("id", existingVariant.id);

      if (priceChanged && v.currentPrice !== null) {
        await db.from("listing_price_history").insert({
          listing_variant_id: existingVariant.id,
          price: v.currentPrice,
          currency: v.currency,
          change_type:
            existingPrice === null || existingPrice < v.currentPrice
              ? "increase"
              : "decrease",
        });
        counts.priceChanges++;
      }
      if (stockChanged) {
        await db.from("listing_stock_history").insert({
          listing_variant_id: existingVariant.id,
          stock_status: v.currentStockStatus,
          stock_raw: v.currentStockRaw,
          change_type: "changed",
        });
        counts.stockChanges++;
      }
    } else {
      const { data: newVariant, error: vErr } = await db
        .from("listing_variants")
        .insert({
          perfume_listing_id: listingId,
          size_label: v.sizeLabel,
          size_value_ml: v.sizeValueMl,
          current_price: v.currentPrice,
          currency: v.currency,
          current_stock_status: v.currentStockStatus,
          current_stock_raw: v.currentStockRaw,
        })
        .select("id")
        .single();
      if (vErr || !newVariant) throw vErr ?? new Error("variant insert failed");

      if (v.currentPrice !== null) {
        await db.from("listing_price_history").insert({
          listing_variant_id: newVariant.id,
          price: v.currentPrice,
          currency: v.currency,
          change_type: "initial",
        });
      }
      await db.from("listing_stock_history").insert({
        listing_variant_id: newVariant.id,
        stock_status: v.currentStockStatus,
        stock_raw: v.currentStockRaw,
        change_type: "initial",
      });
    }
  }

  // 5. Notes (canonical + source traceability).
  for (const rawNote of scraped.notes) {
    const normalized = normalizeNoteName(rawNote);
    if (!normalized) continue;
    const noteSlug = slugify(normalized);
    if (!noteSlug) continue;

    const { data: note, error: nErr } = await db
      .from("notes")
      .upsert({ name: normalized, slug: noteSlug }, { onConflict: "slug" })
      .select("id")
      .single();
    if (nErr || !note) continue;

    await db
      .from("source_notes")
      .upsert(
        {
          retailer_id: retailerId,
          raw_note_name: rawNote,
          normalized_note_id: note.id,
        },
        { onConflict: "retailer_id,raw_note_name", ignoreDuplicates: true },
      );

    await db
      .from("perfume_notes")
      .upsert(
        { perfume_id: perfume.id, note_id: note.id },
        { onConflict: "perfume_id,note_id", ignoreDuplicates: true },
      );

    await db
      .from("perfume_source_notes")
      .upsert(
        {
          perfume_listing_id: listingId,
          raw_note_text: rawNote,
          normalized_note_id: note.id,
        },
        {
          onConflict: "perfume_listing_id,raw_note_text",
          ignoreDuplicates: true,
        },
      );
  }
}

export async function markStaleListingsInactive(
  db: ServiceClient,
  retailerId: number,
  runStartIso: string,
): Promise<number> {
  const { data, error } = await db
    .from("perfume_listings")
    .update({ active: false })
    .eq("retailer_id", retailerId)
    .lt("last_scraped_at", runStartIso)
    .eq("active", true)
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}
