import * as cheerio from "cheerio";
import type { ScrapedPerfume, ScrapedVariant, SourceScraper } from "./types";
import {
  normalizeStockStatus,
  parsePrice,
  parseSizeMl,
} from "./normalize";

const BASE = "https://ministryofscent.com";
const PAGE_LIMIT = 250; // Shopify's max per page.

type ShopifyVariant = {
  id: number;
  title: string;
  sku: string | null;
  price: string;
  available: boolean;
  option1: string | null;
  option2: string | null;
  option3: string | null;
};

type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  body_html: string | null;
  tags: string[];
  variants: ShopifyVariant[];
};

type ProductsResponse = { products: ShopifyProduct[] };

async function fetchPage(page: number): Promise<ShopifyProduct[]> {
  const url = `${BASE}/products.json?limit=${PAGE_LIMIT}&page=${page}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "scentual-archivist/0.1 (+personal archive)" },
  });
  if (!res.ok) {
    throw new Error(`MoS products.json page=${page} → ${res.status}`);
  }
  const body = (await res.json()) as ProductsResponse;
  return body.products ?? [];
}

function extractNotesFromBody(html: string | null): string[] {
  if (!html) return [];
  const $ = cheerio.load(html);
  const text = $.root().text();

  // Look for a "Notes:" label followed by a comma/slash separated list.
  const labeled = text.match(
    /notes?\s*(?:[:\-–—])\s*([^\n\r.]+?)(?=\n|\.|$)/i,
  );
  if (labeled) {
    return labeled[1]
      .split(/[,\/]| and | & /i)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => s.length > 1 && s.length < 60);
  }

  // Fallback: list-style notes in ul/li.
  const fromList = $("ul li")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((s) => s.length > 1 && s.length < 60);
  if (fromList.length > 0 && fromList.length <= 20) return fromList;

  return [];
}

function toScraped(p: ShopifyProduct): ScrapedPerfume | null {
  if (!p.vendor || !p.title) return null;

  const variants: ScrapedVariant[] = p.variants.map((v) => {
    const sizeLabel = v.option1 ?? v.title ?? "default";
    return {
      sizeLabel,
      sizeValueMl: parseSizeMl(sizeLabel),
      currentPrice: parsePrice(v.price),
      currency: "USD",
      currentStockStatus: normalizeStockStatus({ available: v.available }),
      currentStockRaw: v.available ? "available" : "sold out",
    };
  });

  return {
    manufacturerName: p.vendor.trim(),
    name: p.title.trim(),
    sourceUrl: `${BASE}/products/${p.handle}`,
    sourceProductId: String(p.id),
    sourceTitle: p.title,
    sourceDescription: p.body_html,
    notes: extractNotesFromBody(p.body_html),
    variants,
  };
}

export const ministryofscentScraper: SourceScraper = {
  sourceSlug: "ministryofscent",
  retailerSlug: "ministryofscent",
  async *crawl() {
    for (let page = 1; page <= 200; page++) {
      const products = await fetchPage(page);
      if (products.length === 0) return;
      for (const p of products) {
        const scraped = toScraped(p);
        if (scraped) yield scraped;
      }
      if (products.length < PAGE_LIMIT) return;
    }
  },
};
