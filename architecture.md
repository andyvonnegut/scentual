# Scentual — Architecture

> Keep this file in sync with the code. Any change to routes, schema, components, scrapers, actions, or design tokens should be reflected here in the same PR. See `AGENTS.md`.

## What it is

Scentual is a multi-user private perfume library + journal. It maintains a canonical perfume database ingested from retailer sites (Ministry of Scent, LuckyScent) via daily scrapers, records price & stock history transactionally, and lets each user organize their own saved perfumes in Collection / Wanted states with personal tags and perfume-linked journal entries. Auth is Google-only via native Supabase Auth. Catalog browsing (home, browse, manufacturer + perfume detail) is public; personal data (collection, ratings, journal, tags, profile) is gated and scoped to the signed-in user via RLS on `user_id = auth.uid()`. Scraper and cron writes still bypass RLS via the service-role client.

Stack: Next.js 16 App Router (React 19), Supabase (Postgres + SSR client), Tailwind 4, Vercel (Fluid Compute + Cron), TypeScript.

Deployment workflow: changes ship directly on `main` to production at `https://scentual.vercel.app/`. By default, a request is not complete until the change is committed to `main`, pushed, and production is updated.

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

All main pages live in the `(shell)` route group, which provides a sticky header (Scentual wordmark + Home / Browse / Collection / Journal + `HeaderAuth`) and a footer. The top-right nav renders as plain text links; the active section is indicated by a bolder weight and the `accent-strong` color. Perfume detail pages map to **Browse**, and `/journal/new` maps to **Journal**. `HeaderAuth` (`components/brand/HeaderAuth.tsx`) shows a "Sign in" link when anonymous and the user's display_name + avatar (linking to `/profile`) plus a "Sign out" POST form when signed in.

Auth routes live outside the shell: `/auth/signin`, `/auth/callback`, `/auth/signout`. Personal routes (`/collection`, `/journal`, `/journal/new`, `/profile`) call `requireUser(nextPath)` from `lib/auth.ts` at the top of the server component and redirect anonymous visitors to `/auth/signin?next=...`.

### `/` — Home (`app/(shell)/page.tsx`)
Two rails: **Recently added** and **Recently updated** (6 perfumes each). Empty-state hints at running the Ministry of Scent ingest. Data: `getRecentPerfumes`, `getRecentlyUpdatedPerfumes` run in parallel.

### `/browse` — Catalog (`app/(shell)/browse/page.tsx`)
Server-rendered shell plus a live client filter controller. Header shows only **The catalog** with result-count copy, with no micro-label above it. Controls update in real time with no submit button:
- a single search line (`q`) that tokenizes whitespace and requires every typed word to match somewhere across perfume name, manufacturer name, canonical notes attached by the store, or canonical notes attached by the user
- a single-select house combobox (`manufacturer=<slug>`)
- a mixed-mode notes picker:
  - explicit dropdown picks create exact canonical-note chips via repeated `note=<slug>` params
  - pressing `Enter` on typed text first resolves a case-insensitive exact note-name match, then falls back to the first filtered suggestion, and only creates a broad note-word chip via repeated `note_q=<text>` params when there are no matching suggestions at all
  - all selected note chips are ANDed, so every exact or broad note filter must match either a store note or a personal note attachment

The client updates the current URL with `window.history.replaceState`, listens to live `searchParams` changes, and fetches fresh results from `GET /api/catalog/browse`. The page still hydrates from the URL on first load/refresh, and browser Back/Forward is expected to restore the current query string plus the visible filter UI from those params. Up to 120 cards are rendered, with exact total counts shown when more matches exist. Each card shows perfume name, house link, and up to 6 canonical store notes as `store` chips. Data: `browsePerfumes`, `getAllManufacturers`, and `getAllNotes`. `getAllNotes` paginates the full canonical note vocabulary instead of relying on Supabase's default 1,000-row page.

### `/browse/manufacturers/[slug]` — House page
All perfumes from one manufacturer. Data: `getManufacturerBySlug` → `getPerfumesByManufacturer`.

### `/perfumes/[manufacturer]/[slug]` — Perfume detail
Two-column layout (1.1fr / 1fr on `md`+):
- **Left:** big serif name with a clickable favorite star immediately to its right, house link (sized `text-sm` uppercase label), `SaveControls`, `RatingsControlGroup` (three independent 1..5 personal scales shown in the order Overall, Projection, Design; Projection uses the old atomizer glyph, Overall uses hearts, Design uses a traditional eau de parfum bottle), personal tags (always shown — `Your notes` and `Themes`, attachable even when the perfume isn't in Collection or Wanted), a separate read-only `Store notes` section, a tabbed source-descriptions section (`SourceDescriptionTabs` — one tab per retailer; selecting a tab reveals only that retailer's `source_description`, so multi-source perfumes don't stack prose blocks). No "open source" link here — it's on the availability row instead.
- **Right aside (stacked):**
  - **Availability** (Card) — each active listing with its variants, current price (Intl.NumberFormat), size, stock-status chip, inactive badge. The retailer name is itself the "open source" link (`↗`).
  - **Journal** — "+ New journal entry" button that toggles an inline form (client component `NewJournalEntry`), followed by a **Past entries** list. Each past entry renders as its own bordered card with a left accent border to distinguish it from the new-entry affordance.
- **Below the two columns:** **Recent price & stock changes** — a single consolidated full-width Card with one time-sorted table (newest 20 rows) merging both price and stock changes across all variants. Per-SKU price and stock events within a 5s window are merged into one row; each row has four columns — date, retailer chip (`variant="store"`) + size, price (with change_type suffix unless `initial`), and stock status (em-dash when that side didn't change).

Data: `getPerfumeByManufacturerAndSlug` returns the public perfume tree (manufacturer, perfume_notes, perfume_listings → retailer + variants). User-scoped pieces (`personal_perfumes`, `journal_entries`) are fetched separately via `getPersonalPerfumeByPerfumeId` and `listJournalEntriesForPerfume`, both of which filter by `user_id = auth.uid()` and return `null`/`[]` for anonymous visitors. Then `getPriceHistory(variantId)` / `getStockHistory(variantId)` are fanned out in parallel for every variant.

When a user is not signed in, the page renders the catalog data plus a "Sign in to save, rate, and journal" CTA in place of the favorite star, `SaveControls`, `RatingsControlGroup`, `TagTypeahead`, and `JournalSection`.

### `/collection` — Collection
Saved-perfumes page renamed from Library to Collection. Header shows only **Collection** with the perfume count, with no micro-label above it. Filter pills: **All Saved** (default) / **Collection** / **Wanted** / **Both** via `?filter=`. Top card is `AddPerfumeSearch` (typeahead into `/api/catalog/search`, two buttons per hit to add to Collection or Wanted). Grid of `SavedCard`s (perfume, house, favorite star beside the perfume name, Collection/Wanted chips, size_owned, personal note, store notes, personal-note chips, theme tags, compact three-row `RatingsControlGroup` with inline right-side labels only, compact `SaveControls`). Data: `getSavedPerfumes(filter)`.

### `/journal` — Journal list
Reverse-chronological by `entry_date`, then `created_at`. Header shows only **Curated scentual memories...** with the entry count and "+ New entry" link, with no micro-label above it. Each entry renders as an editable card with formatted date, linked perfume, optional title, body, and inline `Edit` / `Delete` controls. Delete requires an in-card confirmation step. Supports `?perfume=<id>` to filter to one perfume. Data: `listJournalEntries`.

### `/journal/new` — New entry
Form: `PerfumePicker` (single async-search combobox → `/api/catalog/search`, matches on perfume or house name, emits hidden `perfume_id` after selection), `entry_date` (default today), optional title, required body. Submits to the `createJournalEntry` server action, then redirects to `redirect_to` (or `/journal`).

### `/auth/signin` — Sign in (public)
Single "Continue with Google" button wired to `supabase.auth.signInWithOAuth({ provider: "google" })` with a `redirectTo` of `/auth/callback?next=<returnPath>`. Already-signed-in visitors are redirected to `next` (or `/`).

### `/auth/callback` — OAuth return (route handler)
`GET` exchanges the `code` query param for a session via `supabase.auth.exchangeCodeForSession`, then redirects to `next` (default `/`). Errors bounce back to `/auth/signin?error=...`.

### `/auth/signout` — Sign out (route handler)
`POST` calls `supabase.auth.signOut()` and redirects to `/` with 303.

### `/profile` — Profile (signed-in only)
Small form that edits `display_name` via the `updateDisplayName` server action. Shows the Google email read-only. `requireUser("/profile")` gates the page.

---

## Server actions (`app/actions/*`)

Write actions against user-scoped tables (`personal_perfumes`, `personal_perfume_notes`, `personal_perfume_theme_tags`, `journal_entries`, `profiles`) use the server SSR client (`lib/supabase/server.ts`) plus `requireUser()` from `lib/auth.ts`. The action stamps `user_id` from the session; RLS enforces `user_id = auth.uid()` on insert/update/delete. Catalog writes (new canonical `notes` / `theme_tags` entries) still use the service-role client because the vocabulary is shared across all users. Every action ends with `revalidatePath("/", "layout")` so server-rendered pages pick up changes.

### `library.ts`
- `toggleCollection(perfumeId, next)` — upserts `personal_perfumes`, flips `in_collection`, stamps `added_to_collection_at`. When both flags become false, deletes the row only if it carries no tags and no `size_owned_text` / `personal_note`; otherwise leaves a bare row so attached tags / notes survive.
- `toggleWanted(perfumeId, next)` — same for `in_wanted`.
- `toggleFavorite(perfumeId, next)` — upserts `personal_perfumes.favorite`. Creates a bare row if favoriting a perfume with no other personal state; deletes that bare row when unfavoriting would leave no collection/wanted flags, notes, tags, ratings, or other personal data behind.
- `updatePersonalMeta(perfumeId, { size_owned_text?, personal_note? })`.
- `setPersonalRating(perfumeId, scale, rating)` — upserts one of `personal_perfumes.projection_rating | overall_rating | design_rating` (`scale` is `"projection" | "overall" | "design"`; `rating` is a 1..5 integer or `null` to clear). Creates a bare row if none exists and `rating != null`; deletes the row when clearing the last remaining rating leaves no other personal data and both list flags are false.

### `tags.ts`
- `upsertCanonicalNote(name)` / `createThemeTag(name)` — slugifies and upserts on `slug` (idempotent) via the service client. Requires a signed-in user. Notes are written into the shared canonical `notes` table, not a user-only note vocabulary.
- `addPersonalNoteByName(perfumeId, name)` / `addThemeTagByName(...)` — create-if-missing the canonical note or theme tag, ensure a `personal_perfumes` row exists for `(user_id, perfume_id)` (inserts a bare row if not), then upsert the join row. Lets users attach a personal note without adding the perfume to Collection or Wanted.
- `detachPersonalNote(perfumeId, noteId)` / `detachThemeTag(...)` — look up the personal row by `(user_id, perfume_id)` and delete the join row (also filtered by `user_id`).

### `profile.ts`
- `updateDisplayName(formData)` — trims the `display_name` input, updates `profiles` where `id = auth.uid()`, revalidates the layout so the header picks up the new label.

### `journal.ts`
- `createJournalEntry(formData)` — reads `perfume_id`, optional `title`, required `body`, `entry_date`, optional `redirect_to`. Inserts, revalidates `/journal` plus the redirect target when provided, then redirects.
- `updateJournalEntry(formData)` — reads `id`, editable fields, optional `return_path`; updates and revalidates `/journal` plus the return path when provided.
- `deleteJournalEntry(formData)` — reads `id`, optional `return_path`; hard-deletes and revalidates `/journal` plus the return path when provided.

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

### `GET /api/catalog/browse?q=...&manufacturer=...&note=...` — live browse filters
Returns `{ total, results }` for the `/browse` live filter UI. `q` is whitespace-tokenized and each token must match somewhere across perfume name, manufacturer name, store-note attachments, and — when the request is authenticated — the caller's own personal-note attachments. `manufacturer` is an exact manufacturer slug filter. Repeated `note` params are exact-match AND filters on canonical note slugs. Repeated `note_q` params are broad note-word AND filters using case-insensitive `note.name contains <text>` semantics. For anonymous callers, personal-note branches are skipped so one user's personal notes cannot leak into another browser. Legacy `store:<slug>` / `user:<slug>` URLs are still parsed and normalized as exact-note filters.

### `GET /auth/callback`, `POST /auth/signout`
See the Routes section above.

---

## Data layer (`lib/`)

### Supabase clients
- `lib/supabase/client.ts` — browser SSR client (anon key). Used by the Google OAuth sign-in flow in `components/brand/SignInButton.tsx`.
- `lib/supabase/server.ts` — server client with cookie handling. Used by all `lib/queries/*` and by user-scoped server actions.
- `lib/supabase/service.ts` — service-role client (no session, no cookies). Used only by the scraper, cron handlers, and writes into shared catalog tables (canonical `notes`, `theme_tags`).
- `lib/supabase/database.types.ts` — generated types from the Supabase schema.
- `lib/supabase/utils.ts` — `cn()` (clsx + tailwind-merge).

### Auth helpers (`lib/auth.ts`)
- `getSessionUser()` — reads the session from cookies, fetches the matching `profiles` row, returns `{ id, email, avatarUrl, displayName }` or `null`. Avatars are not persisted; they are read from `user_metadata.avatar_url`/`picture` at request time.
- `requireUser(nextPath?)` — same as `getSessionUser` but `redirect('/auth/signin?next=...')` when there is no session.
- `middleware.ts` (repo root) refreshes the Supabase session cookie on every non-static request via `supabase.auth.getUser()`. The matcher excludes `_next/*`, common static file extensions, `favicon.ico`, and `/api/cron/*` (cron calls present `Authorization: Bearer $CRON_SECRET` and do not need a session).

### Queries (`lib/queries/`)
Read-only, server-only. Grouped by domain:
- **`perfumes.ts`**: `getRecentPerfumes`, `getRecentlyUpdatedPerfumes`, `browsePerfumes`, `searchCatalog`, `getAllManufacturers`, `getAllNotes`, `getPerfumeByManufacturerAndSlug`, `getPriceHistory`, `getStockHistory`, `getManufacturerBySlug`, `getPerfumesByManufacturer`.
- **`library.ts`**: `LibraryFilter` type; `getSavedPerfumes(filter)`, `getPersonalPerfumeByPerfumeId`, `getAllThemeTags`.
- **`journal.ts`**: `listJournalEntries(perfumeId?)`, `listJournalEntriesForPerfume`.

### Data flow

**Reads:** server component → `lib/queries/*` → server Supabase client (session-aware via cookies; RLS gates user-scoped tables to `user_id = auth.uid()`) → rendered HTML. User-scoped query helpers (`getSavedPerfumes`, `getPersonalPerfumeByPerfumeId`, `listJournalEntries*`) short-circuit to empty results when no session is present. `/browse` is mixed: the page does an initial server read from URL params (passing `user?.id`), then the client filter shell updates `window.history.replaceState`, observes `searchParams` for back/forward restoration, and fetches incremental result updates from `GET /api/catalog/browse`.

**Writes:** client component → server action → session server client → `revalidatePath("/", "layout")` → affected server pages re-render on next request. Actions call `requireUser()` and stamp `user_id` from the session; RLS blocks any attempt to write rows with a different `user_id`. Client components use `useTransition` for optimistic UI. Shared catalog inserts (new canonical notes / theme tags) still go through the service-role client.

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
- **`notes.mjs`** — shared note extraction + cleanup helpers. Notes are only accepted from explicit DOM-bound note sections; broad page-text fallback is intentionally disabled. Cleanup trims punctuation, preserves valid source phrases, rejects structural junk / marketing copy, avoids splitting commas inside parentheses, and treats a trailing `, and amber` like a normal comma delimiter so it stores `amber` instead of `and amber`.
- **`note-sync.mjs`** — exact listing-level note sync (`perfume_source_notes`) plus canonical note rebuild across active listings. Rebuild deletes stale inactive listing note rows, repopulates `source_notes` and `perfume_notes`, then prunes unused rows from `notes`.

### Source adapters
- **`ministryofscent.ts`** — Shopify REST `/products.json?limit=250&page=N`. Parses explicit labeled note blocks from `body_html` and stops at subsequent labeled sections such as `FYI`, so store copy does not bleed into note rows.
- **`luckyscent.ts`** — Shopify Hydrogen Storefront GraphQL (`/api/2024-01/graphql.json`), cursor-pagination at 100/page, plus bounded-concurrency product-page fetches to parse the rendered `Fragrance Notes` list. Size comes from variant `selectedOptions` where `name.toLowerCase() === "size"`. Placeholder products (vendor = `Marketing` or empty `descriptionHtml`) are dropped — LuckyScent exposes these in GraphQL but their public URLs 404. If a page has no explicit note block, the scraper stores no notes rather than inferring them from hydration payload or other copy.
- **Non-perfume guard (`is-set.ts`)** — both adapters call `isSetOrKit` after building variants and drop the product if it matches. The detector checks Shopify `product_type`, vendor, title, and variant `sizeLabel` against (a) set/kit keywords (`gift set`, `discovery kit/set`, `sample set/pack`, `sampler`, `bundle`, `coffret`, `kit`, `gift with purchase`, `gwp`), (b) non-fragrance keywords (`gift card`, `gift wrap(ping)`, `gift certificate`, `e-certificate`), (c) a piece-count pattern (`10-piece`, `6 piece`), and (d) a multi-vial size pattern (`6x 2ml`). Filters multi-piece sets, dedicated GWP/gift-certificate vendors, gift cards, and gift wrapping before they reach ingest.

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
- **`scripts/backfill-notes.mjs`** — one-off repair script for exact canonical-note mirroring. Reads active listings from Supabase, parses notes from stored Ministry of Scent HTML or live LuckyScent product pages, syncs listing note rows, then runs `rebuildCanonicalNotes`. Optional scope: `--retailer=ministryofscent|luckyscent`; `--suspicious-only` limits work to active listings whose current note rows match the parser’s junk-pattern detector.
- **`scripts/purge-set-perfumes.ts`** — one-off cleanup for perfume rows ingested before the `isSetOrKit` guard existed. Applies the same detector (plus a slug-level safety net for `*-discovery-kit`, `*-gift-set`, `*-piece-*`, and manufacturers like `luckyscent-gifts-with-purchase`) to every `perfumes` row and deletes matches. Dry-run by default; pass `--apply` to actually delete. Deletion cascades through listings, variants, price/stock history, and note tables via FK `on delete cascade`.

### Cron schedule (`vercel.json`)
- `ministryofscent` — `10 0 * * *` (00:10 UTC / 8:10 PM EDT while DST is in effect)
- `luckyscent` — `25 0 * * *` (00:25 UTC / 8:25 PM EDT while DST is in effect)

Cron invocations require `CRON_SECRET` to be set in the Vercel Production environment; the handler rejects any request without `Authorization: Bearer $CRON_SECRET`.

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
- **`notes`** — canonical fragrance-note vocabulary shared by store-note ingestion and user-created personal notes: `id, name, slug UNIQUE, note_family?`. Scrapes still rebuild the store-attached side of this vocabulary from active listings, and personal note creation can promote new user-entered note text into the same table.
- **`source_notes`** — retailer-level unique active note phrases: `id, retailer_id→, raw_note_name, normalized_note_id?→notes`. `UNIQUE(retailer_id, raw_note_name)`.
- **`perfume_notes`** — perfume-level union of active listing notes: `id, perfume_id→ CASCADE, note_id→ CASCADE`. `UNIQUE(perfume_id, note_id)`.
- **`perfume_source_notes`** — per-listing raw note capture, kept in exact sync with the current parsed note set for active listings. `UNIQUE(perfume_listing_id, raw_note_text)`.

### Personal library
- **`personal_perfumes`** — `id, user_id uuid→auth.users CASCADE, perfume_id→ CASCADE, in_collection, in_wanted, favorite default false, size_owned_text?, personal_note?, projection_rating? smallint CHECK (1..5), overall_rating? smallint CHECK (1..5), design_rating? smallint CHECK (1..5), added_to_collection_at?, added_to_wanted_at?, updated_at`. `UNIQUE(user_id, perfume_id)` (the original `UNIQUE(perfume_id)` was swapped out in `20260419220002_user_id_personal.sql`). Partial indexes on each flag, plus `(user_id)` for RLS-filtered reads. Bare rows (both flags false) are allowed so favorite state, tags, notes, or ratings can exist without the perfume being in Collection or Wanted — the original `CHECK (in_collection OR in_wanted)` was dropped in `20260419020001_allow_bare_personal_perfumes.sql`.
- **`personal_perfume_notes`** — `id, user_id uuid→auth.users CASCADE, personal_perfume_id→ CASCADE, note_id→ CASCADE`. `UNIQUE(personal_perfume_id, note_id)` (the parent FK already carries `user_id`). Indexed on `user_id`.
- **`theme_tags`** (renamed from `generic_tags`) — `id, name, slug UNIQUE`. Theme / mood / occasion tags.
- **`personal_perfume_theme_tags`** (renamed from `personal_perfume_generic_tags`) — `id, user_id uuid→auth.users CASCADE, personal_perfume_id→ CASCADE, theme_tag_id→ CASCADE`. `UNIQUE(personal_perfume_id, theme_tag_id)`. Indexed on `user_id`.

### Accounts
- **`profiles`** — `id uuid PRIMARY KEY → auth.users(id) ON DELETE CASCADE, display_name?, created_at, updated_at`. Populated by the `on_auth_user_created` `AFTER INSERT` trigger on `auth.users`, which seeds `display_name` from `raw_user_meta_data->>'full_name'` (fallback to `name`, fallback to email local-part). `security definer` function so the trigger bypasses profile-table RLS.

### Journal
- **`journal_entries`** — `id, user_id uuid→auth.users CASCADE, perfume_id→ CASCADE, title?, body, entry_date DEFAULT current_date`. Indexes `(perfume_id, entry_date desc)`, `(entry_date desc)`, `(user_id)`.

### Ops
- **`scrape_runs`** — `id, source_name, run_type ('initial'|'daily'), status ('running'|'succeeded'|'failed'), started_at, finished_at, records_seen, records_created, records_updated, error_summary?`. Index `(source_name, started_at desc)`.

### RLS / auth model
Multi-user, Google-only auth via native Supabase Auth (no email/password, no other providers — configured in the Supabase dashboard). Every public table has RLS enabled. Catalog tables (`perfumes`, `manufacturers`, `retailers`, `perfume_listings`, `listing_variants`, price/stock history, notes, `source_notes`, `perfume_notes`, `perfume_source_notes`, `theme_tags`, `scrape_runs`) grant `SELECT` to `anon, authenticated`. Writes on those still happen only through the service-role client (scraper + cron).

User-scoped tables (`personal_perfumes`, `personal_perfume_notes`, `personal_perfume_theme_tags`, `journal_entries`) also grant `SELECT` to `anon, authenticated` (inherited from the original single-user policy — RLS-filtered reads in queries scope to `user_id = auth.uid()` explicitly so nothing leaks), and add `INSERT/UPDATE/DELETE` policies for `authenticated` with `user_id = auth.uid()`. `profiles` is stricter: `SELECT` and `UPDATE` are `authenticated, id = auth.uid()` only. A shared `touch_updated_at()` trigger bumps `updated_at` on updates. The `on_auth_user_created` trigger auto-inserts a `profiles` row on sign-up.

Open sign-up: any Google account can complete OAuth and get its own workspace. Existing single-user data (all `personal_perfumes` / join / journal rows from before `20260419220002_*`) was left with `user_id = null` and must be backfilled to the owner's uuid after first sign-in (see `20260419220002_user_id_personal.sql` header comment); a follow-up migration can then flip `user_id` to `NOT NULL`.

---

## Components (`components/brand/`)

Small hand-rolled design system. No shadcn, no headless-ui.
- **`Button.tsx`** — CVA. Variants: `primary | secondary | ghost`. Sizes: `sm | md | lg`.
- **`Card.tsx`** — rounded, `bg-elevated`, soft shadow on hover.
- **`Chip.tsx`** — CVA. Variants: `store` (read-only store notes), `fragrance-note` (accent-toned, for fragrance notes), `theme` (neutral, for theme tags). Sizes: `sm | md`.
- **`SaveControls.tsx`** — *client.* Two toggle buttons (Collection / Wanted) with `useTransition`. `compact` variant for `SavedCard`.
- **`FavoriteStar.tsx`** — *client.* Single-button favorite toggle with inline star SVG states (outline when off, accent-filled when on), optimistic update via `useTransition`, click-again-to-clear behavior, and inline title/error feedback. Used beside the perfume name on the detail page and saved cards.
- **`RatingControl.tsx`** — *client.* Contains `RatingControl` (single personal rating row) and `RatingsControlGroup` (Overall / Projection / Design bundle). Each scale is a 1..5 click-to-clear widget with hover preview, optimistic update via `useTransition`, and rollback on error. Projection keeps the old-fashioned atomizer SVG, Overall uses a heart SVG, and Design uses a traditional eau de parfum bottle SVG. Each row renders icons first, then a small right-side label with a deliberate gap after the icons; the old `Not rated` / `x / 5` helper copy is hidden by default, but save errors still render inline on the right. Shared props include `perfumeId`, `size ("sm" | "md")`, and initial ratings; grouped usage passes `{ projection, overall, design }`.
- **`SignInButton.tsx`** — *client.* "Continue with Google" button; calls `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: "/auth/callback?next=<returnPath>" } })`. Inlines the Google glyph SVG.
- **`HeaderAuth.tsx`** — *server.* Right-side header widget. Logged-out: "Sign in" pill link to `/auth/signin`. Logged-in: display_name + avatar link to `/profile` plus a small POST-to-`/auth/signout` form button.
- **`TagTypeahead.tsx`** — *client.* Combobox input with a custom listbox dropdown of unattached tags (filtered by the typed query). Clicking a suggestion or explicitly navigating to one with the keyboard commits that suggestion; otherwise `Enter` first resolves a case-insensitive exact suggestion-name match, then falls back to the first filtered suggestion, and only uses the raw typed value when no suggestions match. Attached tags render as removable pills, update immediately on add/remove, and then reconcile against a `router.refresh()` after the server action completes. Variant prop: `fragrance-note | theme`.
- **`PageShell.tsx`** — max-width 1240px wrapper.
- **`SectionHeader.tsx`** — optional micro-label + `font-display` heading + optional description/children.
- **`ShellNav.tsx`** — *client.* Pathname-aware shell navigation rendered as plain text links; the active section is highlighted by semibold weight and the `accent-strong` color (no pill / background). Includes section mapping for perfume detail and journal subpages.
- **`JournalEntryCard.tsx`** — *client.* Shared inline journal-entry viewer/editor used by the journal list and perfume detail page; supports edit, in-card delete confirmation, and route-aware refresh after mutations.

Page-scoped components live under `app/(shell)/<route>/_components/`:
- `browse/_components/BrowseClient.tsx` — client, local live-filter controller for `/browse`; owns the free-text search line, house combobox, mixed exact/broad note-filter combobox, URL syncing via `window.history.replaceState`, debounced fetches to `/api/catalog/browse`, and result rendering. Explicit note dropdown picks stay exact; typed-enter note chips become broad note-word filters.
- `collection/_components/AddPerfumeSearch.tsx` — client, typeahead → `/api/catalog/search`, one-click add to Collection / Wanted.
- `library/_components/SavedCard.tsx` — server, composes `Card` + `Chip` + compact `SaveControls`.
- `journal/new/_components/PerfumePicker.tsx` — client, async-search combobox → `/api/catalog/search` (matches perfume or house), keyboard-navigable results list, selected-chip UI, hidden `perfume_id`.
- `perfumes/[manufacturer]/[slug]/_components/JournalSection.tsx` — server, renders the `NewJournalEntry` toggle and the past-entries list using the shared editable `JournalEntryCard` (bordered cards with a left accent stripe). Lives in the right aside under the Availability card.
- `perfumes/[manufacturer]/[slug]/_components/NewJournalEntry.tsx` — client, renders a "+ New journal entry" button that toggles an inline form (pre-filled `perfume_id`, `redirect_to`, editable `entry_date`). Submits to `createJournalEntry`.

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
- **Env** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`. Google OAuth is configured in the Supabase dashboard (Auth → Providers → Google); the Supabase redirect URL must be listed as an Authorized redirect URI in the Google Cloud OAuth client, and `https://scentual.vercel.app/auth/callback` + `http://localhost:3000/auth/callback` must be listed under Supabase Auth → URL Configuration.

---

## Conventions / invariants worth knowing

- Perfume identity is `(manufacturer.slug, perfume.slug)`. Both are produced by `slugify` — change that function carefully.
- Listing identity prefers `(retailer_id, source_product_id)` when present and falls back to `(retailer_id, source_url)`. Variants are `(listing_id, size_label)`.
- Price/stock history is append-only. Never update rows in `listing_price_history` / `listing_stock_history`.
- A `personal_perfumes` row may exist with both flags false when it carries favorite state, tags, notes, or any of the three ratings (the old `in_collection OR in_wanted` CHECK was dropped). Toggling both flags off deletes the row only if it has no attached tags and no `favorite` / `size_owned_text` / `personal_note` / `projection_rating` / `overall_rating` / `design_rating`; otherwise the row is kept so user data survives.
- Store notes (scraper output) and personal note attachments both point at the shared canonical `notes` table, but they are stored in different join tables and still render in separate UI sections.
- Canonical store-note attachments are an exact mirror of explicit note blocks on active product pages. If a scrape-derived note disappears from every active listing, the rebuild prunes it from `source_notes` and `perfume_notes`, but canonical `notes` rows may still remain when users have promoted or attached them personally.
- All mutations revalidate at `("/", "layout")`. If you add a mutation, call it.
- The service role key must never be imported into a client component. Only `lib/supabase/service.ts` reads it, and only the scraper / cron handlers / shared-catalog writes import from there.
- User-scoped writes go through the **session** server client (`lib/supabase/server.ts`) + `requireUser()`. Never use the service client for personal data — that would bypass the `user_id = auth.uid()` RLS guard.
- User-scoped reads must include `.eq("user_id", user.id)` explicitly. RLS is enforced on writes, but the anon/authenticated `SELECT` policy is `true`, so forgetting the filter would leak across users.
