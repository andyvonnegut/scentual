import * as cheerio from "cheerio";
import type { ScrapedPerfume, ScrapedVariant, SourceScraper } from "./types";
import {
  normalizeStockStatus,
  parsePrice,
  parseSizeMl,
} from "./normalize";

const BASE = "https://www.luckyscent.com";
const UA = "scentual-archivist/0.1 (+personal archive)";

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`LuckyScent ${url} → ${res.status}`);
  return res.text();
}

async function fetchSitemapIndex(): Promise<string[]> {
  const xml = await fetchText(`${BASE}/sitemap.xml`);
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("sitemap > loc")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((u) => u.includes("/sitemap/products/"));
}

async function fetchProductUrls(sitemapUrl: string): Promise<string[]> {
  const xml = await fetchText(sitemapUrl);
  const $ = cheerio.load(xml, { xmlMode: true });
  return $("url > loc")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((u) => u.includes("/products/"));
}

type LdJsonProduct = {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  brand?: string | { name?: string };
  sku?: string;
  offers?: LdOffer | LdOffer[];
};

type LdOffer = {
  "@type"?: string;
  name?: string;
  sku?: string;
  price?: string | number;
  priceCurrency?: string;
  availability?: string;
  itemOffered?: { name?: string };
};

function coerceArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function extractLdProduct(html: string): LdJsonProduct | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]').toArray();
  for (const s of scripts) {
    try {
      const text = $(s).contents().text().trim();
      if (!text) continue;
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const type = item?.["@type"];
        const typeStr = Array.isArray(type) ? type.join(",") : type;
        if (typeof typeStr === "string" && typeStr.includes("Product")) {
          return item as LdJsonProduct;
        }
      }
    } catch {
      // skip malformed
    }
  }
  return null;
}

function availabilityToStock(s: string | undefined) {
  const x = (s ?? "").toLowerCase();
  if (x.includes("instock")) return { available: true, raw: "in stock" };
  if (x.includes("outofstock")) return { available: false, raw: "out of stock" };
  if (x.includes("discontinued") || x.includes("unavailable")) {
    return { available: false, raw: "unavailable" };
  }
  return { available: null as boolean | null, raw: null as string | null };
}

async function scrapeProductPage(
  url: string,
): Promise<ScrapedPerfume | null> {
  const html = await fetchText(url);
  const ld = extractLdProduct(html);
  if (!ld) return null;

  const vendor =
    typeof ld.brand === "object"
      ? ld.brand?.name
      : typeof ld.brand === "string"
        ? ld.brand
        : undefined;
  if (!vendor || !ld.name) return null;

  const offers = coerceArray(ld.offers);
  const variants: ScrapedVariant[] = offers.map((o) => {
    const sizeLabel = o.itemOffered?.name ?? o.name ?? "default";
    const stock = availabilityToStock(o.availability);
    return {
      sizeLabel,
      sizeValueMl: parseSizeMl(sizeLabel),
      currentPrice: parsePrice(o.price ?? null),
      currency: o.priceCurrency ?? "USD",
      currentStockStatus: normalizeStockStatus({
        available: stock.available,
        raw: stock.raw,
      }),
      currentStockRaw: stock.raw,
    };
  });

  if (variants.length === 0) {
    variants.push({
      sizeLabel: "default",
      sizeValueMl: null,
      currentPrice: null,
      currency: "USD",
      currentStockStatus: "unknown",
      currentStockRaw: null,
    });
  }

  // Try a few DOM selectors for notes; fall back to empty.
  const $ = cheerio.load(html);
  const notesText = $("[class*=notes], [data-notes]")
    .first()
    .text()
    .trim();
  const notes = notesText
    ? notesText
        .split(/[,\/]|•| and | & /i)
        .map((s) => s.replace(/\s+/g, " ").trim())
        .filter((s) => s.length > 1 && s.length < 60)
    : [];

  return {
    manufacturerName: vendor.trim(),
    name: ld.name.trim(),
    sourceUrl: url,
    sourceProductId: ld.sku ?? null,
    sourceTitle: ld.name,
    sourceDescription: ld.description ?? null,
    notes,
    variants,
  };
}

export const luckyscentScraper: SourceScraper = {
  sourceSlug: "luckyscent",
  retailerSlug: "luckyscent",
  async *crawl() {
    const sitemaps = await fetchSitemapIndex();
    for (const sitemap of sitemaps) {
      const urls = await fetchProductUrls(sitemap);
      for (const url of urls) {
        try {
          const scraped = await scrapeProductPage(url);
          if (scraped) yield scraped;
        } catch {
          // skip individual product failures; runner also catches.
        }
      }
    }
  },
};
