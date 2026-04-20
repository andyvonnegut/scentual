import { PageShell } from "@/components/brand/PageShell";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card } from "@/components/brand/Card";
import { LibraryFilterTabs } from "@/components/brand/LibraryFilterTabs";
import { getSavedPerfumes, type LibraryFilter } from "@/lib/queries/library";
import { requireUser } from "@/lib/auth";
import { AddPerfumeSearch } from "./_components/AddPerfumeSearch";
import { SavedCard } from "./_components/SavedCard";

const VALID_FILTERS: LibraryFilter[] = ["all", "owned", "desired", "sniffed"];

export default async function CollectionPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireUser("/collection");
  const params = await searchParams;
  const active: LibraryFilter = VALID_FILTERS.includes(
    params.filter as LibraryFilter,
  )
    ? (params.filter as LibraryFilter)
    : "all";

  const saved = await getSavedPerfumes(active);

  return (
    <PageShell>
      <div className="flex flex-col gap-10">
        <SectionHeader title="Collection">
          <p className="text-[color:var(--text-soft)] text-base">
            {saved.length} {saved.length === 1 ? "perfume" : "perfumes"}
          </p>
        </SectionHeader>

        <LibraryFilterTabs active={active} />

        <Card>
          <AddPerfumeSearch />
        </Card>

        {saved.length === 0 ? (
          <Card className="text-[color:var(--text-soft)]">
            <p className="text-sm">
              Nothing saved yet. Add a perfume from the search above or from a
              perfume detail page.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {saved.map((s) => (
              <SavedCard key={s.id} saved={s} />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
