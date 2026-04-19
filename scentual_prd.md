# PRD: Scentual

## 1. Overview

**Product name:** Scentual  
**Platform:** Web app  
**Stack:** Vercel + Supabase  
**Product type:** Single-user personal perfume database, library, and journal

Scentual is a private perfume app for tracking fragrances, organizing a personal library, and maintaining a structured perfume database with historical retailer changes over time.

The app will:

- maintain a canonical perfume database
- ingest data from `ministryofscent.com` and `luckyscent.com`
- run a daily scrape for new additions and updates
- store **price history transactionally**
- store **stock history transactionally**
- let the user organize perfumes in **Collection** and **Wanted** states
- keep **source-derived store notes** read-only
- support a reusable library of **user fragrance-note tags**
- support a reusable library of **generic tags**
- support perfume-linked journal entries

The visual direction should be **pink, editorial, modern-art-inspired, and premium**.

---

## 2. Product Goal

Create a private, elegant perfume system for one user that acts as:

- a perfume reference database
- a collection tracker
- a wanted list
- a historical tracker for price and stock
- a personal organization layer built around structured tags
- a standalone and perfume-linked journal

---

## 3. Non-Goals

Out of scope:

- login
- multi-user support
- analytics / product metrics
- post-MVP planning
- duplicate-resolution tooling
- manual creation of new perfumes
- images
- social features
- community reviews
- commerce / checkout
- editing source/store notes

---

## 4. Product Principles

### 4.1 Single-user by design
The app is for one person only. There is no authentication, sharing, or permission model.

### 4.2 Canonical data with source-specific commercial records
A perfume is a canonical entity. Retailer listings and listing variants preserve source-specific descriptions, price, stock, and availability details.

### 4.3 Historical changes are first-class
Price and stock changes are not overwritten destructively. They are recorded transactionally and remain reviewable over time.

### 4.4 Personal organization is separate from source truth
Retailer/store notes are source-derived and read-only. Personal organization comes from the user’s library, tags, saved states, and journal entries.

### 4.5 Quiet luxury over dashboard clutter
The app should feel like a curated archive, not an admin panel.

---

## 5. Core Product Requirements

## 5.1 Perfume Catalog

The app must maintain a perfume database containing, where available:

- perfume name
- manufacturer / house
- source descriptions / copy
- source scent notes
- canonical scent notes
- size variants
- retailer-specific price
- retailer-specific stock
- retailer source
- source URL
- ingestion timestamps

The system must separate:

- the **canonical perfume**
- each **retailer-specific listing**
- each **listing variant** such as size

This allows one perfume to map to multiple source listings while preserving retailer-specific commercial data.

---

## 5.2 Source Ingestion

### Initial build
The system must scrape:

- `ministryofscent.com`
- `luckyscent.com`

It must ingest:

- manufacturers
- perfumes
- listings
- variants / sizes
- source descriptions
- source note text
- current prices
- current stock

### Daily scrape
A daily scheduled process must:

- discover new perfumes
- discover new variants
- update current prices
- update current stock
- mark records as last seen
- preserve all stock and price changes transactionally

### Data rules

- normal scraping should not delete records
- disappeared listings should be marked inactive or not recently seen
- changed prices create appended price history rows
- changed stock states create appended stock history rows
- scrape runs should be idempotent where possible

---

## 5.3 Transactional Historical Tracking

### Price history
Requirements:

- each listing variant stores a current price for fast reads
- each price change inserts a new historical record
- price history must be reviewable over time

### Stock history
Requirements:

- each listing variant stores a current stock state for fast reads
- each stock change inserts a new historical record
- stock history must be reviewable over time

### Supported normalized stock states
Examples:

- in stock
- out of stock
- low stock
- unavailable
- unknown

Raw source stock strings should also be preserved if available.

---

## 5.4 Unified Personal Library

There is one **Library** for saved perfumes.

A saved perfume can be:

- in Collection
- in Wanted
- in both
- removed from both and therefore no longer saved

The saved perfume record uses **shared metadata** even when a perfume is in both Collection and Wanted.

Shared metadata includes:

- owned size
- personal note
- user fragrance-note tags
- generic tags
- timestamps for when it entered Collection and/or Wanted

### Add entry points
The user must be able to add a perfume to Collection and/or Wanted from:

1. a **perfume detail page**
2. the **Library** by searching the catalog

### Default library view
The default Library view should be **All Saved**.

---

## 5.5 Tagging Model

Tags do **not** belong to journal entries.

Tags belong to the **saved perfume record** in the personal library layer.

There are three related note/tag layers in the product:

### A. Store notes
These are canonical fragrance notes derived from scraped retailer data.

- read-only
- source-derived
- attached to perfumes
- not user editable

Examples:

- rose
- iris
- sandalwood
- incense

### B. User fragrance-note tags
These are personal note-oriented tags used by the user to describe saved perfumes.

- reusable across perfumes
- managed through a dedicated library
- expandable when the user creates a new tag

Examples:

- clean musk
- cold iris
- airy rose
- dusty vanilla

### C. Generic tags
These are broader non-note organizational tags used by the user.

- reusable across perfumes
- managed through a dedicated library
- expandable when the user creates a new tag

Examples:

- summer
- work
- formal
- signature
- sample
- backup bottle

### Tag requirements

- store notes are read-only and source-derived
- user fragrance-note tags are personal and reusable
- generic tags are personal and reusable
- the user can create new user fragrance-note tags
- the user can create new generic tags
- creating a new tag adds it to the relevant tag library
- tags are attached to saved perfumes, not journal entries

---

## 5.6 Journal

The app must support journal entries attached to perfumes.

Journal entries should support:

- title
- body
- entry date
- associated perfume

Journal entries do **not** have tags.

Journal entries should be accessible from:

- the perfume detail page
- a standalone chronological Journal view

This allows both perfume-centric and diary-centric use.

---

## 6. User Stories

### Discovery and reference
- As the user, I want to browse perfumes by manufacturer so I can explore a house’s catalog.
- As the user, I want to search perfumes by name so I can find fragrances quickly.
- As the user, I want to view store notes, descriptions, sizes, prices, and stock so I can understand a perfume and compare availability.
- As the user, I want to review price history over time.
- As the user, I want to review stock history over time.

### Personal library
- As the user, I want to add a perfume to Collection from a perfume page.
- As the user, I want to add a perfume to Wanted from a perfume page.
- As the user, I want to add a perfume from the Library by searching the catalog.
- As the user, I want a perfume to be allowed in both Collection and Wanted.
- As the user, I want shared metadata for a saved perfume even when it is in both lists.

### Tagging
- As the user, I want to see source-derived store notes on a perfume.
- As the user, I want to assign personal fragrance-note tags to saved perfumes.
- As the user, I want to assign generic tags to saved perfumes.
- As the user, I want reusable tag libraries so I can keep my organization consistent.
- As the user, I want newly created tags to be saved into the proper library automatically.

### Journal
- As the user, I want to create journal entries attached to perfumes.
- As the user, I want to view journal entries from the perfume page.
- As the user, I want to browse my journal chronologically in a standalone view.

---

## 7. Functional Scope

### Included
- perfume catalog
- manufacturer pages
- perfume detail pages
- search
- source listings
- size / price / stock data
- transactional price history
- transactional stock history
- unified library
- Collection state
- Wanted state
- add-from-detail flow
- add-from-library search flow
- read-only store notes
- user fragrance-note tag library
- generic tag library
- user-created reusable tags
- perfume-linked journal entries
- standalone journal view
- pink editorial visual system

### Excluded
- auth
- multi-user permissions
- images
- duplicate tooling
- manual perfume creation
- journal tagging
- analytics
- social features

---

## 8. Information Architecture

Primary sections:

- Home
- Browse
- Perfume Detail
- Library
- Journal
- Tag Management

---

## 9. Core Screens

## 9.1 Home

Purpose:

- entry point into the collection and database
- overview of recent additions and updates

Contents may include:

- recently added perfumes
- recently updated perfumes
- quick links to Library, Journal, Browse
- quick search

---

## 9.2 Browse

Purpose:

- browse the database independently of saved state

Capabilities:

- browse all perfumes
- browse by manufacturer
- search by perfume name
- filter by store notes if desired

---

## 9.3 Perfume Detail

Purpose:

- canonical perfume record plus source-specific commercial data
- primary place to save perfumes and view history

Sections:

- perfume name
- manufacturer
- read-only store notes
- source descriptions
- source listings
- variants/sizes
- current prices by source
- current stock by source
- price history
- stock history
- personal save controls
- personal metadata section if saved
- journal entry section / entry list

Primary actions:

- Add to Collection
- Add to Wanted
- remove from either state
- edit shared saved-perfume metadata if saved
- manage user fragrance-note tags if saved
- manage generic tags if saved
- add journal entry

---

## 9.4 Library

Purpose:

- unified personal workspace for all saved perfumes

Default state:

- **All Saved**

Filtering options:

- All Saved
- Collection
- Wanted
- Both

Recommended interaction pattern:

- segmented control or pill filters rather than a literal slider

Core controls:

- search field for saved perfumes and/or catalog add flow
- add-by-search interface
- filter controls
- optional tag filters

Saved perfume item/card should show:

- perfume name
- manufacturer
- Collection / Wanted state badges
- store notes preview
- user fragrance-note tags
- generic tags
- personal note preview
- owned size if present

---

## 9.5 Journal

Purpose:

- chronological view of personal writing across perfumes

Capabilities:

- show journal entries in reverse chronological order
- filter by perfume
- link each entry back to its perfume
- create entry from within a perfume or possibly from the journal view with perfume selection

Journal entries do not have tags.

---

## 9.6 Tag Management

Purpose:

- maintain reusable tag libraries

Sections:

- User Fragrance-Note Tags
- Generic Tags

Capabilities:

- list all tags in each library
- create new tags
- edit tag names if supported
- delete tags if supported
- show usage counts if helpful

Store notes are **not** managed here because they are source-derived and read-only.

---

## 10. Data Model

## 10.1 Core catalog tables

### manufacturers
- `id`
- `name`
- `slug`
- `created_at`
- `updated_at`

### perfumes
- `id`
- `manufacturer_id`
- `name`
- `slug`
- `canonical_description` nullable
- `created_at`
- `updated_at`

### retailers
- `id`
- `name`
- `slug`
- `base_url`

### perfume_listings
Retailer-specific listing for a perfume.

- `id`
- `perfume_id`
- `retailer_id`
- `source_url`
- `source_product_id` nullable
- `source_title`
- `source_description` nullable
- `active`
- `first_seen_at`
- `last_seen_at`
- `last_scraped_at`
- `created_at`
- `updated_at`

### listing_variants
Typically size-based variants.

- `id`
- `perfume_listing_id`
- `size_label`
- `size_value_ml` nullable
- `current_price`
- `currency`
- `current_stock_status`
- `current_stock_raw` nullable
- `first_seen_at`
- `last_seen_at`
- `updated_at`

---

## 10.2 Transactional history tables

### listing_price_history
- `id`
- `listing_variant_id`
- `price`
- `currency`
- `observed_at`
- `change_type`

### listing_stock_history
- `id`
- `listing_variant_id`
- `stock_status`
- `stock_raw` nullable
- `observed_at`
- `change_type`

---

## 10.3 Source note normalization tables

### notes
Canonical source/store note vocabulary.

- `id`
- `name`
- `slug`
- `note_family` nullable
- `created_at`
- `updated_at`

### source_notes
Stores raw source note strings before / alongside normalization.

- `id`
- `retailer_id`
- `raw_note_name`
- `normalized_note_id` nullable
- `created_at`

### perfume_notes
Canonical store notes attached to perfumes.

- `id`
- `perfume_id`
- `note_id`
- `created_at`

### perfume_source_notes
Optional source-level traceability for notes.

- `id`
- `perfume_listing_id`
- `raw_note_text`
- `normalized_note_id` nullable
- `created_at`

---

## 10.4 Personal library tables

### personal_perfumes
One saved record per perfume.

- `id`
- `perfume_id`
- `in_collection` boolean
- `in_wanted` boolean
- `size_owned_text` nullable
- `personal_note` nullable
- `added_to_collection_at` nullable
- `added_to_wanted_at` nullable
- `updated_at`

This record holds shared metadata even when the perfume is in both states.

---

## 10.5 User tag libraries

### user_fragrance_note_tags
Reusable personal fragrance-note tags.

- `id`
- `name`
- `slug`
- `created_at`
- `updated_at`

### generic_tags
Reusable personal generic tags.

- `id`
- `name`
- `slug`
- `created_at`
- `updated_at`

### personal_perfume_user_fragrance_note_tags
Join table between saved perfumes and user fragrance-note tags.

- `id`
- `personal_perfume_id`
- `user_fragrance_note_tag_id`

### personal_perfume_generic_tags
Join table between saved perfumes and generic tags.

- `id`
- `personal_perfume_id`
- `generic_tag_id`

---

## 10.6 Journal tables

### journal_entries
- `id`
- `perfume_id`
- `title`
- `body`
- `entry_date`
- `created_at`
- `updated_at`

No journal tag tables.

---

## 10.7 Operational tables

### scrape_runs
- `id`
- `source_name`
- `run_type` enum(`initial`, `daily`)
- `status`
- `started_at`
- `finished_at`
- `records_seen`
- `records_created`
- `records_updated`
- `error_summary` nullable

---

## 11. Canonical Note Strategy

The app must maintain a canonical store-note vocabulary derived from Ministry of Scent and LuckyScent source note data.

### Purpose
The canonical note system should:

- normalize source note data from both retailers
- support a consistent read-only note view on perfumes
- support filtering and browsing by store notes

### Rules

- store notes are **read-only**
- store notes are **source-derived**
- store notes are not directly editable by the user
- store notes are separate from user fragrance-note tags

### Initial normalization approach
Use simple normalization rules such as:

- lowercase normalization
- whitespace trimming
- punctuation cleanup
- singular / plural cleanup where obvious
- explicit synonym mapping only where defined in code/config

Examples:

- `Rose` → `rose`
- `sandalwood ` → `sandalwood`
- `orange-blossom` → `orange blossom`

### Constraints
- no duplicate-resolution UI
- no manual admin tooling in v1
- no user editing of source/store notes

---

## 12. Key Product Decisions

### 12.1 Single-user product
There is no account system and no concept of multiple owners.

### 12.2 Unified library
Collection and Wanted are modeled as two independent states on one saved perfume record.

### 12.3 Shared metadata
If a perfume is in both Collection and Wanted, it still has one shared personal record and one set of metadata.

### 12.4 Read-only store notes
Store notes come from source ingestion and normalization only.

### 12.5 Reusable personal tag libraries
User fragrance-note tags and generic tags each live in reusable libraries. Creating a new tag adds it to the relevant library for later use.

### 12.6 Journal without tags
Journal entries remain in scope, but tags are not attached to them.

### 12.7 No images
The product does not store or render product imagery.

### 12.8 No manual perfume creation
Perfumes must originate from scraped database records.

---

## 13. User Flows

## 13.1 Add from perfume detail
1. User opens a perfume detail page
2. User clicks **Add to Collection**, **Add to Wanted**, or both
3. System creates or updates the `personal_perfumes` record
4. If already saved, controls show active state
5. User can edit shared metadata and apply personal tags

## 13.2 Add from Library
1. User opens Library
2. User uses search to find a perfume from the catalog
3. Search results show quick-add actions
4. User adds the perfume to Collection, Wanted, or both
5. System creates or updates the saved perfume record
6. Perfume appears in the default All Saved view

## 13.3 Add user tag
1. User opens a saved perfume or Tag Management
2. User creates a new user fragrance-note tag or generic tag
3. New tag is saved into the relevant tag library
4. User applies it to the saved perfume
5. Tag becomes reusable elsewhere

## 13.4 Daily scrape update
1. Scheduled job runs
2. Scraper fetches retailer catalog and detail pages
3. System parses manufacturer, perfume, descriptions, notes, size, price, and stock
4. System matches or creates perfume/listing/variant records
5. Current price and stock are updated
6. Historical price and stock rows are appended when changes occur
7. Run metadata is logged in `scrape_runs`

## 13.5 Journal entry flow
1. User opens a perfume page or the Journal view
2. User creates a new journal entry tied to a perfume
3. Entry appears in the perfume page journal section
4. Entry also appears in the standalone chronological journal view

---

## 14. Scraping and Matching Behavior

Each scrape should:

1. fetch available catalog/index pages from the retailer
2. fetch perfume detail pages
3. parse manufacturer, perfume name, description, notes, size, price, stock
4. match or create canonical perfume and listing records
5. update current fields on listing variants
6. append new price history rows if price changed
7. append new stock history rows if stock changed
8. update timestamps and run logs

### Matching behavior
For v1, use basic deterministic matching with normalized:

- manufacturer name
- perfume name
- retailer source identifiers where available

No duplicate-review workflow is required.

---

## 15. UX Requirements

## 15.1 Visual Direction

Scentual should feel:

- pink-forward
- editorial
- modern
- contemporary-art inspired
- premium
- sensorial
- soft but confident

It should not feel:

- sugary
- overly cute
- dashboard-heavy
- cluttered
- commerce-first

---

## 15.2 Design Principles

- use generous whitespace
- present data in layered, elegant panels
- make structured information feel collectible
- emphasize typography and restraint
- make tags feel tactile
- keep controls clean and calm

---

## 15.3 Theme and Style Guide

### Brand mood words
- blush
- gallery
- sculptural
- lacquer
- vellum
- quiet luxury
- luminous
- refined

### Color system
Use a pink-led palette with restrained neutrals.

Suggested token directions:

- `--bg`: warm blush-tinted off-white
- `--bg-elevated`: shell pink
- `--surface`: pale rose haze
- `--surface-2`: dusty blush
- `--text`: deep plum-black
- `--text-soft`: mauve gray
- `--accent`: vivid rose
- `--accent-strong`: berry / wine
- `--line`: translucent mauve-gray
- `--success`: muted sage
- `--warning`: terracotta blush

Suggested palette example:

- Cream: `#FCF7F8`
- Blush: `#F6E3E8`
- Rose Dust: `#E8C7D1`
- Accent Rose: `#D95C8A`
- Plum Ink: `#2B1F26`
- Mauve Gray: `#7C6A73`

Use color as atmosphere, not as constant saturation.

---

## 15.4 Typography

### Recommended pairing
- **Display font:** elegant serif or high-contrast editorial serif
- **UI font:** clean sans-serif

### Usage guidance
- perfume names: large serif
- metadata and controls: sans-serif
- section headings: refined and airy
- micro-labels: tracked uppercase sans

### Typography rules
- generous line height
- large headings with open spacing
- avoid overly decorative scripts
- use compact uppercase labels for metadata and table headers

---

## 15.5 Layout

### General rules
- lots of whitespace
- asymmetry used intentionally
- modular cards with soft edges
- luxury vertical rhythm instead of compact density

### Grid guidance
- 12-column desktop grid
- generous gutters
- stacked mobile layout
- balance editorial blocks with utility panels

### Perfume page layout suggestion
- left: title, house, personal save controls, personal tags
- right: source listings, sizes, current pricing, stock
- below: store notes, descriptions, price history, stock history, journal

---

## 15.6 Components

### Buttons
- pill or soft-radius rectangle
- rose accent for primary actions
- quiet outlined secondary actions
- subtle hover states

### Inputs
- clean surfaces
- soft borders
- lightly tinted backgrounds
- strong but elegant focus states in rose/plum

### Cards
- pale tinted surfaces
- thin borders
- minimal shadow
- no heavy elevation

### Chips / tags
There should be clear visual distinction between note systems.

#### Store notes
- quiet, lighter chips
- informational rather than interactive
- read-only feel

#### User fragrance-note tags
- stronger tint or outline
- clearly personal and editable
- sensory feel

#### Generic tags
- more neutral or plum-toned
- organizational feel

### History panels / tables
- minimal dividers
- light structure
- small-caps headers
- avoid dense grids or thick rules

---

## 15.7 Motion

Motion should be restrained and premium.

Use:

- soft fade-ins
- subtle hover translation
- mild chip state transitions
- very light scale or lift on focus

Avoid:

- bounce
- flashy parallax
- fast movement
- excessive animation

---

## 15.8 CSS Guidance

### Use design tokens
Define tokens for:

- color
- typography
- spacing
- radius
- shadow
- transitions

### Radius guidance
- cards: medium radius
- pills/tags: full radius
- inputs/buttons: medium-large radius

### Spacing scale
Use a restrained scale such as:

- 4
- 8
- 12
- 16
- 24
- 32
- 48
- 64

Favor larger spacing steps to preserve editorial openness.

### Border and shadow rules
- borders should be subtle
- shadows should be soft and barely visible
- rely on tonal contrast more than dramatic elevation

### Suggested CSS starter
```css
:root {
  --bg: #fcf7f8;
  --bg-elevated: #fffafb;
  --surface: #f6e3e8;
  --surface-2: #f1d7df;
  --text: #2b1f26;
  --text-soft: #7c6a73;
  --accent: #d95c8a;
  --accent-strong: #bb3f70;
  --line: rgba(43, 31, 38, 0.12);

  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --radius-pill: 999px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;

  --shadow-soft: 0 6px 24px rgba(43, 31, 38, 0.06);

  --transition-fast: 160ms ease;
  --transition-base: 220ms ease;
}
```

---

## 16. Technical Requirements

## 16.1 Stack
- **Frontend:** Next.js on Vercel
- **Backend/database:** Supabase Postgres
- **Scheduling:** Vercel Cron and/or Supabase scheduled jobs

## 16.2 Architecture
### Frontend
- Next.js App Router
- server-rendered catalog pages where useful
- client-side interactions for library management and journal editing

### Backend
- Supabase Postgres as source of truth
- server functions for ingestion, querying, and app actions

### Scraping subsystem
The scraping workflow must:

- fetch retailer catalog and product pages
- parse descriptions, notes, size, price, and stock
- detect changes since prior scrape
- write transactional history rows
- log scrape runs and failures

---

## 17. Acceptance Criteria

Scentual is complete when:

- the system ingests perfumes from Ministry of Scent and LuckyScent
- perfumes store manufacturer, descriptions, source notes, canonical store notes, and retailer data
- listing variants store current size, price, and stock
- price changes are stored transactionally
- stock changes are stored transactionally
- daily scrape jobs update the dataset
- the user can save a perfume from a perfume record
- the user can mark a saved perfume as Collection, Wanted, or both
- the user can save perfumes from the Library via search
- saved perfumes use one shared personal record
- store notes are read-only and source-derived
- the app supports a reusable user fragrance-note tag library
- the app supports a reusable generic tag library
- creating a new tag adds it to the appropriate library
- user tags attach to saved perfumes, not journal entries
- journal entries exist and attach to perfumes
- journal entries are visible on perfume pages
- journal entries are also visible in a standalone chronological Journal view
- the Library is unified and defaults to All Saved
- the Library can filter by Collection, Wanted, and Both
- no authentication is required
- no images are used

---

## 18. Summary

Scentual is a single-user perfume product centered on four layers:

1. a canonical perfume database  
2. retailer-specific commercial tracking with transactional price and stock history  
3. a unified saved-perfume library with Collection and Wanted states  
4. a personal writing and organization layer through reusable tags and journal entries

Its core distinction is the separation between:

- **read-only source/store notes**
- **personal reusable user fragrance-note tags**
- **personal reusable theme tags**

all wrapped in a pink, modern, editorial interface built on Vercel and Supabase.
