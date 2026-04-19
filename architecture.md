# Scentual — Architecture

> Keep this file in sync with the code. Any change to routes, schema, components, scrapers, actions, or design tokens should be reflected here in the same PR. See `AGENTS.md`.

## What it is

Scentual is a single-user private perfume library + journal. It maintains a canonical perfume database ingested from retailer sites (Ministry of Scent, LuckyScent) via daily scrapers, records price & stock history transactionally, and lets the user organize saved perfumes in Collection / Wanted states with personal tags and perfume-linked journal entries. There is no auth — reads are public (Supabase RLS), writes happen server-side via the service role.

Stack: Next.js 16 App Router (React 19), Supabase (Postgres + SSR client), Tailwind 4, Vercel (Fluid Compute + Cron), TypeScript.

Deployment workflow: changes are expected to ship through a Preview deployment first, then to `main` for production at `https://scentual.vercel.app/`. By default, a request is not complete until the change is committed, the Preview deploy is verified, `main` is updated, and production is verified.

---

## Top-level layout

```
app/                      # Next.js App Router
components/brand/         # Shared design-system primitives
lib/
  supabase/               # Client/server/service factories + generated types
  queries/                # Read-only server queries
  scrape/                 # Scraper interfaces, source adapters, ingestion, runner
supabase/                 # SQL migrations
public/                   # Static assets
scentual_prd.md           # Product spec (source of truth for product intent)
vercel.json               # Cron schedule
```

---

## Routes (what each page shows)

All main pages live in the `(shell)` route group, which provides a sticky header (Scentual wordmark + Home / Browse / Library / Journal) and a footer.

### `/` — Home (`app/(shell)/page.tsx`)
Two rails: **Recently added** and **Recently updated** (6 perfumes each). Empty-state hints at running the Ministry of Scent ingest. Data: `getRecentPerfumes`, `getRecentlyUpdatedPerfumes` run in parallel.

### `/browse` — Catalog (`app/(shell)/browse/page.tsx`)
Server-rendered search. GET form with three filters: `q` (name ilike), `manufacturer` (slug), `note` (slug). Up to 120 results. Each card shows perfume name, house link, and up to 6 store notes as `store` chips. Data: `searchPerfumes`, plus `getAllManufacturers` / `getAllNotes` for the filter dropdowns. `getAllNotes` paginates the full canonical note vocabulary instead of relying on Supabase's default 1,000-row page.

### `/browse/manufacturers/[slug]` — House page
All perfumes from one manufacturer. Data: `getManufacturerBySlug` → `getPerfumesByManufacturer`.

### `/perfumes/[manufacturer]/[slug]` — Perfume detail
Two-column layout (1.1fr / 1fr on `md`+):
- **Left:** big serif name, house link, `SaveControls`, personal tags (if saved), canonical notes, store-notes, source descriptions.
- **Right (Card):** **Availability** — each active listing with its variants, current price (Intl.NumberFormat), size, stock-status chip, inactive badge. Below the aside: **Recent price & stock changes** — a single consolidated Card with one time-sorted table (newest 20 rows) merging both price and stock changes across all variants; each row shows date, a retailer chip (`variant="store"`), a type chip (`"fragrance-note"` for price, `"theme"` for stock), size · change_type, and the formatted value. Below that: **Journal** section (inline "add entry" form + existing entries for this perfume).

Data: `getPerfumeByManufacturerAndSlug` returns the full tree (manufacturer, perfume_notes, perfume_listings → retailer + variants, journal_entries, personal_perfumes). Then `getPriceHistory(variantId)` / `getStockHistory(variantId)` are fanned out in parallel for every variant.

### `/library` — Personal library
Filter pills: **All Saved** (default) / **Collection** / **Wanted** / **Both** via `?filter=`. Top card is `AddPerfumeSearch` (typeahead into `/api/catalog/search`, two buttons per hit to add to Collection or Wanted). Grid of `SavedCard`s (perfume, house, Collection/Wanted chips, size_owned, personal note, store notes, fragrance-note & theme tags, compact `SaveControls`). Data: `getSavedPerfumes(filter)`.

### `/journal` — Journal list
Reverse-chronological by `entry_date`, then `created_at`. Each entry: formatted date, linked perfume, optional title, body. "+ New entry" link. Supports `?perfume=<id>` to filter to one perfume. Data: `listJournalEntries`.

### `/journal/new` — New entry
Form: `PerfumePicker` (single async-search combobox → `/api/catalog/search`, matches on perfume or house name, emits hidden `perfume_id` after selection), `entry_date` (default today), optional title, required body. Submits to the `createJournalEntry` server action, then redirects to `redirect_to` (or `/journal`).

---

## Server actions (`app/actions/*`)

Every action calls `createServiceClient()` (service-role key, bypasses RLS) and ends with `revalidatePath("/", "layout")` so any server-rendered page picks up the change.

### `library.ts`
- `toggleCollection(perfumeId, next)` — upserts `personal_perfumes`, flips `in_collection`, stamps `added_to_collection_at`, deletes the row if both flags become false.
- `toggleWanted(perfumeId, next)` — same for `in_wanted`.
- `updatePersonalMeta(perfumeId, { size_owned_text?, personal_note? })`.

### `tags.ts`
- `createFragranceNoteTag(name)` / `createThemeTag(name)` — slugifies and upserts on `slug` (idempotent).
- `addFragranceNoteTagByName(personalPerfumeId, name)` / `addThemeTagByName(...)` — create-if-missing, then upsert the join row.
- `detachFragranceNoteTag` / `detachThemeTag` — delete join rows.

### `journal.ts`
- `createJournalEntry(formData)` — reads `perfume_id`, optional `title`, required `body`, `entry_date`. Inserts, revalidates `/journal`, redirects.
- `updateJournalEntry(formData)` / `deleteJournalEntry(id)`.

---

## API routes (`app/api/*`)

### `GET /api/cron/scrape/[source]` — daily ingest
- Runtime `nodejs`, `maxDuration = 300`.
- Requires `Authorization: Bearer $CRON_SECRET`.
- `[source]` ∈ `ministryofscent | luckyscent`.
- Delegates to `runScrape(source, "daily")` in `lib/scrape/runner.ts`.
- Returns `{ runId, counts, staleDeactivated, status, error? }`.

### `GET /api/dev/scrape/[source]` — same, no auth
Manual trigger for dev; do not expose in prod without gating.

### `GET /api/catalog/search?q=...` — catalog typeahead
Returns up to 25 `{ id, name, slug, manufacturer: { id, name, slug } }` whose perfume name OR manufacturer name matches `q` (case-insensitive substring). Consumed by `AddPerfumeSearch` (library) and `PerfumePicker` (journal).

---

## Data layer (`lib/`)

### Supabase clients
- `lib/supabase/client.ts` — browser SSR client (anon key). Minimal current use.
- `lib/supabase/server.ts` — server client with cookie handling, used by all `lib/queries/*`.
- `lib/supabase/service.ts` — service-role client (no session, no cookies). Used only by server actions and the scraper.
- `lib/supabase/database.types.ts` — generated types from the Supabase schema.
- `lib/supabase/utils.ts` — `cn()` (clsx + tailwind-merge).

### Queries (`lib/queries/`)
Read-only, server-only. Grouped by domain:
- **`perfumes.ts`**: `getRecentPerfumes`, `getRecentlyUpdatedPerfumes`, `searchPerfumes`, `searchCatalog`, `getAllManufacturers`, `getAllNotes`, `getPerfumeByManufacturerAndSlug`, `getPriceHistory`, `getStockHistory`, `getManufacturerBySlug`, `getPerfumesByManufacturer`.
- **`library.ts`**: `LibraryFilter` type; `getSavedPerfumes(filter)`, `getPersonalPerfumeByPerfumeId`, `getAllFragranceNoteTags`, `getAllThemeTags`.
- **`journal.ts`**: `listJournalEntries(perfumeId?)`, `listJournalEntriesForPerfume`.

### Data flow

**Reads:** server component → `lib/queries/*` → server Supabase client (anon, RLS-gated, cookie-aware) → rendered HTML.

**Writes:** client component → server action → service client (service role, RLS bypassed) → `revalidatePath("/", "layout")` → affected server pages re-render on next request. Client components use `useTransition` for optimistic UI.

**Ingest:** Vercel Cron → `/api/cron/scrape/[source]` → `runScrape` → scraper `crawl()` async iterable → `ingestOne` per item (upserts + history rows + listing-level note sync) → `markStaleListingsInactive` → `rebuildCanonicalNotes` → write `scrape_runs` row.

---

## Scraper system (`lib/scrape/`)

### Types (`types.ts`)
- `ScrapedVariant { sizeLabel, sizeValueMl, currentPrice, currency, currentStockStatus, currentStockRaw }`
- `ScrapedPerfume { manufacturerName, name, sourceUrl, sourceProductId, sourceTitle, sourceDescription, notes[] | null, variants[] }`
- `SourceScraper { sourceSlug, retailerSlug, crawl(): AsyncIterable<ScrapedPerfume> }`

### Normalization (`normalize.ts`)
- `slugify` — NFD + strip accents, lowercase, alphanumeric + hyphen, 120 char cap.
- `parsePrice` — strips non-digits/dots.
- `parseSizeMl` — matches `ml` directly or converts from `oz` (×29.5735).
- `normalizeStockStatus` — enum map from raw string + availability boolean to `in_stock | out_of_stock | low_stock | unavailable | unknown`.

### Note extraction + mirror rebuild
- **`notes.mjs`** — shared note extraction + cleanup helpers. Minimal cleanup only: trim punctuation, collapse whitespace, lowercase for storage, preserve source phrases otherwise.
- **`note-sync.mjs`** — exact listing-level note sync (`perfume_source_notes`) plus canonical note rebuild across active listings. Rebuild deletes stale inactive listing note rows, repopulates `source_notes` and `perfume_notes`, then prunes unused rows from `notes`.

### Source adapters
- **`ministryofscent.ts`** — Shopify REST `/products.json?limit=250&page=N`. Parses the explicit labeled notes block from `body_html`.
- **`luckyscent.ts`** — Shopify Hydrogen Storefront GraphQL (`/api/2024-01/graphql.json`), cursor-pagination at 100/page, plus bounded-concurrency product-page fetches to parse the rendered `Fragrance Notes` list. Size comes from variant `selectedOptions` where `name.toLowerCase() === "size"`. Placeholder products (vendor = `Marketing` or empty `descriptionHtml`) are dropped — LuckyScent exposes these in GraphQL but their public URLs 404.

### Ingestion (`ingest.ts`)
`ingestOne(ctx, scraped, counts)` steps:
1. Upsert manufacturer on `slug`.
2. Upsert perfume on `(manufacturer_id, slug)`.
3. Upsert listing preferring the stable `(retailer_id, source_product_id)` pair, falling back to `(retailer_id, source_url)` when no product id is available. On match, refresh `source_url` so upstream handle changes self-heal. Bump `last_seen_at`, `last_scraped_at`.
4. For each variant: upsert `listing_variants` on `(listing_id, size_label)`; if price differs, insert a `listing_price_history` row (`initial` / `increase` / `decrease`); if stock differs, insert `listing_stock_history` (`initial` / `changed`).
5. If `scraped.notes !== null`, exactly sync `perfume_source_notes` for that listing to the cleaned note set parsed from the product page.
6. Track `listing_id` in `seenListingIds`.

`markStaleListingsInactive(db, retailerId, runStartTime)` sets `active = false` on retailer listings whose `last_seen_at < runStartTime`.

### Runner (`runner.ts`)
`runScrape(sourceSlug, runType)` creates a `scrape_runs` row (`status='running'`), loops `scraper.crawl()` calling `ingestOne`, runs stale deactivation, rebuilds canonical note tables, then finalizes the run row with counts and `succeeded`/`failed` + `error_summary`.

### Backfill
- **`scripts/backfill-notes.mjs`** — one-off repair script for exact canonical-note mirroring. Reads active listings from Supabase, parses notes from stored Ministry of Scent HTML or live LuckyScent product pages, syncs listing note rows, then runs `rebuildCanonicalNotes`. Optional scope: `--retailer=ministryofscent|luckyscent`.

### Cron schedule (`vercel.json`)
- `ministryofscent` — `17 3 * * *` (03:17 UTC)
- `luckyscent` — `17 4 * * *` (04:17 UTC)

---

## Supabase schema

### Catalog
- **`manufacturers`** — `id, name, slug UNIQUE, created_at, updated_at`.
- **`perfumes`** — `id, manufacturer_id→, name, slug, canonical_description?`. `UNIQUE(manufacturer_id, slug)`. Indexed on `manufacturer_id`, `created_at desc`, `updated_at desc`.
- **`retailers`** — `id, name, slug UNIQUE, base_url`.

### Listings & variants
- **`perfume_listings`** — `id, perfume_id→ ON DELETE CASCADE, retailer_id→ ON DELETE RESTRICT, source_url, source_product_id?, source_title, source_description?, active, first_seen_at, last_seen_at, last_scraped_at`. `UNIQUE(retailer_id, source_url)` plus a partial unique index on `(retailer_id, source_product_id) where source_product_id is not null`.
- **`listing_variants`** — `id, perfume_listing_id→ CASCADE, size_label, size_value_ml?, current_price?, currency='USD', current_stock_status (enum), current_stock_raw?`. `UNIQUE(perfume_listing_id, size_label)`.

### History (append-only)
- **`listing_price_history`** — `id, listing_variant_id→ CASCADE, price, currency, observed_at, change_type ('initial'|'increase'|'decrease')`. Index `(listing_variant_id, observed_at desc)`.
- **`listing_stock_history`** — `id, listing_variant_id→ CASCADE, stock_status, stock_raw?, observed_at, change_type ('initial'|'changed')`. Index `(listing_variant_id, observed_at desc)`.

### Notes (canonical + source-raw)
- **`notes`** — canonical store-note vocabulary mirrored from the current active listing note text: `id, name, slug UNIQUE, note_family?`.
- **`source_notes`** — retailer-level unique active note phrases: `id, retailer_id→, raw_note_name, normalized_note_id?→notes`. `UNIQUE(retailer_id, raw_note_name)`.
- **`perfume_notes`** — perfume-level union of active listing notes: `id, perfume_id→ CASCADE, note_id→ CASCADE`. `UNIQUE(perfume_id, note_id)`.
- **`perfume_source_notes`** — per-listing raw note capture, kept in exact sync with the current parsed note set for active listings. `UNIQUE(perfume_listing_id, raw_note_text)`.

### Personal library
- **`personal_perfumes`** — `id, perfume_id UNIQUE→ CASCADE, in_collection, in_wanted, size_owned_text?, personal_note?, added_to_collection_at?, added_to_wanted_at?, updated_at`. CHECK `(in_collection OR in_wanted)`. Partial indexes on each flag.
- **`user_fragrance_note_tags`** — `id, name, slug UNIQUE`. User-curated fragrance-note tag vocabulary.
- **`theme_tags`** (renamed from `generic_tags`) — `id, name, slug UNIQUE`. Theme / mood / occasion tags.
- **`personal_perfume_user_fragrance_note_tags`** — join, `UNIQUE(personal_perfume_id, user_fragrance_note_tag_id)`.
- **`personal_perfume_theme_tags`** (renamed from `personal_perfume_generic_tags`) — join, `UNIQUE(personal_perfume_id, theme_tag_id)`.

### Journal
- **`journal_entries`** — `id, perfume_id→ CASCADE, title?, body, entry_date DEFAULT current_date`. Indexes `(perfume_id, entry_date desc)`, `(entry_date desc)`.

### Ops
- **`scrape_runs`** — `id, source_name, run_type ('initial'|'daily'), status ('running'|'succeeded'|'failed'), started_at, finished_at, records_seen, records_created, records_updated, error_summary?`. Index `(source_name, started_at desc)`.

### RLS / auth model
Single-user, no login. Every table has RLS enabled and one policy: `SELECT` for `anon, authenticated`. No insert/update/delete policies exist — writes happen only through the service-role client. A shared `touch_updated_at()` trigger bumps `updated_at` on updates.

---

## Components (`components/brand/`)

Small hand-rolled design system. No shadcn, no headless-ui.
- **`Button.tsx`** — CVA. Variants: `primary | secondary | ghost`. Sizes: `sm | md | lg`.
- **`Card.tsx`** — rounded, `bg-elevated`, soft shadow on hover.
- **`Chip.tsx`** — CVA. Variants: `store` (read-only store notes), `fragrance-note` (accent-toned, for fragrance notes), `theme` (neutral, for theme tags). Sizes: `sm | md`.
- **`SaveControls.tsx`** — *client.* Two toggle buttons (Collection / Wanted) with `useTransition`. `compact` variant for `SavedCard`.
- **`TagTypeahead.tsx`** — *client.* Input + datalist of unattached tags; attached tags render as removable pills. Variant prop: `fragrance-note | theme`.
- **`PageShell.tsx`** — max-width 1240px wrapper.
- **`SectionHeader.tsx`** — micro-label + `font-display` heading + optional description/children.

Page-scoped components live under `app/(shell)/<route>/_components/`:
- `library/_components/AddPerfumeSearch.tsx` — client, typeahead → `/api/catalog/search`, one-click add to Collection / Wanted.
- `library/_components/SavedCard.tsx` — server, composes `Card` + `Chip` + compact `SaveControls`.
- `journal/new/_components/PerfumePicker.tsx` — client, async-search combobox → `/api/catalog/search` (matches perfume or house), keyboard-navigable results list, selected-chip UI, hidden `perfume_id`.
- `perfumes/[manufacturer]/[slug]/_components/JournalSection.tsx` — server, inline new-entry form (pre-filled `perfume_id`, `entry_date`, `redirect_to`) + list of existing entries.

---

## Design system

Defined as CSS custom properties (globals) consumed by Tailwind utilities and CVA variants.

**Palette**
- `--bg` `#fcf7f8` · `--bg-elevated` `#fffafb`
- `--surface` `#f6e3e8` · `--surface-2` `#f1d7df`
- `--text` `#2b1f26` · `--text-soft` `#7c6a73`
- `--accent` `#d95c8a` · `--accent-strong` `#bb3f70`
- `--line` `rgba(43,31,38,0.12)`
- `--success` `#87a17a` · `--warning` `#c88a6c`

**Type**
- Display: **Fraunces** (serif) — perfume names, section headings
- UI: **Inter** (sans) — body, controls
- Micro-label: 11px / 0.14em / uppercase / `text-soft`

**Scale** — spacing `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`. Radius `sm 10 / md 16 / lg 24 / pill 999`. Shadow: `--shadow-soft 0 6px 24px rgba(43,31,38,0.06)`.

**Feel** — pink-forward, editorial, quiet-luxury. Generous whitespace. Minimal elevation. `160ms–220ms ease` transitions. Max content width 1240px.

---

## Config

- **`package.json`** — Next 16.2.4, React 19.2.4, `@supabase/ssr` + `@supabase/supabase-js`, `cheerio`, `date-fns`, `zod`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, Tailwind 4, TS 5, ESLint 9. Scripts: `dev`, `build`, `start`, `lint`.
- **`next.config.ts`** — defaults.
- **`tsconfig.json`** — strict, ES2017 target, path alias `@/*` → repo root.
- **`vercel.json`** — cron entries for both scrapers.
- **Env** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`.

---

## Conventions / invariants worth knowing

- Perfume identity is `(manufacturer.slug, perfume.slug)`. Both are produced by `slugify` — change that function carefully.
- Listing identity prefers `(retailer_id, source_product_id)` when present and falls back to `(retailer_id, source_url)`. Variants are `(listing_id, size_label)`.
- Price/stock history is append-only. Never update rows in `listing_price_history` / `listing_stock_history`.
- A `personal_perfumes` row must have `in_collection OR in_wanted`. Toggling both off deletes the row (and by cascade, its tag joins).
- Store notes (scraper output) are distinct from personal fragrance-note tags; they live in different tables and render as different Chip variants.
- Canonical store notes are an exact mirror of explicit note blocks on active product pages. If a note disappears from every active listing, the rebuild prunes it from `notes`, `source_notes`, and `perfume_notes`.
- All mutations revalidate at `("/", "layout")`. If you add a mutation, call it.
- The service role key must never be imported into a client component. Only `lib/supabase/service.ts` reads it, and only server actions / API routes / the scraper import from there.
