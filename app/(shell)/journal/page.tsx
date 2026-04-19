import Link from "next/link";
import { PageShell } from "@/components/brand/PageShell";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card } from "@/components/brand/Card";
import { listJournalEntries } from "@/lib/queries/journal";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ perfume?: string }>;
}) {
  const params = await searchParams;
  const perfumeId = params.perfume ? Number(params.perfume) : undefined;
  const entries = await listJournalEntries(perfumeId);

  return (
    <PageShell>
      <div className="flex flex-col gap-10">
        <SectionHeader label="Journal" title="Your writings on scent">
          <div className="flex items-center gap-4">
            <p className="text-[color:var(--text-soft)] text-base">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </p>
            <Link
              href="/journal/new"
              className="rounded-[var(--radius-pill)] bg-[color:var(--accent)] px-4 py-1.5 text-sm font-medium text-white hover:bg-[color:var(--accent-strong)]"
            >
              + New entry
            </Link>
          </div>
        </SectionHeader>

        {entries.length === 0 ? (
          <Card className="text-[color:var(--text-soft)]">
            <p className="text-sm">
              No entries yet. Start by writing one from a perfume page or{" "}
              <Link
                href="/journal/new"
                className="text-[color:var(--accent-strong)] underline-offset-2 hover:underline"
              >
                create one directly
              </Link>
              .
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            {entries.map((e) => (
              <Card key={e.id}>
                <article className="flex flex-col gap-3">
                  <div className="flex items-baseline justify-between">
                    <span className="micro-label">
                      {formatDate(e.entry_date)}
                    </span>
                    {e.perfume && (
                      <Link
                        href={`/perfumes/${e.perfume.manufacturer?.slug ?? ""}/${e.perfume.slug}`}
                        className="text-xs text-[color:var(--text-soft)] hover:text-[color:var(--accent-strong)]"
                      >
                        {e.perfume.manufacturer?.name} · {e.perfume.name} ↗
                      </Link>
                    )}
                  </div>
                  {e.title && (
                    <h3 className="font-display text-2xl leading-tight">
                      {e.title}
                    </h3>
                  )}
                  <p className="whitespace-pre-wrap text-[color:var(--text)] leading-relaxed">
                    {e.body}
                  </p>
                </article>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
