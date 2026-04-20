#!/usr/bin/env node

// One-off: import the requested seasonal ranges from
// data_import/Beauty Closet - Fragrance .csv into Lauren Hickey's
// sniffed collection, adding the section theme tag, favorite marker,
// rounded overall rating, and optional journal entry from "My Notes".
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

const SECTION_RANGES = [
  { tagName: "spring", startRow: 24, endRow: 72 },
  { tagName: "summer", startRow: 77, endRow: 105 },
  { tagName: "fall", startRow: 110, endRow: 156 },
  { tagName: "winter", startRow: 161, endRow: 182 },
  { tagName: "past loves", startRow: 187, endRow: 198 },
];

const HEART_OR_STAR_PATTERN =
  /[\u2764\u2665\u{1F493}-\u{1F49F}\u{1F90D}-\u{1F90F}\u{1F9E1}\u{1FA75}-\u{1FA77}⭐★☆🌟]/u;

const NON_PERFUME_PATTERN =
  /\b(body\s*(wash|lotion|cleanser|balm|cream|oil|serum|slab)|hair\s*(perfume|oil|mist|mask)|hand\s*(wash|cream|balm|lotion|soap)|face\s*(cream|wash|serum)|room\s*spray|aromatique|candle|shampoo|conditioner|mouthwash|toothpaste|refill)\b/i;

const BRAND_ALIASES = new Map([
  ["D&G", "Dolce&Gabbana"],
  ["Heretic Parfum", "Heretic Parfums"],
  ["YSL", "Yves Saint Laurent"],
]);

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

function stripEmoji(raw) {
  return raw.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, " ");
}

function normalizeWhitespace(raw) {
  return raw.replace(/\s+/g, " ").trim();
}

function cleanBrand(raw) {
  const cleaned = normalizeWhitespace(stripEmoji(raw));
  return BRAND_ALIASES.get(cleaned) ?? cleaned;
}

function cleanName(raw) {
  return normalizeWhitespace(stripEmoji(raw));
}

function normalizeNameForCompare(raw) {
  return stripAccents(stripEau(cleanName(raw)))
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseRating(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.round(numeric);
  if (rounded < 1 || rounded > 5) return null;
  return rounded;
}

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

function hasFavoriteMarker(raw) {
  if (!raw) return false;
  return HEART_OR_STAR_PATTERN.test(raw);
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

function fuzzySimilarity(a, b) {
  const na = normalizeNameForCompare(a);
  const nb = normalizeNameForCompare(b);
  if (!na || !nb) return 0;
  const d = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - d / maxLen;
}

function isLikelyNonPerfume(name) {
  return NON_PERFUME_PATTERN.test(name);
}

function pickNormalizedExact(rows, targetName) {
  const normalizedTarget = normalizeNameForCompare(targetName);
  if (!normalizedTarget) return null;
  const hits = rows.filter(
    (row) => normalizeNameForCompare(row.name) === normalizedTarget,
  );
  if (hits.length === 1) return hits[0];
  return null;
}

function acceptStrongCandidate(scored) {
  const top = scored[0];
  const runnerUp = scored[1]?.score ?? 0;
  const margin = top.score - runnerUp;

  if (top.tokenScore === 1 && top.fuzzy >= 0.9 && margin >= 0.05) return true;
  if (top.score >= 0.92 && top.fuzzy >= 0.85 && margin >= 0.05) return true;
  if (top.score >= 0.85 && top.tokenScore >= 0.75 && top.fuzzy >= 0.8 && margin >= 0.08) {
    return true;
  }
  return false;
}

async function matchPerfume(db, brandRaw, nameRaw) {
  const brand = cleanBrand(brandRaw);
  const name = cleanName(nameRaw);
  const attempts = [];

  if (!brand || !name) return { match: null, attempts };

  const exact = await tryExactNameAndBrand(db, brand, name);
  attempts.push({ strategy: "exact", count: exact.length });
  if (exact.length === 1) return { match: exact[0], attempts };
  const exactNormalized = pickNormalizedExact(exact, name);
  if (exactNormalized) return { match: exactNormalized, attempts };

  const stripped = stripEau(name);
  if (stripped.toLowerCase() !== name.toLowerCase()) {
    const exactStripped = await tryExactNameAndBrand(db, brand, stripped);
    attempts.push({ strategy: "exact-no-edp", count: exactStripped.length });
    if (exactStripped.length === 1) return { match: exactStripped[0], attempts };
    const exactStrippedNormalized = pickNormalizedExact(exactStripped, stripped);
    if (exactStrippedNormalized) {
      return { match: exactStrippedNormalized, attempts };
    }
  }

  const slugHit = await trySlugMatch(db, slugify(brand), slugify(name));
  attempts.push({ strategy: "slug", count: slugHit.length });
  if (slugHit.length === 1) return { match: slugHit[0], attempts };

  const slugStripped = await trySlugMatch(db, slugify(brand), slugify(stripped));
  attempts.push({ strategy: "slug-no-edp", count: slugStripped.length });
  if (slugStripped.length === 1) return { match: slugStripped[0], attempts };

  const contains = await tryContainsNameAndBrand(db, brand, stripped);
  attempts.push({ strategy: "substring", count: contains.length });
  if (contains.length === 1) {
    const only = contains[0];
    if (normalizeNameForCompare(only.name) === normalizeNameForCompare(stripped)) {
      return { match: only, attempts };
    }
  }
  const containsNormalized = pickNormalizedExact(contains, stripped);
  if (containsNormalized) return { match: containsNormalized, attempts };

  if (contains.length > 1) {
    const perfumesOnly = contains.filter((row) => !isLikelyNonPerfume(row.name));
    const perfumesOnlyNormalized = pickNormalizedExact(perfumesOnly, stripped);
    if (perfumesOnlyNormalized) {
      return { match: perfumesOnlyNormalized, attempts };
    }
    if (perfumesOnly.length > 0) {
      const scored = perfumesOnly
        .map((row) => {
          const tokenScore = tokenOverlapScore(row.name, stripped);
          const fuzzy = fuzzySimilarity(row.name, stripped);
          return {
            row,
            score: Math.max(tokenScore, fuzzy * 0.95),
            tokenScore,
            fuzzy,
          };
        })
        .sort((a, b) => b.score - a.score);

      if (acceptStrongCandidate(scored)) {
        return { match: scored[0].row, attempts, fuzzyScore: scored[0].score };
      }
    }
  }

  const brandAllRaw = await tryBrandAll(db, brand);
  const brandAll = brandAllRaw.filter((row) => !isLikelyNonPerfume(row.name));
  attempts.push({
    strategy: "brand-scored",
    total: brandAllRaw.length,
    afterFilter: brandAll.length,
  });
  if (brandAll.length > 0) {
    const brandAllNormalized = pickNormalizedExact(brandAll, stripped);
    if (brandAllNormalized) return { match: brandAllNormalized, attempts };

    const scored = brandAll
      .map((row) => {
        const tokenScore = tokenOverlapScore(row.name, stripped);
        const fuzzy = fuzzySimilarity(row.name, stripped);
        const score = Math.max(tokenScore, fuzzy * 0.95);
        return { row, score, tokenScore, fuzzy };
      })
      .sort((a, b) => b.score - a.score);

    if (acceptStrongCandidate(scored)) {
      return { match: scored[0].row, attempts, fuzzyScore: scored[0].score };
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

async function ensureThemeTag(db, tagName, apply) {
  const slug = slugify(tagName);
  const { data: existing, error: existingError } = await db
    .from("theme_tags")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return { action: "existing", tag: existing };

  const insertRow = { name: tagName, slug };
  if (!apply) return { action: "would-create", tag: insertRow };

  const { data, error } = await db
    .from("theme_tags")
    .upsert(insertRow, { onConflict: "slug" })
    .select("id, name, slug")
    .single();
  if (error) throw error;
  return { action: "created", tag: data };
}

async function ensurePersonalPerfume(
  db,
  userId,
  perfumeId,
  favorite,
  overallRating,
  apply,
) {
  const { data: existing, error: existingError } = await db
    .from("personal_perfumes")
    .select("*")
    .eq("user_id", userId)
    .eq("perfume_id", perfumeId)
    .maybeSingle();
  if (existingError) throw existingError;

  const nowIso = new Date().toISOString();

  if (!existing) {
    const insertRow = {
      user_id: userId,
      perfume_id: perfumeId,
      in_owned: false,
      in_desired: false,
      in_sniffed: true,
      added_to_sniffed_at: nowIso,
      favorite: favorite === true,
      overall_rating: overallRating,
    };
    if (!apply) {
      return { action: "would-insert", row: insertRow, personalPerfumeId: null };
    }
    const { data, error } = await db
      .from("personal_perfumes")
      .insert(insertRow)
      .select("id")
      .single();
    if (error) throw error;
    return { action: "inserted", row: insertRow, personalPerfumeId: data.id };
  }

  const patch = {};
  if (!existing.in_sniffed) {
    patch.in_sniffed = true;
    patch.added_to_sniffed_at = existing.added_to_sniffed_at ?? nowIso;
  }
  if (favorite && !existing.favorite) patch.favorite = true;
  if (overallRating != null && existing.overall_rating !== overallRating) {
    patch.overall_rating = overallRating;
  }

  if (Object.keys(patch).length === 0) {
    return {
      action: "already-ok",
      existingId: existing.id,
      personalPerfumeId: existing.id,
    };
  }

  if (!apply) {
    return {
      action: "would-update",
      patch,
      existingId: existing.id,
      personalPerfumeId: existing.id,
    };
  }

  const { error } = await db
    .from("personal_perfumes")
    .update(patch)
    .eq("id", existing.id);
  if (error) throw error;
  return {
    action: "updated",
    patch,
    existingId: existing.id,
    personalPerfumeId: existing.id,
  };
}

async function ensureThemeAttachment(
  db,
  userId,
  personalPerfumeId,
  themeTagId,
  apply,
) {
  const { data: existing, error: existingError } = await db
    .from("personal_perfume_theme_tags")
    .select("id")
    .eq("user_id", userId)
    .eq("personal_perfume_id", personalPerfumeId)
    .eq("theme_tag_id", themeTagId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return { action: "already-exists" };

  const insertRow = {
    user_id: userId,
    personal_perfume_id: personalPerfumeId,
    theme_tag_id: themeTagId,
  };
  if (!apply) return { action: "would-insert", row: insertRow };

  const { error } = await db.from("personal_perfume_theme_tags").insert(insertRow);
  if (error) throw error;
  return { action: "inserted" };
}

async function ensureJournalEntry(db, userId, perfumeId, body, apply) {
  const trimmed = body.trim();
  if (!trimmed) return { action: "noop" };

  const { data: existing, error: existingError } = await db
    .from("journal_entries")
    .select("id, body")
    .eq("user_id", userId)
    .eq("perfume_id", perfumeId);
  if (existingError) throw existingError;

  if ((existing ?? []).some((entry) => (entry.body ?? "").trim() === trimmed)) {
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

function incrementCounter(map, key) {
  map[key] = (map[key] ?? 0) + 1;
}

function getCells(row) {
  return [...row, ...Array(14).fill("")].slice(0, 14).map((cell) => cell.trim());
}

function collectEntries(rows) {
  const entries = [];
  for (const section of SECTION_RANGES) {
    for (let rowNumber = section.startRow; rowNumber <= section.endRow; rowNumber++) {
      const row = rows[rowNumber - 1] ?? [];
      const cells = getCells(row);
      const [sample, brand, name, , , myRating, , , , , , myNotes] = cells;
      if (!brand && !name) continue;
      entries.push({
        rowNumber,
        tagName: section.tagName,
        sample,
        brand,
        name,
        myRating,
        myNotes,
      });
    }
  }
  return entries;
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
  const header = rows[0] ?? [];
  console.log(`CSV header: ${header.join(" | ")}`);

  const entries = collectEntries(rows);
  console.log(`Rows selected for import: ${entries.length}`);
  if (!apply) console.log("(dry-run; pass --apply to write)");
  console.log("");

  const tagRefs = new Map();
  for (const section of SECTION_RANGES) {
    const ensured = await ensureThemeTag(db, section.tagName, apply);
    const tagId = ensured.tag.id ?? null;
    tagRefs.set(section.tagName, {
      id: tagId,
      action: ensured.action,
      name: ensured.tag.name,
      slug: ensured.tag.slug,
    });
    console.log(
      `[theme-tag] ${section.tagName} -> ${ensured.action}${tagId ? ` (id=${tagId})` : ""}`,
    );
  }

  console.log("");

  const summary = {
    processed: entries.length,
    matched: 0,
    unmatched: 0,
    favorited: 0,
    ratingsSet: 0,
    themed: 0,
    journaled: 0,
    personalActions: {},
    themeActions: {},
    journalActions: {},
    unmatchedRows: [],
  };

  for (const entry of entries) {
    const favorite = hasFavoriteMarker(entry.sample);
    const overallRating = parseRating(entry.myRating);
    const result = await matchPerfume(db, entry.brand, entry.name);
    const label = `row ${entry.rowNumber} | ${entry.brand} — ${entry.name}`;

    if (!result.match) {
      summary.unmatched++;
      summary.unmatchedRows.push({
        rowNumber: entry.rowNumber,
        tagName: entry.tagName,
        brand: entry.brand,
        name: entry.name,
        attempts: result.attempts,
      });
      console.log(`[unmatched] ${label}`);
      const lastAttempt = result.attempts[result.attempts.length - 1];
      if (lastAttempt?.candidates) {
        console.log(`  top candidates: ${JSON.stringify(lastAttempt.candidates)}`);
      }
      continue;
    }

    summary.matched++;
    if (favorite) summary.favorited++;
    if (overallRating != null) summary.ratingsSet++;

    const matchedBy = result.attempts[result.attempts.length - 1]?.strategy ?? "unknown";
    const fuzzy = result.fuzzyScore
      ? ` (fuzzy=${result.fuzzyScore.toFixed(2)})`
      : "";
    console.log(
      `[match:${matchedBy}${fuzzy}] ${label} -> ${result.match.manufacturer.name} / ${result.match.name} (id=${result.match.id})`,
    );

    const personal = await ensurePersonalPerfume(
      db,
      user.id,
      result.match.id,
      favorite,
      overallRating,
      apply,
    );
    incrementCounter(summary.personalActions, personal.action);
    console.log(`  personal_perfumes: ${personal.action}`);

    const themeTag = tagRefs.get(entry.tagName);
    if (!themeTag) {
      throw new Error(`Theme tag id unavailable for "${entry.tagName}"`);
    }

    const personalPerfumeId =
      personal.personalPerfumeId ??
      personal.row?.id ??
      null;
    if (personalPerfumeId != null && themeTag.id != null) {
      const theme = await ensureThemeAttachment(
        db,
        user.id,
        personalPerfumeId,
        themeTag.id,
        apply,
      );
      incrementCounter(summary.themeActions, theme.action);
      if (theme.action === "inserted" || theme.action === "would-insert") {
        summary.themed++;
      }
      console.log(`  personal_perfume_theme_tags: ${theme.action} (${entry.tagName})`);
    } else if (!apply) {
      incrementCounter(summary.themeActions, "deferred-dry-run");
      summary.themed++;
      console.log(
        `  personal_perfume_theme_tags: deferred-dry-run (${entry.tagName})`,
      );
    } else {
      throw new Error(`Theme tag id unavailable for "${entry.tagName}" during apply`);
    }

    if (entry.myNotes.trim()) {
      const journal = await ensureJournalEntry(
        db,
        user.id,
        result.match.id,
        entry.myNotes,
        apply,
      );
      incrementCounter(summary.journalActions, journal.action);
      if (journal.action === "inserted" || journal.action === "would-insert") {
        summary.journaled++;
      }
      console.log(`  journal_entries: ${journal.action}`);
    }
  }

  console.log("");
  console.log("Summary:");
  console.log(`  processed:   ${summary.processed}`);
  console.log(`  matched:     ${summary.matched}`);
  console.log(`  unmatched:   ${summary.unmatched}`);
  console.log(`  favorited:   ${summary.favorited}`);
  console.log(`  ratings set: ${summary.ratingsSet}`);
  console.log(`  themed:      ${summary.themed}`);
  console.log(`  journaled:   ${summary.journaled}`);
  console.log(
    `  personal_perfumes actions: ${JSON.stringify(summary.personalActions)}`,
  );
  console.log(
    `  theme attachment actions:  ${JSON.stringify(summary.themeActions)}`,
  );
  console.log(
    `  journal_entries actions:   ${JSON.stringify(summary.journalActions)}`,
  );

  if (summary.unmatched > 0) {
    console.log("");
    console.log("Unmatched rows:");
    for (const row of summary.unmatchedRows) {
      console.log(
        `  - row ${row.rowNumber} [${row.tagName}] ${row.brand} — ${row.name}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
