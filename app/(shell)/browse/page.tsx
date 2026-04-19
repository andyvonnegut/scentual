import Link from "next/link";
import { PageShell } from "@/components/brand/PageShell";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card } from "@/components/brand/Card";
import { Chip } from "@/components/brand/Chip";
import {
  getAllManufacturers,
  getAllNotes,
  searchPerfumes,
} from "@/lib/queries/perfumes";

type SearchParams = Promise<{
  q?: string;
  manufacturer?: string;
  note?: string;
}>;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const [perfumes, manufacturers, notes] = await Promise.all([
    searchPerfumes({
      q: params.q,
      manufacturerSlug: params.manufacturer,
      noteSlug: params.note,
      limit: 120,
    }),
    getAllManufacturers(),
    getAllNotes(),
  ]);

  return (
    <PageShell>
      <div className="flex flex-col gap-10">
        <SectionHeader
          label="Browse"
          title="The catalog"
        >
          <p className="text-[color:var(--text-soft)] text-base max-w-xl">
            {perfumes.length} {perfumes.length === 1 ? "result" : "results"}
            {params.q && <> for &ldquo;{params.q}&rdquo;</>}
            {params.manufacturer && <> · {params.manufacturer}</>}
            {params.note && <> · {params.note}</>}
          </p>
        </SectionHeader>

        <form
          method="get"
          className="flex flex-col gap-4 md:flex-row md:items-end md:gap-6"
        >
          <label className="flex flex-1 flex-col gap-2">
            <span className="micro-label">Name</span>
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="e.g. palm oases"
              className="h-11 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--accent)] focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 md:w-56">
            <span className="micro-label">Manufacturer</span>
            <select
              name="manufacturer"
              defaultValue={params.manufacturer ?? ""}
              className="h-11 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-3 text-[color:var(--text)] focus:border-[color:var(--accent)] focus:outline-none"
            >
              <option value="">All houses</option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.slug}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 md:w-56">
            <span className="micro-label">Note</span>
            <select
              name="note"
              defaultValue={params.note ?? ""}
              className="h-11 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-3 text-[color:var(--text)] focus:border-[color:var(--accent)] focus:outline-none"
            >
              <option value="">All notes</option>
              {notes.map((n) => (
                <option key={n.id} value={n.slug}>
                  {n.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              className="h-11 rounded-[var(--radius-md)] bg-[color:var(--accent)] px-6 text-sm font-medium text-white transition-colors hover:bg-[color:var(--accent-strong)]"
            >
              Filter
            </button>
            <Link
              href="/browse"
              className="flex h-11 items-center rounded-[var(--radius-md)] border border-[color:var(--line)] px-4 text-sm text-[color:var(--text-soft)] hover:text-[color:var(--text)]"
            >
              Clear
            </Link>
          </div>
        </form>

        {perfumes.length === 0 ? (
          <Card className="text-[color:var(--text-soft)]">
            <p className="text-sm">No perfumes match that filter.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {perfumes.map((p) => (
              <Link
                key={p.id}
                href={`/perfumes/${p.manufacturer?.slug}/${p.slug}`}
                className="block"
              >
                <Card>
                  <div className="flex flex-col gap-3">
                    <span className="micro-label">
                      {p.manufacturer?.name ?? "—"}
                    </span>
                    <h3 className="font-display text-2xl leading-tight">
                      {p.name}
                    </h3>
                    {p.perfume_notes && p.perfume_notes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {p.perfume_notes.slice(0, 6).map((pn, i) =>
                          pn.note ? (
                            <Chip key={i} variant="store" size="sm">
                              {pn.note.name}
                            </Chip>
                          ) : null,
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
