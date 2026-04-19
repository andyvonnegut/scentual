import { createServiceClient } from "@/lib/supabase/service";
import type { SourceScraper } from "./types";
import {
  ingestOne,
  markStaleListingsInactive,
  type IngestCounts,
} from "./ingest";
import { ministryofscentScraper } from "./ministryofscent";
import { luckyscentScraper } from "./luckyscent";

const SCRAPERS: Record<string, SourceScraper> = {
  ministryofscent: ministryofscentScraper,
  luckyscent: luckyscentScraper,
};

export interface RunResult {
  runId: number;
  counts: IngestCounts;
  staleDeactivated: number;
  status: "succeeded" | "failed";
  error?: string;
}

export async function runScrape(
  sourceSlug: string,
  runType: "initial" | "daily" = "daily",
): Promise<RunResult> {
  const scraper = SCRAPERS[sourceSlug];
  if (!scraper) throw new Error(`Unknown source: ${sourceSlug}`);

  const db = createServiceClient();

  const { data: retailer, error: rErr } = await db
    .from("retailers")
    .select("id")
    .eq("slug", scraper.retailerSlug)
    .single();
  if (rErr || !retailer) {
    throw rErr ?? new Error(`Retailer not found: ${scraper.retailerSlug}`);
  }

  const { data: run, error: runErr } = await db
    .from("scrape_runs")
    .insert({
      source_name: sourceSlug,
      run_type: runType,
      status: "running",
    })
    .select("id, started_at")
    .single();
  if (runErr || !run) throw runErr ?? new Error("scrape_runs insert failed");

  const counts: IngestCounts = {
    seen: 0,
    created: 0,
    updated: 0,
    priceChanges: 0,
    stockChanges: 0,
  };
  const ctx = {
    db,
    retailerId: retailer.id,
    seenListingIds: new Set<number>(),
  };

  let staleDeactivated = 0;
  let firstErrorSummary: string | undefined;

  try {
    for await (const scraped of scraper.crawl()) {
      try {
        await ingestOne(ctx, scraped, counts);
      } catch (err) {
        if (!firstErrorSummary) {
          firstErrorSummary = `ingest error on ${scraped.sourceUrl}: ${
            err instanceof Error ? err.message : String(err)
          }`;
        }
      }
    }

    staleDeactivated = await markStaleListingsInactive(
      db,
      retailer.id,
      run.started_at,
    );

    await db
      .from("scrape_runs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        records_seen: counts.seen,
        records_created: counts.created,
        records_updated: counts.updated,
        error_summary: firstErrorSummary ?? null,
      })
      .eq("id", run.id);

    return {
      runId: run.id,
      counts,
      staleDeactivated,
      status: "succeeded",
      error: firstErrorSummary,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .from("scrape_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        records_seen: counts.seen,
        records_created: counts.created,
        records_updated: counts.updated,
        error_summary: message,
      })
      .eq("id", run.id);
    return {
      runId: run.id,
      counts,
      staleDeactivated,
      status: "failed",
      error: message,
    };
  }
}

export const KNOWN_SOURCES = Object.keys(SCRAPERS);
