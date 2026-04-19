import { PageShell } from "@/components/brand/PageShell";
import {
  parseBrowseNoteParams,
  type BrowseNoteOption,
} from "@/lib/browse";
import { getAllFragranceNoteTags } from "@/lib/queries/library";
import {
  browsePerfumes,
  getAllManufacturers,
  getAllNotes,
} from "@/lib/queries/perfumes";
import { BrowseClient } from "./_components/BrowseClient";

type SearchParams = Promise<{
  q?: string;
  manufacturer?: string;
  note?: string | string[];
}>;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const selectedNotes = parseBrowseNoteParams(
    typeof params.note === "string" ? [params.note] : params.note,
  );

  const [initialResponse, manufacturers, storeNotes, userNotes] =
    await Promise.all([
      browsePerfumes({
        q: params.q,
        manufacturerSlug: params.manufacturer,
        notes: selectedNotes,
        limit: 120,
      }),
      getAllManufacturers(),
      getAllNotes(),
      getAllFragranceNoteTags(),
    ]);

  const noteOptions: BrowseNoteOption[] = [
    ...storeNotes.map((note) => ({ ...note, source: "store" as const })),
    ...userNotes.map((note) => ({ ...note, source: "user" as const })),
  ].sort((a, b) => {
    const byName = a.name.localeCompare(b.name);
    if (byName !== 0) return byName;
    return a.source.localeCompare(b.source);
  });

  const noteNameByKey = new Map(
    noteOptions.map((note) => [`${note.source}:${note.slug}`, note.name]),
  );

  const hydratedNotes = selectedNotes.map((note) => ({
    ...note,
    name: noteNameByKey.get(`${note.source}:${note.slug}`) ?? note.slug,
  }));

  return (
    <PageShell>
      <BrowseClient
        initialState={{
          q: params.q ?? "",
          manufacturerSlug: params.manufacturer ?? "",
          notes: hydratedNotes,
        }}
        initialResponse={initialResponse}
        manufacturers={manufacturers}
        noteOptions={noteOptions}
      />
    </PageShell>
  );
}
