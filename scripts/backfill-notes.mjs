#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";
import { rebuildCanonicalNotes, syncListingNoteRows } from "../lib/scrape/note-sync.mjs";
import { extractNotesForRetailer, isSuspiciousRawNoteText } from "../lib/scrape/notes.mjs";

const SUPPORTED_RETAILERS = new Set(["ministryofscent", "luckyscent"]);

async function mapWithConcurrency(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index++;
      results[current] = await fn(items[current], current);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

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

function hasFlag(argv, flag) {
  return argv.includes(flag);
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

async function selectAll(db, table, selectClause, configureQuery) {
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    let query = db
      .from(table)
      .select(selectClause)
      .range(from, from + pageSize - 1);

    if (configureQuery) {
      query = configureQuery(query);
    }

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < pageSize) break;
  }

  return rows;
}

async function listSuspiciousListingIds(db, retailerFilter) {
  const rows = await selectAll(
    db,
    "perfume_source_notes",
    `
    raw_note_text,
    perfume_listing:perfume_listings!inner(
      id,
      active,
      retailer:retailers!inner(slug)
    )
    `,
    (query) => {
      let nextQuery = query.eq("perfume_listing.active", true);
      if (retailerFilter) {
        nextQuery = nextQuery.eq("perfume_listing.retailer.slug", retailerFilter);
      }
      return nextQuery.order("id", { ascending: true });
    },
  );

  const listingIds = new Set();
  for (const row of rows) {
    if (!isSuspiciousRawNoteText(row.raw_note_text)) continue;
    const listing = Array.isArray(row.perfume_listing)
      ? row.perfume_listing[0]
      : row.perfume_listing;
    if (listing?.id) listingIds.add(listing.id);
  }

  return [...listingIds].sort((a, b) => a - b);
}

async function loadListingsPage(db, retailerFilter, from, pageSize) {
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
  return listings ?? [];
}

async function loadListingsByIds(db, listingIds) {
  const rows = [];

  for (const batch of Array.from({ length: Math.ceil(listingIds.length / 500) }, (_, index) =>
    listingIds.slice(index * 500, (index + 1) * 500),
  )) {
    const { data, error } = await db
      .from("perfume_listings")
      .select(
        `
        id,
        source_url,
        source_description,
        retailer:retailers!inner(slug)
        `,
      )
      .in("id", batch)
      .eq("active", true)
      .order("id", { ascending: true });
    if (error) throw error;
    rows.push(...(data ?? []));
  }

  return rows.sort((a, b) => a.id - b.id);
}

async function run() {
  const argv = process.argv.slice(2);
  const retailerFilter = parseRetailerArg(argv);
  const suspiciousOnly = hasFlag(argv, "--suspicious-only");
  const db = createServiceClient();

  const summary = {
    retailer: retailerFilter ?? "all",
    suspiciousOnly,
    processed: 0,
    synced: 0,
    skipped: 0,
    failed: 0,
    selectedListings: 0,
    errors: [],
  };

  const concurrency = 12;
  const pageSize = 100;

  async function processListings(listings) {
    if (!listings || listings.length === 0) return;

    await mapWithConcurrency(listings, concurrency, async (listing) => {
      summary.processed++;

      const retailer = Array.isArray(listing.retailer)
        ? listing.retailer[0]
        : listing.retailer;
      const retailerSlug = retailer?.slug;

      if (!retailerSlug || !SUPPORTED_RETAILERS.has(retailerSlug)) {
        summary.skipped++;
        return;
      }

      try {
        let html = listing.source_description;
        if (retailerSlug === "luckyscent") {
          html = await fetchHtml(listing.source_url);
        } else if (!html) {
          throw new Error("missing stored source_description for ministryofscent");
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

      const processed = summary.processed;
      if (processed % 100 === 0) {
        console.log(
          `[backfill-notes] processed=${processed} synced=${summary.synced} failed=${summary.failed} skipped=${summary.skipped}`,
        );
      }
    });
  }

  if (suspiciousOnly) {
    const listingIds = await listSuspiciousListingIds(db, retailerFilter);
    summary.selectedListings = listingIds.length;

    for (let index = 0; index < listingIds.length; index += pageSize) {
      const listings = await loadListingsByIds(db, listingIds.slice(index, index + pageSize));
      await processListings(listings);
    }
  } else {
    for (let from = 0; ; from += pageSize) {
      const listings = await loadListingsPage(db, retailerFilter, from, pageSize);
      if (listings.length === 0) break;
      summary.selectedListings += listings.length;
      await processListings(listings);
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
