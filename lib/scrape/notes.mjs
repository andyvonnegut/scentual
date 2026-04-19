import * as cheerio from "cheerio";

function normalizeWhitespace(text) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripLabelPrefix(text, labels) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`^(?:${escaped.join("|")})\\b\\s*[:\\-–—]?\\s*`, "i");
  return text.replace(re, "").trim();
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

  const separators = [",", ";", "/"];
  for (const separator of separators) {
    if (!normalized.includes(separator)) continue;
    return normalized
      .split(separator)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  return [normalized];
}

function extractNoteListFromHeading($, headingText) {
  const heading = $("h1, h2, h3, h4, h5, h6")
    .filter((_, el) => normalizeWhitespace($(el).text()).toLowerCase() === headingText)
    .first();

  if (!heading.length) return [];

  const inParent = heading.parent().find("ul li, ol li");
  if (inParent.length) {
    return dedupeNoteNames(
      inParent
        .map((_, el) => $(el).text())
        .get(),
    );
  }

  let sibling = heading.next();
  while (sibling.length) {
    const siblingText = normalizeWhitespace(sibling.text());
    if (/^(fragrance notes|fragrance style|the scoop|perfumer)$/i.test(siblingText)) {
      break;
    }

    const items = sibling.find("ul li, ol li");
    if (items.length) {
      return dedupeNoteNames(
        items
          .map((_, el) => $(el).text())
          .get(),
      );
    }

    sibling = sibling.next();
  }

  return [];
}

function extractDelimitedBlock($, labels) {
  const lowerLabels = labels.map((label) => label.toLowerCase());
  const elements = $("strong, b, em, p, div, span").toArray();

  for (const el of elements) {
    const element = $(el);
    const ownText = normalizeWhitespace(element.text());
    const ownLower = ownText.toLowerCase();
    const matchedLabel = lowerLabels.find((label) => ownLower === label);
    if (!matchedLabel) continue;

    const parent = element.parent();
    const siblings = parent.contents().toArray();
    const idx = siblings.findIndex((node) => node === el);
    if (idx >= 0) {
      const trailing = siblings
        .slice(idx + 1)
        .map((node) => $(node).text())
        .join(" ");
      const notes = dedupeNoteNames(splitDelimitedNotes(trailing));
      if (notes.length) return notes;
    }

    const parentText = stripLabelPrefix(normalizeWhitespace(parent.text()), labels);
    const parentNotes = dedupeNoteNames(splitDelimitedNotes(parentText));
    if (parentNotes.length) return parentNotes;

    const next = parent.next();
    if (next.length) {
      const nextList = next.find("li");
      if (nextList.length) {
        return dedupeNoteNames(
          nextList
            .map((_, li) => $(li).text())
            .get(),
        );
      }

      const nextNotes = dedupeNoteNames(splitDelimitedNotes(next.text()));
      if (nextNotes.length) return nextNotes;
    }
  }

  const pageText = normalizeWhitespace($.root().text());
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `${escaped}\\b\\s*[:\\-–—]?\\s*(.+?)(?=(?:perfumer|fragrance style|the scoop|about|read our interview)\\b|$)`,
      "i",
    );
    const match = pageText.match(re);
    if (!match) continue;
    const notes = dedupeNoteNames(splitDelimitedNotes(match[1]));
    if (notes.length) return notes;
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
