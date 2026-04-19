import type { StockStatus } from "@/lib/database.types";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

const NOTE_SYNONYMS: Record<string, string> = {
  "orange-blossom": "orange blossom",
  "pink-pepper": "pink pepper",
  "green-tea": "green tea",
};

export function normalizeNoteName(raw: string): string {
  let n = raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/g, "")
    .trim();

  // Hyphens inside multi-word notes → spaces, unless it's a known hyphenated
  // token (e.g. ylang-ylang).
  if (!/^[a-z]+-[a-z]+$/.test(n) || n === "orange-blossom" || n === "pink-pepper") {
    n = n.replace(/-/g, " ");
  }

  // Simple plural → singular cleanup for obvious cases.
  if (n.endsWith("s") && !n.endsWith("ss") && n.length > 3) {
    const candidates = ["woods", "notes", "spices", "flowers", "herbs"];
    if (!candidates.includes(n)) {
      // don't collapse; leave it alone for now
    }
  }

  return NOTE_SYNONYMS[n] ?? n;
}

export function parsePrice(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return raw;
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function parseSizeMl(sizeLabel: string): number | null {
  // Matches "50ml", "50 ml", "1.7 oz" (oz converts roughly).
  const mlMatch = sizeLabel.match(/(\d+(?:\.\d+)?)\s*ml/i);
  if (mlMatch) return parseFloat(mlMatch[1]);
  const ozMatch = sizeLabel.match(/(\d+(?:\.\d+)?)\s*oz/i);
  if (ozMatch) return Math.round(parseFloat(ozMatch[1]) * 29.5735 * 100) / 100;
  return null;
}

export function normalizeStockStatus(input: {
  available?: boolean | null;
  raw?: string | null;
}): StockStatus {
  const raw = (input.raw ?? "").toLowerCase();

  if (raw.includes("low stock") || raw.includes("last") || raw.includes("few left")) {
    return "low_stock";
  }
  if (raw.includes("unavailable") || raw.includes("discontinued")) {
    return "unavailable";
  }

  if (input.available === true) return "in_stock";
  if (input.available === false) return "out_of_stock";

  if (raw.includes("in stock")) return "in_stock";
  if (raw.includes("out of stock") || raw.includes("sold out")) return "out_of_stock";

  return "unknown";
}
