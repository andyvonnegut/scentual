#!/usr/bin/env tsx
/**
 * One-off cleanup for perfume rows that are really multi-piece sets, kits,
 * bundles, or "gifts with purchase" (see `lib/scrape/is-set.ts`). Run with:
 *
 *   node --env-file=.env.local -e "" && npx tsx --env-file=.env.local scripts/purge-set-perfumes.ts
 *
 * Default is dry-run; pass --apply to actually delete. Deleting a perfume
 * cascades to listings, variants, price/stock history, and note tables via
 * FK `on delete cascade`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { isSetOrKit } from "../lib/scrape/is-set";
import type { ScrapedVariant, StockStatus } from "../lib/scrape/types";

type ServiceClient = SupabaseClient<Database>;

interface PerfumeRow {
  id: number;
  name: string;
  slug: string;
  manufacturer: { id: number; slug: string; name: string };
  perfume_listings: Array<{
    id: number;
    source_title: string;
    source_url: string;
    listing_variants: Array<{ size_label: string }>;
  }>;
}

function createServiceClient(): ServiceClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local)",
    );
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loadAllPerfumes(db: ServiceClient): Promise<PerfumeRow[]> {
  const rows: PerfumeRow[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from("perfumes")
      .select(
        `
        id,
        name,
        slug,
        manufacturer:manufacturers!inner(id, slug, name),
        perfume_listings(
          id,
          source_title,
          source_url,
          listing_variants(size_label)
        )
        `,
      )
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as unknown as PerfumeRow[];
    if (page.length === 0) break;
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function variantsFor(row: PerfumeRow): ScrapedVariant[] {
  const stub: Omit<ScrapedVariant, "sizeLabel"> = {
    sizeValueMl: null,
    currentPrice: null,
    currency: "USD",
    currentStockStatus: "unknown" as StockStatus,
    currentStockRaw: null,
  };
  const out: ScrapedVariant[] = [];
  for (const l of row.perfume_listings ?? []) {
    for (const v of l.listing_variants ?? []) {
      out.push({ sizeLabel: v.size_label, ...stub });
    }
  }
  return out;
}

function classify(row: PerfumeRow): { hit: boolean; reason: string } {
  const variants = variantsFor(row);

  if (isSetOrKit({ title: row.name, vendor: row.manufacturer.name, variants })) {
    return { hit: true, reason: "name/variant" };
  }

  for (const l of row.perfume_listings ?? []) {
    if (isSetOrKit({ title: l.source_title, vendor: row.manufacturer.name })) {
      return { hit: true, reason: `source_title (${l.source_title})` };
    }
  }

  // Slug-level safety net for the exact patterns seen in prod.
  if (/gifts?-with-purchase/.test(row.manufacturer.slug)) {
    return { hit: true, reason: `manufacturer slug (${row.manufacturer.slug})` };
  }
  if (
    /^\d+-piece-|-piece-|discovery-(?:kit|set)$|-gift-set$|-sampler$|-bundle$|-kit$|sample-set/.test(
      row.slug,
    )
  ) {
    return { hit: true, reason: `slug (${row.slug})` };
  }

  return { hit: false, reason: "" };
}

async function deletePerfumes(
  db: ServiceClient,
  ids: number[],
): Promise<void> {
  const batchSize = 200;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { error } = await db.from("perfumes").delete().in("id", batch);
    if (error) throw error;
    console.log(`[purge] deleted ${Math.min(i + batch.length, ids.length)}/${ids.length}`);
  }
}

async function run() {
  const apply = process.argv.includes("--apply");
  const db = createServiceClient();

  console.log(`[purge] loading perfumes...`);
  const all = await loadAllPerfumes(db);
  console.log(`[purge] loaded ${all.length} perfumes`);

  const hits: Array<{ row: PerfumeRow; reason: string }> = [];
  for (const row of all) {
    const res = classify(row);
    if (res.hit) hits.push({ row, reason: res.reason });
  }

  console.log(`\n[purge] matched ${hits.length} perfume rows as sets/kits/bundles:\n`);
  for (const { row, reason } of hits) {
    console.log(
      `  #${row.id}  ${row.manufacturer.slug}/${row.slug}  ← ${reason}`,
    );
  }

  if (hits.length === 0) {
    console.log("[purge] nothing to do.");
    return;
  }

  if (!apply) {
    console.log(`\n[purge] DRY RUN — re-run with --apply to delete these ${hits.length} rows.`);
    return;
  }

  console.log(`\n[purge] deleting ${hits.length} rows (cascades to listings/variants/history/notes)...`);
  await deletePerfumes(
    db,
    hits.map((h) => h.row.id),
  );
  console.log("[purge] done.");
}

run().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
