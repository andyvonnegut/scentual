import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNoteMirrorRows,
  cleanNoteName,
  diffListingNoteRows,
  extractNotesFromLuckyscentPageHtml,
  extractNotesFromMinistryOfScentHtml,
} from "./notes.mjs";

test("cleanNoteName preserves source phrases with minimal cleanup", () => {
  assert.equal(cleanNoteName(" Vanilla-Bourbon, "), "vanilla-bourbon");
  assert.equal(cleanNoteName("Cocoa Absolute."), "cocoa absolute");
});

test("extractNotesFromMinistryOfScentHtml reads the labeled notes block", () => {
  const html = `
    <p><strong>Perfumer</strong><br>John Pegg</p>
    <p><strong>Notes<br></strong>coffee, cocoa, caramel, maple syrup, vanilla, amber</p>
  `;

  assert.deepEqual(extractNotesFromMinistryOfScentHtml(html), [
    "coffee",
    "cocoa",
    "caramel",
    "maple syrup",
    "vanilla",
    "amber",
  ]);
});

test("extractNotesFromLuckyscentPageHtml reads the fragrance notes list", () => {
  const html = `
    <div>
      <h3 class="leading-5 font-normal">Fragrance Notes</h3>
      <div>
        <ul class="list-none space-x-1">
          <li class="inline"><a href="/fragrances?f.l.notes=Vanilla">Vanilla</a>, </li>
          <li class="inline"><a href="/fragrances?f.l.notes=Vanilla%20Beans">Vanilla Beans</a>, </li>
          <li class="inline"><a href="/fragrances?f.l.notes=Vanilla%20Bourbon">Vanilla Bourbon</a>, </li>
          <li class="inline"><a href="/fragrances?f.l.notes=Vanilla%20Powder">Vanilla Powder</a>, </li>
          <li class="inline"><a href="/fragrances?f.l.notes=Cocoa%20Absolute">Cocoa Absolute</a>, </li>
          <li class="inline"><a href="/fragrances?f.l.notes=Musk">Musk</a></li>
        </ul>
      </div>
    </div>
  `;

  assert.deepEqual(extractNotesFromLuckyscentPageHtml(html), [
    "vanilla",
    "vanilla beans",
    "vanilla bourbon",
    "vanilla powder",
    "cocoa absolute",
    "musk",
  ]);
});

test("diffListingNoteRows identifies stale listing-level notes", () => {
  const diff = diffListingNoteRows(
    [
      { id: 1, raw_note_text: "vanilla" },
      { id: 2, raw_note_text: "amber" },
      { id: 3, raw_note_text: "musk" },
    ],
    ["vanilla", "musk"],
  );

  assert.deepEqual(diff.desired, ["vanilla", "musk"]);
  assert.deepEqual(diff.deleteIds, [2]);
});

test("buildNoteMirrorRows unions notes across listings and retailers", () => {
  const mirror = buildNoteMirrorRows([
    { retailerId: 1, perfumeId: 10, noteName: "vanilla" },
    { retailerId: 1, perfumeId: 10, noteName: "musk" },
    { retailerId: 2, perfumeId: 10, noteName: "vanilla" },
    { retailerId: 2, perfumeId: 11, noteName: "amber" },
  ]);

  assert.deepEqual(mirror.canonicalNoteNames, ["vanilla", "musk", "amber"]);
  assert.deepEqual(mirror.sourceNotes, [
    { retailer_id: 1, raw_note_name: "vanilla" },
    { retailer_id: 1, raw_note_name: "musk" },
    { retailer_id: 2, raw_note_name: "vanilla" },
    { retailer_id: 2, raw_note_name: "amber" },
  ]);
  assert.deepEqual(mirror.perfumeNotes, [
    { perfume_id: 10, noteName: "vanilla" },
    { perfume_id: 10, noteName: "musk" },
    { perfume_id: 11, noteName: "amber" },
  ]);
});
