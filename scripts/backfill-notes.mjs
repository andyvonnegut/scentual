#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { rebuildCanonicalNotes, syncListingNoteRows } from "../lib/scrape/note-sync.mjs";
import { extractNotesForRetailer } from "../lib/scrape/notes.mjs";

const SUPPORTED_RETAILERS = new Set(["ministryofscent", "luckyscent"]);

function parseRetailerArg(argv) {
  const retailerArg = argv.find((arg) => arg.startsWith("--retailer="));
  if (!retailerArg) return null;
  const retailer = retailerArg.slice("--retailer=".length).trim();
  if (!SUPPORTED_RETAILERS.has(retailer)) {
    throw new Error(
      `Unsupported retailer "${retailer}". Use one of: ${[...SUPPORTED_RETAILERS].join(", ")}`,
    );
  }
  return retailer;
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "scentual-backfill/0.1 (+personal archive)" },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed for ${url}: ${res.status}`);
  }
  return res.text();
}

async function run() {
  const retailerFilter = parseRetailerArg(process.argv.slice(2));
  const db = createServiceClient();

  const summary = {
    retailer: retailerFilter ?? "all",
    processed: 0,
    synced: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const pageSize = 100;
  for (let from = 0; ; from += pageSize) {
    let query = db
      .from("perfume_listings")
      .select(
        `
        id,
        source_url,
        source_description,
        retailer:retailers!inner(slug)
        `,
      )
      .eq("active", true)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (retailerFilter) {
      query = query.eq("retailer.slug", retailerFilter);
    }

    const { data: listings, error } = await query;
    if (error) throw error;
    if (!listings || listings.length === 0) break;

    for (const listing of listings) {
      summary.processed++;

      const retailer = Array.isArray(listing.retailer)
        ? listing.retailer[0]
        : listing.retailer;
      const retailerSlug = retailer?.slug;

      if (!retailerSlug || !SUPPORTED_RETAILERS.has(retailerSlug)) {
        summary.skipped++;
        continue;
      }

      try {
        let html = listing.source_description;
        if (!html || retailerSlug === "luckyscent") {
          html = await fetchHtml(listing.source_url);
        }

        const notes = extractNotesForRetailer(retailerSlug, html);
        await syncListingNoteRows(db, {
          listingId: listing.id,
          noteNames: notes,
        });
        summary.synced++;
      } catch (err) {
        summary.failed++;
        if (summary.errors.length < 20) {
          summary.errors.push(
            `${listing.source_url}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  }

  summary.rebuild = await rebuildCanonicalNotes(db);

  console.log(JSON.stringify(summary, null, 2));

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
