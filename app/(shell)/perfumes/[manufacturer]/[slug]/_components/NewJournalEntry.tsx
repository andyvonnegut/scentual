"use client";

import { useState } from "react";
import { createJournalEntry } from "@/app/actions/journal";

export function NewJournalEntry({
  perfumeId,
  returnPath,
}: {
  perfumeId: number;
  returnPath: string;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-[var(--radius-pill)] bg-[color:var(--accent)] px-4 py-2 text-xs font-medium text-white hover:bg-[color:var(--accent-strong)]"
      >
        + New journal entry
      </button>
    );
  }

  return (
    <form
      action={createJournalEntry}
      className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] p-5"
    >
      <input type="hidden" name="perfume_id" value={perfumeId} />
      <input type="hidden" name="redirect_to" value={returnPath} />
      <input
        type="date"
        name="entry_date"
        defaultValue={today}
        className="h-10 w-fit rounded-[var(--radius-sm)] border border-[color:var(--line)] bg-[color:var(--bg)] px-3 text-sm focus:border-[color:var(--accent)] focus:outline-none"
      />
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
      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="rounded-[var(--radius-pill)] bg-[color:var(--accent)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[color:var(--accent-strong)]"
        >
          Save entry
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-[var(--radius-pill)] px-4 py-1.5 text-xs font-medium text-[color:var(--text-soft)] hover:text-[color:var(--accent-strong)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
