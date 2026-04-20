import { PageShell } from "@/components/brand/PageShell";
import { parseBrowseNoteParams } from "@/lib/browse";
import {
  browsePerfumes,
  getAllManufacturers,
  getAllNotes,
} from "@/lib/queries/perfumes";
import { getSessionUser } from "@/lib/auth";
import { BrowseClient } from "./_components/BrowseClient";

type SearchParams = Promise<{
  q?: string;
  manufacturer?: string;
  note?: string | string[];
  note_q?: string | string[];
}>;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const selectedNotes = parseBrowseNoteParams(
    typeof params.note === "string" ? [params.note] : params.note,
    typeof params.note_q === "string" ? [params.note_q] : params.note_q,
  );

  const user = await getSessionUser();
  const [initialResponse, manufacturers, noteOptions] = await Promise.all([
      browsePerfumes(
        {
          q: params.q,
          manufacturerSlug: params.manufacturer,
          notes: selectedNotes,
          limit: 120,
        },
        user?.id ?? null,
      ),
      getAllManufacturers(),
      getAllNotes(),
    ]);

  const noteNameByKey = new Map(
    noteOptions.map((note) => [note.slug, note.name]),
  );

  const hydratedNotes = selectedNotes.map((note) => ({
    ...note,
    name:
      note.type === "exact"
        ? (noteNameByKey.get(note.slug) ?? note.name ?? note.slug)
        : (note.name ?? note.query),
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
