import Link from "next/link";
import { PageShell } from "@/components/brand/PageShell";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card } from "@/components/brand/Card";
import { getAllPerfumesForPicker } from "@/lib/queries/journal";
import { createJournalEntry } from "@/app/actions/journal";

export default async function NewJournalEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ perfume?: string }>;
}) {
  const params = await searchParams;
  const perfumes = await getAllPerfumesForPicker();
  const preselected = params.perfume ? Number(params.perfume) : null;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <PageShell>
      <div className="flex flex-col gap-8 max-w-2xl">
        <SectionHeader label="New entry" title="Write a journal entry" />
        <Card>
          <form action={createJournalEntry} className="flex flex-col gap-5">
            <input type="hidden" name="redirect_to" value="/journal" />

            <label className="flex flex-col gap-2">
              <span className="micro-label">Perfume</span>
              <select
                name="perfume_id"
                required
                defaultValue={preselected ?? ""}
                className="h-11 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-3 focus:border-[color:var(--accent)] focus:outline-none"
              >
                <option value="">Choose a perfume…</option>
                {perfumes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.manufacturer?.name} · {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="micro-label">Entry date</span>
              <input
                type="date"
                name="entry_date"
                defaultValue={today}
                className="h-11 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-3 focus:border-[color:var(--accent)] focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="micro-label">Title (optional)</span>
              <input
                type="text"
                name="title"
                placeholder="A few words"
                className="h-11 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 focus:border-[color:var(--accent)] focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="micro-label">Body</span>
              <textarea
                name="body"
                required
                rows={10}
                className="rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-4 text-base leading-relaxed focus:border-[color:var(--accent)] focus:outline-none"
              />
            </label>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-[var(--radius-md)] bg-[color:var(--accent)] px-6 py-3 text-sm font-medium text-white hover:bg-[color:var(--accent-strong)]"
              >
                Save entry
              </button>
              <Link
                href="/journal"
                className="text-sm text-[color:var(--text-soft)] hover:text-[color:var(--text)]"
              >
                Cancel
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </PageShell>
  );
}
