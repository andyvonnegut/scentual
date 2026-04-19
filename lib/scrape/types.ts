import type { StockStatus } from "@/lib/database.types";

export type { StockStatus };

export interface ScrapedVariant {
  sizeLabel: string;
  sizeValueMl: number | null;
  currentPrice: number | null;
  currency: string;
  currentStockStatus: StockStatus;
  currentStockRaw: string | null;
}

export interface ScrapedPerfume {
  manufacturerName: string;
  name: string;
  sourceUrl: string;
  sourceProductId: string | null;
  sourceTitle: string;
  sourceDescription: string | null;
  notes: string[];
  variants: ScrapedVariant[];
}

export interface SourceScraper {
  sourceSlug: string;
  retailerSlug: string;
  crawl(): AsyncIterable<ScrapedPerfume>;
}
