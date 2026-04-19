import Link from "next/link";
import { PageShell } from "@/components/brand/PageShell";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card } from "@/components/brand/Card";
import { JournalEntryCard } from "@/components/brand/JournalEntryCard";
import { listJournalEntries } from "@/lib/queries/journal";

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
        <SectionHeader title="Curated scentual memories...">
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
              <JournalEntryCard
                key={e.id}
                entry={e}
                perfume={e.perfume ?? undefined}
                returnPath="/journal"
              />
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
