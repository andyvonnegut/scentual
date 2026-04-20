#!/usr/bin/env node

// One-off: import the "owned" block of data_import/Beauty Closet - Fragrance .csv
// into Lauren Hickey's Scentual collection.
//
// Dry-run by default; pass --apply to actually write.

import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(
  __dirname,
  "../data_import/Beauty Closet - Fragrance .csv",
);
const TARGET_EMAIL = "laurenhickey@gmail.com";

function loadDotEnvLocal() {
  const envPath = resolve(__dirname, "../.env.local");
  if (!existsSync(envPath)) return;
  const contents = readFileSync(envPath, "utf8");
  for (const line of contents.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    let value = rawValue;
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function slugify(raw) {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function stripEau(name) {
  return name
    .replace(/\beau\s+de\s+parfum\b/gi, "")
    .replace(/\beau\s+de\s+toilette\b/gi, "")
    .replace(/\beau\s+de\s+cologne\b/gi, "")
    .replace(/\bedp\b/gi, "")
    .replace(/\bedt\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripAccents(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// Tiny CSV parser that handles quoted fields containing commas, newlines,
// and "" escapes. Returns a list of rows (each row is a list of strings).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === "\"") {
        if (text[i + 1] === "\"") {
          field += "\"";
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === "\"") {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else if (ch === "\r") {
        // swallow; the \n that follows will commit the row
      } else {
        field += ch;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function hasHeartMarker(raw) {
  if (!raw) return false;
  // Any heart variant in the leading "Sample" column counts as "favorite".
  // \u2764 = ❤, \u{1F49C} = 💜, etc. Match anything in the heart block.
  return /[\u2764\u{1F494}-\u{1F49F}\u{1F90D}\u{1F90E}\u{1F9E1}\u{2665}]/u.test(
    raw,
  );
}

function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run `vercel env pull .env.local --environment production --yes` first.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function findUserByEmail(db, email) {
  // Paginate through auth.users until we find the target. Lauren's list is
  // small so 1 page at 200 is almost always enough.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const match = data.users.find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function tryExactNameAndBrand(db, brand, name) {
  const { data } = await db
    .from("perfumes")
    .select("id, name, slug, manufacturer:manufacturers!inner(id, name, slug)")
    .ilike("name", name)
    .ilike("manufacturer.name", brand);
  return data ?? [];
}

async function tryContainsNameAndBrand(db, brand, name) {
  const { data } = await db
    .from("perfumes")
    .select("id, name, slug, manufacturer:manufacturers!inner(id, name, slug)")
    .ilike("name", `%${name}%`)
    .ilike("manufacturer.name", `%${brand}%`);
  return data ?? [];
}

async function trySlugMatch(db, brandSlug, nameSlug) {
  const { data } = await db
    .from("perfumes")
    .select("id, name, slug, manufacturer:manufacturers!inner(id, name, slug)")
    .eq("slug", nameSlug)
    .eq("manufacturer.slug", brandSlug);
  return data ?? [];
}

async function tryBrandAll(db, brand) {
  const { data } = await db
    .from("perfumes")
    .select("id, name, slug, manufacturer:manufacturers!inner(id, name, slug)")
    .ilike("manufacturer.name", `%${brand}%`)
    .limit(300);
  return data ?? [];
}

function tokenOverlapScore(candidateName, targetName) {
  const tokens = (s) =>
    new Set(
      stripAccents(s)
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t && t.length > 1),
    );
  const a = tokens(candidateName);
  const b = tokens(targetName);
  if (b.size === 0) return 0;
  let hit = 0;
  for (const t of b) if (a.has(t)) hit++;
  return hit / b.size;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = new Array(b.length + 1);
  const cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = cur[j];
  }
  return prev[b.length];
}

// Levenshtein-based similarity across stripped/lowercased strings.
// Returns 1.0 for identical, 0.0 for completely different.
function fuzzySimilarity(a, b) {
  const na = stripAccents(stripEau(a)).toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
  const nb = stripAccents(stripEau(b)).toLowerCase().replace(/[^a-z0-9 ]+/g, "").replace(/\s+/g, " ").trim();
  if (!na || !nb) return 0;
  const d = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - d / maxLen;
}

// Catalog sometimes carries non-fragrance SKUs under the same brand
// (body wash, hair perfume, hand cream, etc). Drop them when the target
// CSV row is a fragrance entry, otherwise they pollute fuzzy scoring.
const NON_PERFUME_PATTERN =
  /\b(body\s*(wash|lotion|cleanser|balm|cream|oil|serum|slab)|hair\s*(perfume|oil|mist|mask)|hand\s*(wash|cream|balm|lotion|soap)|face\s*(cream|wash|serum)|room\s*spray|aromatique|candle|shampoo|conditioner|mouthwash|toothpaste|refill)\b/i;

function isLikelyNonPerfume(name) {
  return NON_PERFUME_PATTERN.test(name);
}

async function matchPerfume(db, brandRaw, nameRaw) {
  const brand = brandRaw.trim();
  const name = nameRaw.trim();
  const attempts = [];

  const exact = await tryExactNameAndBrand(db, brand, name);
  attempts.push({ strategy: "exact", count: exact.length });
  if (exact.length === 1) return { match: exact[0], attempts };

  const stripped = stripEau(name);
  if (stripped.toLowerCase() !== name.toLowerCase()) {
    const exactStripped = await tryExactNameAndBrand(db, brand, stripped);
    attempts.push({ strategy: "exact-no-edp", count: exactStripped.length });
    if (exactStripped.length === 1) return { match: exactStripped[0], attempts };
  }

  const slugHit = await trySlugMatch(db, slugify(brand), slugify(name));
  attempts.push({ strategy: "slug", count: slugHit.length });
  if (slugHit.length === 1) return { match: slugHit[0], attempts };

  const slugStripped = await trySlugMatch(db, slugify(brand), slugify(stripped));
  attempts.push({ strategy: "slug-no-edp", count: slugStripped.length });
  if (slugStripped.length === 1) return { match: slugStripped[0], attempts };

  const contains = await tryContainsNameAndBrand(db, brand, stripped);
  attempts.push({ strategy: "substring", count: contains.length });
  if (contains.length === 1) return { match: contains[0], attempts };
  if (contains.length > 1) {
    // e.g. Byredo "Mojave Ghost" matches 6 rows (Eau de Parfum + Body Wash + ...).
    // Drop the non-fragrance SKUs, then prefer the canonical EDP if present.
    const perfumesOnly = contains.filter((row) => !isLikelyNonPerfume(row.name));
    if (perfumesOnly.length === 1) return { match: perfumesOnly[0], attempts };
    if (perfumesOnly.length > 1) {
      const scored = perfumesOnly
        .map((row) => ({ row, score: fuzzySimilarity(row.name, stripped) }))
        .sort((a, b) => b.score - a.score);
      if (scored[0].score >= 0.6 && scored[0].score - (scored[1]?.score ?? 0) >= 0.05) {
        return { match: scored[0].row, attempts, fuzzyScore: scored[0].score };
      }
    }
  }

  // Last resort: list every perfume by this brand, drop non-fragrance SKUs,
  // and score the rest with a blended token-overlap + Levenshtein similarity.
  const brandAllRaw = await tryBrandAll(db, brand);
  const brandAll = brandAllRaw.filter((row) => !isLikelyNonPerfume(row.name));
  attempts.push({
    strategy: "brand-scored",
    total: brandAllRaw.length,
    afterFilter: brandAll.length,
  });
  if (brandAll.length > 0) {
    const scored = brandAll
      .map((row) => {
        const tokenScore = tokenOverlapScore(row.name, stripped);
        const fuzzy = fuzzySimilarity(row.name, stripped);
        // Blend: token overlap is primary, fuzzy breaks ties / rescues
        // spelling variants like "Marrakesh" vs "Marrakech".
        const score = Math.max(tokenScore, fuzzy * 0.95);
        return { row, score, tokenScore, fuzzy };
      })
      .sort((a, b) => b.score - a.score);
    const top = scored[0];
    const runnerUp = scored[1]?.score ?? 0;
    // Accept if top is a clear leader and reasonably similar.
    if (top.score >= 0.6 && top.score - runnerUp >= 0.05) {
      return { match: top.row, attempts, fuzzyScore: top.score };
    }
    attempts.push({
      strategy: "brand-scored-top",
      candidates: scored.slice(0, 3).map((s) => ({
        name: s.row.name,
        slug: s.row.slug,
        score: Number(s.score.toFixed(2)),
        token: Number(s.tokenScore.toFixed(2)),
        fuzzy: Number(s.fuzzy.toFixed(2)),
      })),
    });
  }

  return { match: null, attempts };
}

async function ensurePersonalPerfume(db, userId, perfumeId, favorite, apply) {
  const { data: existing } = await db
    .from("personal_perfumes")
    .select("*")
    .eq("user_id", userId)
    .eq("perfume_id", perfumeId)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  if (!existing) {
    const insertRow = {
      user_id: userId,
      perfume_id: perfumeId,
      in_owned: true,
      in_desired: false,
      in_sniffed: false,
      added_to_owned_at: nowIso,
      favorite: favorite === true,
    };
    if (!apply) return { action: "would-insert", row: insertRow };
    const { error } = await db.from("personal_perfumes").insert(insertRow);
    if (error) throw error;
    return { action: "inserted", row: insertRow };
  }

  const patch = {};
  if (!existing.in_owned) {
    patch.in_owned = true;
    patch.added_to_owned_at = existing.added_to_owned_at ?? nowIso;
  }
  if (favorite && !existing.favorite) patch.favorite = true;

  if (Object.keys(patch).length === 0) {
    return { action: "already-ok", existingId: existing.id };
  }

  if (!apply) return { action: "would-update", patch, existingId: existing.id };

  const { error } = await db
    .from("personal_perfumes")
    .update(patch)
    .eq("id", existing.id);
  if (error) throw error;
  return { action: "updated", patch, existingId: existing.id };
}

async function ensureJournalEntry(db, userId, perfumeId, body, apply) {
  const trimmed = body.trim();
  if (!trimmed) return { action: "noop" };

  const { data: existing } = await db
    .from("journal_entries")
    .select("id, body")
    .eq("user_id", userId)
    .eq("perfume_id", perfumeId);

  if ((existing ?? []).some((e) => (e.body ?? "").trim() === trimmed)) {
    return { action: "already-exists" };
  }

  const insertRow = {
    user_id: userId,
    perfume_id: perfumeId,
    body: trimmed,
    entry_date: new Date().toISOString().slice(0, 10),
  };
  if (!apply) return { action: "would-insert", row: insertRow };
  const { error } = await db.from("journal_entries").insert(insertRow);
  if (error) throw error;
  return { action: "inserted" };
}

async function main() {
  loadDotEnvLocal();

  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");

  const db = createServiceClient();

  const user = await findUserByEmail(db, TARGET_EMAIL);
  if (!user) {
    console.error(
      `[abort] No auth user found for ${TARGET_EMAIL}. Ask Lauren to sign in at least once, then re-run.`,
    );
    process.exit(1);
  }
  console.log(`Target user: ${user.email} (${user.id})`);

  const raw = await readFile(CSV_PATH, "utf8");
  const rows = parseCsv(raw);
  const header = rows.shift();
  console.log(`CSV header: ${header.join(" | ")}`);

  // Take rows until the first all-blank row, which marks the end of the
  // "owned" block and the start of the seasonal sections below.
  const owned = [];
  for (const r of rows) {
    const cells = r.map((c) => (c ?? "").trim());
    const brand = cells[1] ?? "";
    const name = cells[2] ?? "";
    if (!brand && !name) break;
    owned.push({
      sample: cells[0] ?? "",
      brand,
      name,
      myNotes: cells[11] ?? "",
    });
  }
  console.log(`Owned rows to import: ${owned.length}`);
  if (!apply) console.log("(dry-run; pass --apply to write)");
  console.log("");

  const summary = {
    matched: 0,
    unmatched: 0,
    favorited: 0,
    journaled: 0,
    personalActions: {},
    journalActions: {},
    unmatchedRows: [],
  };

  for (const entry of owned) {
    const { brand, name, sample, myNotes } = entry;
    const favorite = hasHeartMarker(sample);

    const result = await matchPerfume(db, brand, name);
    const label = `${brand} — ${name}${favorite ? " ⭐" : ""}`;

    if (!result.match) {
      summary.unmatched++;
      summary.unmatchedRows.push({ brand, name, attempts: result.attempts });
      console.log(`[unmatched] ${label}`);
      for (const a of result.attempts) {
        console.log(`            ${a.strategy}: ${JSON.stringify(a)}`);
      }
      continue;
    }

    summary.matched++;
    const matchedBy = result.attempts[result.attempts.length - 1].strategy;
    const fuzzy = result.fuzzyScore
      ? ` (fuzzy=${result.fuzzyScore.toFixed(2)})`
      : "";
    console.log(
      `[match:${matchedBy}${fuzzy}] ${label}  →  ${result.match.manufacturer.name} / ${result.match.name} (id=${result.match.id})`,
    );

    const pp = await ensurePersonalPerfume(
      db,
      user.id,
      result.match.id,
      favorite,
      apply,
    );
    summary.personalActions[pp.action] = (summary.personalActions[pp.action] ?? 0) + 1;
    if (favorite) summary.favorited++;
    console.log(`  personal_perfumes: ${pp.action}`);

    if (myNotes && myNotes.trim()) {
      const je = await ensureJournalEntry(
        db,
        user.id,
        result.match.id,
        myNotes,
        apply,
      );
      summary.journalActions[je.action] = (summary.journalActions[je.action] ?? 0) + 1;
      if (je.action === "inserted" || je.action === "would-insert") summary.journaled++;
      console.log(`  journal_entries:   ${je.action} (body="${myNotes.trim()}")`);
    }
  }

  console.log("");
  console.log("Summary:");
  console.log(`  owned rows:   ${owned.length}`);
  console.log(`  matched:      ${summary.matched}`);
  console.log(`  unmatched:    ${summary.unmatched}`);
  console.log(`  favorited:    ${summary.favorited}`);
  console.log(`  journaled:    ${summary.journaled}`);
  console.log(`  personal_perfumes actions: ${JSON.stringify(summary.personalActions)}`);
  console.log(`  journal_entries actions:   ${JSON.stringify(summary.journalActions)}`);

  if (summary.unmatched > 0) {
    console.log("");
    console.log("Unmatched rows (need manual attention):");
    for (const u of summary.unmatchedRows) {
      console.log(`  - ${u.brand} — ${u.name}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
