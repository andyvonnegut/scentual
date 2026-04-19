import type { ScrapedVariant } from "./types";

// Matches the words retailers actually use in `product_type` / title for
// multi-piece boxed products rather than individual fragrances. Deliberately
// word-bounded so "Kitchen" doesn't trip "kit" and "Bundle of Joy" doesn't
// match a perfume called "Joy". Whole-word `kit` is fine — no real fragrance
// is literally titled "Kit".
const SET_KEYWORDS =
  /\b(gift\s*set|discovery\s*(?:kit|set)|sample\s*(?:set|pack)|sampler|bundle|collection\s+set|gift\s+with\s+purchase|gwp|coffret|kit)\b/i;

// "10-piece", "6 piece", "10 × piece" — a reliable set tell in titles.
const PIECE_COUNT = /\b\d+\s*[-–x×]?\s*piece\b/i;

// "6x 2ml", "10 x 2ml", "5×5ml", "3 x 30ml" — multi-vial variant sizing,
// never a real single-bottle size.
const MULTI_VIAL_SIZE = /\b\d+\s*[x×]\s*\d+(?:\.\d+)?\s*ml\b/i;

// Plain "75ml", "3.4oz", "1.5ml Spray Sample" — a buyable single-bottle
// (or single-vial) size *not* preceded by a NxN multiplier. If a product
// has any such variant, it's sold as an individual fragrance even when it
// also offers a sampler multipack.
const SINGLE_BOTTLE_SIZE = /\b\d+(?:\.\d+)?\s*(?:ml|oz)\b/i;

// LuckyScent has a dedicated storefront vendor for promo items. By definition
// nothing under that vendor is a real perfume. Same for gift-card vendors.
const NON_PERFUME_VENDOR = /gifts?\s*with\s*purchase|gwp|gift\s*certificates?/i;

// Gift cards, e-certificates, gift wrapping — not fragrances, and they come
// through the same Shopify product feed as everything else.
const NON_PERFUME_KEYWORDS =
  /\bgift\s*(?:card|wrap|wrapping|certificate)s?\b|\be[-\s]?certificates?\b/i;

export interface SetDetectorInput {
  productType?: string | null;
  title: string;
  vendor?: string | null;
  variants?: ScrapedVariant[];
}

function isSingleBottleVariant(sizeLabel: string): boolean {
  // Strip out the multi-vial fragments first so "10x 1.5ml Sample Bundle | ..."
  // doesn't get credited as a single-bottle via its nested 1.5ml.
  const withoutMulti = sizeLabel.replace(MULTI_VIAL_SIZE, "");
  if (SET_KEYWORDS.test(withoutMulti)) return false;
  return SINGLE_BOTTLE_SIZE.test(withoutMulti);
}

export function isSetOrKit(input: SetDetectorInput): boolean {
  const { productType, title, vendor, variants } = input;

  if (productType && SET_KEYWORDS.test(productType)) return true;
  if (productType && NON_PERFUME_KEYWORDS.test(productType)) return true;
  if (vendor && NON_PERFUME_VENDOR.test(vendor)) return true;
  if (SET_KEYWORDS.test(title)) return true;
  if (NON_PERFUME_KEYWORDS.test(title)) return true;
  if (PIECE_COUNT.test(title)) return true;

  if (variants?.length) {
    const hasSingleBottle = variants.some((v) => isSingleBottleVariant(v.sizeLabel));
    if (!hasSingleBottle) {
      for (const v of variants) {
        if (MULTI_VIAL_SIZE.test(v.sizeLabel)) return true;
        if (SET_KEYWORDS.test(v.sizeLabel)) return true;
      }
    }
  }

  return false;
}
