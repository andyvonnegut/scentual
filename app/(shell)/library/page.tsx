import Link from "next/link";
import { PageShell } from "@/components/brand/PageShell";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card } from "@/components/brand/Card";
import { cn } from "@/lib/utils";
import {
  getAllFragranceNoteTags,
  getAllGenericTags,
  getSavedPerfumes,
  type LibraryFilter,
} from "@/lib/queries/library";
import { AddPerfumeSearch } from "./_components/AddPerfumeSearch";
import { SavedCard } from "./_components/SavedCard";

const FILTERS: { value: LibraryFilter; label: string }[] = [
  { value: "all", label: "All Saved" },
  { value: "collection", label: "Collection" },
  { value: "wanted", label: "Wanted" },
  { value: "both", label: "Both" },
];

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: LibraryFilter }>;
}) {
  const params = await searchParams;
  const active: LibraryFilter = FILTERS.some((f) => f.value === params.filter)
    ? (params.filter as LibraryFilter)
    : "all";

  const [saved, allFragranceTags, allGenericTags] = await Promise.all([
    getSavedPerfumes(active),
    getAllFragranceNoteTags(),
    getAllGenericTags(),
  ]);

  return (
    <PageShell>
      <div className="flex flex-col gap-10">
        <SectionHeader label="Your archive" title="Library">
          <p className="text-[color:var(--text-soft)] text-base">
            {saved.length} {saved.length === 1 ? "perfume" : "perfumes"}
          </p>
        </SectionHeader>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex rounded-[var(--radius-pill)] border border-[color:var(--line)] p-1 bg-[color:var(--bg-elevated)] w-fit">
            {FILTERS.map((f) => {
              const isActive = f.value === active;
              const href = f.value === "all" ? "/library" : `/library?filter=${f.value}`;
              return (
                <Link
                  key={f.value}
                  href={href}
                  className={cn(
                    "rounded-[var(--radius-pill)] px-4 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-[color:var(--accent)] text-white"
                      : "text-[color:var(--text-soft)] hover:text-[color:var(--text)]",
                  )}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
        </div>

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
              <SavedCard
                key={s.id}
                saved={s}
                allFragranceTags={allFragranceTags}
                allGenericTags={allGenericTags}
              />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
