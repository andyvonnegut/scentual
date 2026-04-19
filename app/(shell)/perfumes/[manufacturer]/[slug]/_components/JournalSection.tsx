import Link from "next/link";
import { createJournalEntry } from "@/app/actions/journal";
import { listJournalEntriesForPerfume } from "@/lib/queries/journal";

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
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <span className="micro-label">Journal</span>
        <Link
          href="/journal"
          className="text-xs text-[color:var(--text-soft)] hover:text-[color:var(--accent-strong)]"
        >
          View all ↗
        </Link>
      </div>

      <form
        action={createJournalEntry}
        className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-5"
      >
        <input type="hidden" name="perfume_id" value={perfumeId} />
        <input type="hidden" name="redirect_to" value={returnPath} />
        <input type="hidden" name="entry_date" value={today} />
        <input
          type="text"
          name="title"
          placeholder="Title (optional)"
          className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--line)] bg-[color:var(--bg)] px-3 text-sm focus:border-[color:var(--accent)] focus:outline-none"
        />
        <textarea
          name="body"
          required
          rows={4}
          placeholder="What did you notice?"
          className="rounded-[var(--radius-sm)] border border-[color:var(--line)] bg-[color:var(--bg)] p-3 text-sm leading-relaxed focus:border-[color:var(--accent)] focus:outline-none"
        />
        <button
          type="submit"
          className="self-start rounded-[var(--radius-pill)] bg-[color:var(--accent)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[color:var(--accent-strong)]"
        >
          Save entry
        </button>
      </form>

      {entries.length === 0 ? (
        <p className="text-sm text-[color:var(--text-soft)]">
          No journal entries yet for this perfume.
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex flex-col gap-2 border-b border-[color:var(--line)] pb-5 last:border-b-0"
            >
              <div className="flex items-baseline gap-3">
                <span className="micro-label">{formatDate(e.entry_date)}</span>
                {e.title && (
                  <span className="font-display text-lg leading-tight">
                    {e.title}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-[color:var(--text)] leading-relaxed">
                {e.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
