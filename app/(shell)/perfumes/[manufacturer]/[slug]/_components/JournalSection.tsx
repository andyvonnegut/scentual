import Link from "next/link";
import { JournalEntryCard } from "@/components/brand/JournalEntryCard";
import { listJournalEntriesForPerfume } from "@/lib/queries/journal";
import { NewJournalEntry } from "./NewJournalEntry";

export async function JournalSection({
  perfumeId,
  returnPath,
}: {
  perfumeId: number;
  returnPath: string;
}) {
  const entries = await listJournalEntriesForPerfume(perfumeId);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between">
        <span className="micro-label">Journal</span>
        <Link
          href="/journal"
          className="text-xs text-[color:var(--text-soft)] hover:text-[color:var(--accent-strong)]"
        >
          View all ↗
        </Link>
      </div>

      <NewJournalEntry perfumeId={perfumeId} returnPath={returnPath} />

      {entries.length === 0 ? (
        <p className="text-sm text-[color:var(--text-soft)]">
          No journal entries yet for this perfume.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <span className="micro-label">Past entries</span>
          <ul className="flex flex-col gap-3">
            {entries.map((e) => (
              <li key={e.id}>
                <JournalEntryCard
                  entry={e}
                  returnPath={returnPath}
                  compact
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
