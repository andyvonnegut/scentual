import Link from "next/link";
import { listJournalEntriesForPerfume } from "@/lib/queries/journal";
import { NewJournalEntry } from "./NewJournalEntry";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
              <li
                key={e.id}
                className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[color:var(--line)] border-l-2 border-l-[color:var(--accent)] bg-[color:var(--bg-elevated)] p-4"
              >
                <div className="flex items-baseline gap-3">
                  <span className="micro-label">{formatDate(e.entry_date)}</span>
                  {e.title && (
                    <span className="font-display text-lg leading-tight">
                      {e.title}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-[color:var(--text)] leading-relaxed">
                  {e.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
