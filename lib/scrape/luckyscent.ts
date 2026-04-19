import type { ScrapedPerfume, ScrapedVariant, SourceScraper } from "./types";
import { extractNotesFromLuckyscentPageHtml } from "./notes.mjs";
import {
  normalizeStockStatus,
  parsePrice,
  parseSizeMl,
} from "./normalize";

// LuckyScent runs Shopify Hydrogen (Oxygen). Their Storefront GraphQL is
// exposed unauthenticated at /api/2024-01/graphql.json, which beats parsing
// the SSR'd hydration blob or the HTML.
const ENDPOINT = "https://www.luckyscent.com/api/2024-01/graphql.json";
const UA = "scentual-archivist/0.1 (+personal archive)";
const PAGE_SIZE = 100;

const QUERY = /* GraphQL */ `
  query ProductsPage($cursor: String) {
    products(first: ${PAGE_SIZE}, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          handle
          vendor
          productType
          descriptionHtml
          tags
          variants(first: 50) {
            edges {
              node {
                id
                title
                sku
                availableForSale
                price { amount currencyCode }
                selectedOptions { name value }
              }
            }
          }
        }
      }
    }
  }
`;

type GqlVariant = {
  id: string;
  title: string;
  sku: string | null;
  availableForSale: boolean;
  price: { amount: string; currencyCode: string } | null;
  selectedOptions: { name: string; value: string }[];
};

type GqlProduct = {
  id: string;
  title: string;
  handle: string;
  vendor: string | null;
  productType: string | null;
  descriptionHtml: string | null;
  tags: string[];
  variants: { edges: { node: GqlVariant }[] };
};

type GqlResponse = {
  data?: {
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: { node: GqlProduct }[];
    };
  };
  errors?: { message: string }[];
};

async function fetchPage(cursor: string | null): Promise<GqlResponse> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": UA,
      Accept: "application/json",
    },
    body: JSON.stringify({ query: QUERY, variables: { cursor } }),
  });
  if (!res.ok) throw new Error(`LuckyScent GraphQL → ${res.status}`);
  return res.json() as Promise<GqlResponse>;
}

async function fetchProductNotes(handle: string): Promise<string[] | null> {
  const res = await fetch(`https://www.luckyscent.com/products/${handle}`, {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) return null;
  return extractNotesFromLuckyscentPageHtml(await res.text());
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index++;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function pickSizeLabel(v: GqlVariant): string {
  const size = v.selectedOptions.find(
    (o) => o.name.toLowerCase() === "size",
  );
  return size?.value ?? v.title ?? "default";
}

async function toScraped(p: GqlProduct): Promise<ScrapedPerfume | null> {
  if (!p.vendor || !p.title) return null;

  // Skip LuckyScent's placeholder/duplicate products. These share Shopify
  // product ids with real listings but have junk metadata — vendor set to
  // "Marketing", an empty descriptionHtml, and a 404ing public URL. Real
  // perfume pages always have vendor = the brand name and non-empty copy.
  if (p.vendor.trim().toLowerCase() === "marketing") return null;
  if (!p.descriptionHtml || p.descriptionHtml.trim() === "") return null;

  const variants: ScrapedVariant[] = p.variants.edges.map(({ node: v }) => {
    const sizeLabel = pickSizeLabel(v);
    return {
      sizeLabel,
      sizeValueMl: parseSizeMl(sizeLabel),
      currentPrice: parsePrice(v.price?.amount ?? null),
      currency: v.price?.currencyCode ?? "USD",
      currentStockStatus: normalizeStockStatus({
        available: v.availableForSale,
      }),
      currentStockRaw: v.availableForSale ? "available" : "sold out",
    };
  });

  if (variants.length === 0) return null;

  const notes = await fetchProductNotes(p.handle);

  return {
    manufacturerName: p.vendor.trim(),
    name: p.title.trim(),
    sourceUrl: `https://www.luckyscent.com/products/${p.handle}`,
    sourceProductId: p.id,
    sourceTitle: p.title,
    sourceDescription: p.descriptionHtml,
    notes,
    variants,
  };
}

export const luckyscentScraper: SourceScraper = {
  sourceSlug: "luckyscent",
  retailerSlug: "luckyscent",
  async *crawl() {
    let cursor: string | null = null;
    for (let page = 0; page < 500; page++) {
      const res = await fetchPage(cursor);
      if (res.errors?.length) {
        throw new Error(
          `LuckyScent GraphQL errors: ${res.errors.map((e) => e.message).join("; ")}`,
        );
      }
      const block = res.data?.products;
      if (!block) return;
      const scrapedPage = await mapWithConcurrency(
        block.edges.map(({ node }) => node),
        8,
        toScraped,
      );
      for (const scraped of scrapedPage) {
        if (scraped) yield scraped;
      }
      if (!block.pageInfo.hasNextPage || !block.pageInfo.endCursor) return;
      cursor = block.pageInfo.endCursor;
    }
  },
};
