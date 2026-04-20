import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { IngestCounts } from "./ingest";
import { slugify } from "./normalize";

type ServiceClient = SupabaseClient<Database>;

const DEFAULT_PERFUMAPI_BASE_URL = "https://perfumapidatabase.onrender.com";
const PERFUMAPI_USER_AGENT = "scentual-archivist/0.1 (+personal archive)";
const PERFUMAPI_PAGE_SIZE = 100;

interface PerfumApiStatsResponse {
  total_perfumes?: number;
}

interface PerfumApiListResponse {
  total?: number;
  perfumes?: PerfumApiPerfumeRow[];
}

interface PerfumApiPerfumeRow {
  name?: string | null;
  brand?: string | null;
  release_year?: number | null;
  gender?: string | null;
  notes_top?: string[] | null;
  notes_middle?: string[] | null;
  notes_base?: string[] | null;
  rating?: number | null;
  votes?: number | null;
  description?: string | null;
  longevity?: string | number | null;
  sillage?: string | number | null;
  perfume_url?: string | null;
}

export interface FragranticaPerfume {
  name: string;
  brand: string;
  releaseYear: number | null;
  gender: string | null;
  notesTop: string[];
  notesMiddle: string[];
  notesBase: string[];
  rating: number | null;
  votes: number | null;
  description: string | null;
  longevity: string | null;
  sillage: string | null;
  perfumeUrl: string;
}

function normalizeWhitespace(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPerfumApiBaseUrl() {
  return (
    process.env.PERFUMAPI_BASE_URL?.trim().replace(/\/+$/, "") ??
    DEFAULT_PERFUMAPI_BASE_URL
  );
}

export function normalizeFragranticaPerfumeName(name: string, brand: string) {
  const cleanName = normalizeWhitespace(name);
  const cleanBrand = normalizeWhitespace(brand);

  if (!cleanBrand) return cleanName;

  const lowerName = cleanName.toLowerCase();
  const lowerBrand = cleanBrand.toLowerCase();
  if (lowerName === lowerBrand) return cleanName;
  if (!lowerName.endsWith(` ${lowerBrand}`)) return cleanName;

  return cleanName.slice(0, cleanName.length - cleanBrand.length).trim();
}

function normalizeGender(value: string | null | undefined) {
  const clean = value ? normalizeWhitespace(value) : "";
  if (!clean) return null;

  switch (clean.toLowerCase()) {
    case "men":
    case "for men":
      return "Men";
    case "women":
    case "for women":
      return "Women";
    case "unisex":
    case "for women and men":
    case "women and men":
      return "Unisex";
    default:
      return clean;
  }
}

function normalizeTextArray(value: string[] | null | undefined) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const entry of value ?? []) {
    if (typeof entry !== "string") continue;
    const clean = normalizeWhitespace(entry);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(clean);
  }

  return normalized;
}

function normalizeOptionalText(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const clean = normalizeWhitespace(String(value));
  return clean || null;
}

function normalizeOptionalNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function normalizeOptionalInteger(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.trunc(value);
}

function normalizePerfumeRow(row: PerfumApiPerfumeRow): FragranticaPerfume | null {
  const brand = row.brand ? normalizeWhitespace(row.brand) : "";
  const rawName = row.name ? normalizeWhitespace(row.name) : "";
  const perfumeUrl = row.perfume_url ? normalizeWhitespace(row.perfume_url) : "";
  const name = rawName && brand
    ? normalizeFragranticaPerfumeName(rawName, brand)
    : rawName;

  if (!brand || !name || !perfumeUrl) return null;

  return {
    name,
    brand,
    releaseYear:
      typeof row.release_year === "number" && Number.isInteger(row.release_year)
        ? row.release_year
        : null,
    gender: normalizeGender(row.gender),
    notesTop: normalizeTextArray(row.notes_top),
    notesMiddle: normalizeTextArray(row.notes_middle),
    notesBase: normalizeTextArray(row.notes_base),
    rating: normalizeOptionalNumber(row.rating),
    votes: normalizeOptionalInteger(row.votes),
    description: normalizeOptionalText(row.description),
    longevity: normalizeOptionalText(row.longevity),
    sillage: normalizeOptionalText(row.sillage),
    perfumeUrl,
  };
}

async function fetchJson<T>(path: string, timeoutMs: number) {
  const url = `${getPerfumApiBaseUrl()}${path}`;
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": PERFUMAPI_USER_AGENT,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`PerfumAPI ${path} -> ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (attempt === 1) break;
      await sleep(4000 * (attempt + 1));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function fetchStats() {
  const response = await fetchJson<PerfumApiStatsResponse>("/stats", 90_000);
  const total = response.total_perfumes;
  if (typeof total !== "number" || total < 0) {
    throw new Error("PerfumAPI stats response missing total_perfumes");
  }
  return total;
}

async function fetchPage(offset: number) {
  const response = await fetchJson<PerfumApiListResponse>(
    `/perfumes?limit=${PERFUMAPI_PAGE_SIZE}&offset=${offset}`,
    60_000,
  );
  return response.perfumes ?? [];
}

async function upsertManufacturer(
  db: ServiceClient,
  brandName: string,
) {
  const brandSlug = slugify(brandName);
  const { data: existing, error: existingError } = await db
    .from("manufacturers")
    .select("id")
    .eq("slug", brandSlug)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) {
    return { id: existing.id, slug: brandSlug };
  }

  const { data, error } = await db
    .from("manufacturers")
    .insert({ name: brandName, slug: brandSlug })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error(`manufacturer upsert failed for ${brandName}`);
  }

  return { id: data.id, slug: brandSlug };
}

async function findPerfumeMatch(
  db: ServiceClient,
  perfume: FragranticaPerfume,
) {
  const { data: byUrl, error: urlError } = await db
    .from("perfumes")
    .select("id")
    .eq("fragrantica_url", perfume.perfumeUrl)
    .maybeSingle();
  if (urlError) throw urlError;
  if (byUrl) return { id: byUrl.id, created: false };

  const manufacturer = await upsertManufacturer(db, perfume.brand);
  const perfumeSlug = slugify(perfume.name);

  const { data: byHouseAndPerfume, error: perfumeError } = await db
    .from("perfumes")
    .select("id")
    .eq("manufacturer_id", manufacturer.id)
    .eq("slug", perfumeSlug)
    .maybeSingle();
  if (perfumeError) throw perfumeError;

  if (byHouseAndPerfume) {
    return { id: byHouseAndPerfume.id, created: false };
  }

  const nowIso = new Date().toISOString();
  const { data: created, error: createError } = await db
    .from("perfumes")
    .insert({
      manufacturer_id: manufacturer.id,
      name: perfume.name,
      slug: perfumeSlug,
      canonical_description: perfume.description,
      release_year: perfume.releaseYear,
      gender: perfume.gender,
      notes_top: perfume.notesTop,
      notes_middle: perfume.notesMiddle,
      notes_base: perfume.notesBase,
      fragrantica_rating: perfume.rating,
      fragrantica_votes: perfume.votes,
      fragrantica_longevity: perfume.longevity,
      fragrantica_sillage: perfume.sillage,
      fragrantica_url: perfume.perfumeUrl,
      fragrantica_last_synced_at: nowIso,
    })
    .select("id")
    .single();

  if (createError || !created) {
    throw createError ?? new Error(`perfume insert failed for ${perfume.name}`);
  }

  return { id: created.id, created: true };
}

async function syncPerfume(
  db: ServiceClient,
  perfume: FragranticaPerfume,
  counts: IngestCounts,
) {
  const matched = await findPerfumeMatch(db, perfume);
  const nowIso = new Date().toISOString();

  const { error } = await db
    .from("perfumes")
    .update({
      canonical_description: perfume.description,
      release_year: perfume.releaseYear,
      gender: perfume.gender,
      notes_top: perfume.notesTop,
      notes_middle: perfume.notesMiddle,
      notes_base: perfume.notesBase,
      fragrantica_rating: perfume.rating,
      fragrantica_votes: perfume.votes,
      fragrantica_longevity: perfume.longevity,
      fragrantica_sillage: perfume.sillage,
      fragrantica_url: perfume.perfumeUrl,
      fragrantica_last_synced_at: nowIso,
    })
    .eq("id", matched.id);

  if (error) throw error;

  if (matched.created) counts.created++;
  else counts.updated++;
}

export async function syncFragranticaMetadata(
  db: ServiceClient,
  counts: IngestCounts,
) {
  const total = await fetchStats();
  let firstErrorSummary: string | undefined;

  for (let offset = 0; offset < total; offset += PERFUMAPI_PAGE_SIZE) {
    const rows = await fetchPage(offset);
    if (rows.length === 0) break;

    for (const row of rows) {
      counts.seen++;
      const normalized = normalizePerfumeRow(row);
      if (!normalized) {
        if (!firstErrorSummary) {
          firstErrorSummary = `ingest error on unknown Fragrantica row: missing brand, name, or perfume_url`;
        }
        continue;
      }

      try {
        await syncPerfume(db, normalized, counts);
      } catch (error) {
        if (!firstErrorSummary) {
          firstErrorSummary = `ingest error on ${normalized.perfumeUrl}: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      }
    }

    if (rows.length < PERFUMAPI_PAGE_SIZE) break;
  }

  return { firstErrorSummary };
}
