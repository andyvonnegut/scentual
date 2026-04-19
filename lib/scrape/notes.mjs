import * as cheerio from "cheerio";

const SECTION_BOUNDARY_LABELS = [
  "about",
  "brand collection",
  "concentration",
  "directions",
  "fyi",
  "fragrance notes",
  "fragrance style",
  "gender",
  "ingredients",
  "name translated",
  "notes",
  "perfumer",
  "perfumers",
  "product recommendations",
  "rating",
  "read our interview",
  "reference",
  "reviews",
  "special message",
  "the scoop",
  "use",
  "year released",
];

const RESERVED_NOTE_TOKENS = new Set([
  "about",
  "brandcollection",
  "concentration",
  "directions",
  "fyi",
  "fragrancenotes",
  "fragrancestyle",
  "gender",
  "ingredients",
  "mainnote",
  "nametranslated",
  "notes",
  "perfumer",
  "perfumers",
  "productrecommendations",
  "rating",
  "reference",
  "reviews",
  "specialmessage",
  "style",
  "thescoop",
  "use",
  "yearreleased",
]);

function normalizeWhitespace(text) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLabelText(text) {
  return normalizeWhitespace(text)
    .toLowerCase()
    .replace(/[*"'`“”‘’]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripLabelPrefix(text, labels) {
  const normalized = normalizeWhitespace(text);
  for (const label of labels) {
    if (!matchesSectionLabel(normalized, [label])) continue;
    const labelRe = new RegExp(label.replace(/\s+/g, "\\s+"), "i");
    const match = normalized.match(labelRe);
    if (!match) continue;
    return normalized
      .slice(match.index + match[0].length)
      .replace(/^[\s:.\-–—]+/, "")
      .trim();
  }
  return normalized.trim();
}

function matchesSectionLabel(text, labels) {
  const normalized = normalizeLabelText(text);
  if (!normalized) return false;

  return labels.some((label) => {
    const target = normalizeLabelText(label);
    return normalized === target || normalized.endsWith(` ${target}`);
  });
}

function isSectionBoundaryNode($, node, labels) {
  if (node.type !== "tag") return false;
  return matchesSectionLabel($(node).text(), labels);
}

function collectTextUntilBoundary($, nodes, boundaryLabels) {
  const parts = [];

  for (const node of nodes) {
    if (isSectionBoundaryNode($, node, boundaryLabels)) break;
    const text = $(node).text();
    if (normalizeWhitespace(text)) {
      parts.push(text);
    }
  }

  return normalizeWhitespace(parts.join(" "));
}

function splitOnTopLevelSeparator(text, separator) {
  const parts = [];
  let current = "";
  let depthParen = 0;
  let depthBracket = 0;
  let quote = null;
  let escaped = false;

  for (const char of text) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      current += char;
      escaped = true;
      continue;
    }

    if (quote) {
      current += char;
      if (char === quote) quote = null;
      continue;
    }

    if (char === '"' || char === "'" || char === "“" || char === "”") {
      current += char;
      quote = char;
      continue;
    }

    if (char === "(") depthParen++;
    if (char === ")" && depthParen > 0) depthParen--;
    if (char === "[") depthBracket++;
    if (char === "]" && depthBracket > 0) depthBracket--;

    if (char === separator && depthParen === 0 && depthBracket === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  parts.push(current.trim());
  return parts.filter(Boolean);
}

export function isSuspiciousRawNoteText(raw) {
  const normalized = normalizeWhitespace(raw ?? "");
  const cleaned = cleanNoteName(normalized);
  const compact = cleaned.replace(/[^a-z0-9]+/g, "");
  const lower = normalized.toLowerCase();

  if (!normalized || !cleaned) return true;
  if (!/[a-z]/i.test(cleaned)) return true;
  if (normalized.length > 160 || cleaned.split(/\s+/).length > 18) return true;
  if (RESERVED_NOTE_TOKENS.has(compact)) return true;
  if (/^\{.*\}$/.test(normalized) || /^\[\d+\]?$/.test(normalized)) return true;
  if (/\\[rntu"\\/]/i.test(normalized) || /\\u[0-9a-f]{4}/i.test(normalized)) return true;
  if (/^\\?"/.test(normalized)) return true;
  if (/^\*{1,3}[a-z]/i.test(normalized)) return true;
  if (/you may also like|product recommendations|read our interview/i.test(lower)) return true;
  if (/(^|\s)fyi[:\s]?/i.test(normalized) || /fyithis/i.test(lower)) return true;
  if (/\$\d/.test(normalized)) return true;
  if (/gid:\/\/shopify|cat:\d+:/i.test(lower)) return true;
  if (/^[-.]\s*[a-z]/i.test(normalized) && cleaned.split(/\s+/).length > 3) return true;
  if (/[.!?]/.test(normalized) && cleaned.split(/\s+/).length > 6) return true;

  return false;
}

export function cleanNoteName(raw) {
  const cleaned = normalizeWhitespace(raw)
    .replace(/^[,;:/|•\-–—]+/, "")
    .replace(/[.,;:/|•\-–—]+$/, "")
    .trim();
  return cleaned.toLowerCase();
}

export function dedupeNoteNames(noteNames) {
  const seen = new Set();
  const deduped = [];

  for (const raw of noteNames) {
    if (isSuspiciousRawNoteText(raw)) continue;
    const cleaned = cleanNoteName(raw);
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    deduped.push(cleaned);
  }

  return deduped;
}

export function splitDelimitedNotes(text) {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const delimiterNormalized = normalized.includes(",")
    ? normalized.replace(/,\s*and\s+/gi, ", ")
    : normalized;

  const separators = [",", ";", "/"];
  for (const separator of separators) {
    if (!delimiterNormalized.includes(separator)) continue;
    const parts = splitOnTopLevelSeparator(delimiterNormalized, separator);
    if (parts.length > 1) return parts;
  }

  return [delimiterNormalized];
}

function extractListNoteTexts($, elements) {
  return elements
    .map((el, index) => {
      const text = normalizeWhitespace($(el).text());
      return index > 0 ? text.replace(/^and\s+/i, "") : text;
    })
    .filter(Boolean);
}

function extractNoteListFromHeading($, headingText) {
  const heading = $("h1, h2, h3, h4, h5, h6")
    .filter((_, el) => normalizeWhitespace($(el).text()).toLowerCase() === headingText)
    .first();

  if (!heading.length) return [];

  const inParent = heading.parent().find("ul li, ol li");
  if (inParent.length) {
    return dedupeNoteNames(extractListNoteTexts($, inParent.toArray()));
  }

  let sibling = heading.next();
  while (sibling.length) {
    const siblingText = normalizeWhitespace(sibling.text());
    if (/^(fragrance notes|fragrance style|the scoop|perfumer)$/i.test(siblingText)) {
      break;
    }

    const items = sibling.find("ul li, ol li");
    if (items.length) {
      return dedupeNoteNames(extractListNoteTexts($, items.toArray()));
    }

    sibling = sibling.next();
  }

  return [];
}

function extractDelimitedBlock($, labels) {
  const boundaryLabels = [...new Set([...labels, ...SECTION_BOUNDARY_LABELS])];
  const elements = $("strong, b, em, p, div, span")
    .toArray()
    .sort((a, b) => $(b).parents().length - $(a).parents().length);

  for (const el of elements) {
    const element = $(el);
    const ownText = normalizeWhitespace(element.text());
    if (!matchesSectionLabel(ownText, labels)) continue;

    const inlineText = stripLabelPrefix(ownText, labels);
    if (inlineText && inlineText !== ownText) {
      const inlineNotes = dedupeNoteNames(splitDelimitedNotes(inlineText));
      if (inlineNotes.length) return inlineNotes;
      continue;
    }

    const parent = element.parent();
    const siblings = parent.contents().toArray();
    const idx = siblings.findIndex((node) => node === el);
    if (idx >= 0) {
      const trailing = collectTextUntilBoundary($, siblings.slice(idx + 1), boundaryLabels);
      const notes = dedupeNoteNames(splitDelimitedNotes(trailing));
      if (notes.length) return notes;
    }

    const parentText = stripLabelPrefix(
      collectTextUntilBoundary($, parent.contents().toArray(), boundaryLabels),
      labels,
    );
    const parentNotes = dedupeNoteNames(splitDelimitedNotes(parentText));
    if (parentNotes.length) return parentNotes;

    let next = parent.next();
    while (next.length) {
      if (matchesSectionLabel(next.text(), boundaryLabels)) break;

      const nextList = next.find("li");
      if (nextList.length) {
        return dedupeNoteNames(extractListNoteTexts($, nextList.toArray()));
      }

      const nextNotes = dedupeNoteNames(splitDelimitedNotes(next.text()));
      if (nextNotes.length) return nextNotes;
      if (normalizeWhitespace(next.text())) break;
      next = next.next();
    }
  }

  return [];
}

export function extractNotesFromMinistryOfScentHtml(html) {
  if (!html) return [];
  const $ = cheerio.load(html);
  return extractDelimitedBlock($, ["Notes", "Fragrance Notes"]);
}

export function extractNotesFromLuckyscentPageHtml(html) {
  if (!html) return [];
  const $ = cheerio.load(html);

  const listed = extractNoteListFromHeading($, "fragrance notes");
  if (listed.length) return listed;

  return extractDelimitedBlock($, ["Fragrance Notes", "Notes"]);
}

export function extractNotesForRetailer(retailerSlug, html) {
  if (!html) return [];
  if (retailerSlug === "ministryofscent") {
    return extractNotesFromMinistryOfScentHtml(html);
  }
  if (retailerSlug === "luckyscent") {
    return extractNotesFromLuckyscentPageHtml(html);
  }
  return [];
}

export function diffListingNoteRows(existingRows, desiredNoteNames) {
  const desired = dedupeNoteNames(desiredNoteNames);
  const desiredSet = new Set(desired);

  return {
    desired,
    deleteIds: existingRows
      .filter((row) => !desiredSet.has(row.raw_note_text))
      .map((row) => row.id),
  };
}

export function buildNoteMirrorRows(listingRows) {
  const canonicalNoteNames = [];
  const seenNotes = new Set();
  const sourceNotes = [];
  const seenSourceNotes = new Set();
  const perfumeNotes = [];
  const seenPerfumeNotes = new Set();

  for (const row of listingRows) {
    if (!seenNotes.has(row.noteName)) {
      seenNotes.add(row.noteName);
      canonicalNoteNames.push(row.noteName);
    }

    const sourceKey = `${row.retailerId}:${row.noteName}`;
    if (!seenSourceNotes.has(sourceKey)) {
      seenSourceNotes.add(sourceKey);
      sourceNotes.push({
        retailer_id: row.retailerId,
        raw_note_name: row.noteName,
      });
    }

    const perfumeKey = `${row.perfumeId}:${row.noteName}`;
    if (!seenPerfumeNotes.has(perfumeKey)) {
      seenPerfumeNotes.add(perfumeKey);
      perfumeNotes.push({
        perfume_id: row.perfumeId,
        noteName: row.noteName,
      });
    }
  }

  return { canonicalNoteNames, sourceNotes, perfumeNotes };
}
