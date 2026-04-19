"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { deleteJournalEntry, updateJournalEntry } from "@/app/actions/journal";
import { cn } from "@/lib/utils";
import { Card } from "./Card";

type EntryPerfume = {
  name: string;
  slug: string;
  manufacturer: {
    name: string;
    slug: string;
  } | null;
};

type JournalEntry = {
  id: number;
  title: string | null;
  body: string;
  entry_date: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function JournalEntryCard({
  entry,
  perfume,
  returnPath,
  compact = false,
  className,
}: {
  entry: JournalEntry;
  perfume?: EntryPerfume;
  returnPath?: string;
  compact?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [title, setTitle] = useState(entry.title ?? "");
  const [body, setBody] = useState(entry.body);
  const [entryDate, setEntryDate] = useState(entry.entry_date);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function resetForm() {
    setTitle(entry.title ?? "");
    setBody(entry.body);
    setEntryDate(entry.entry_date);
    setError(null);
  }

  function openEditor() {
    resetForm();
    setIsConfirmingDelete(false);
    setIsEditing(true);
  }

  function cancelEditing() {
    resetForm();
    setIsEditing(false);
  }

  function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    formData.set("id", String(entry.id));
    if (returnPath) formData.set("return_path", returnPath);

    startTransition(async () => {
      try {
        await updateJournalEntry(formData);
        setError(null);
        setIsEditing(false);
        setIsConfirmingDelete(false);
        router.refresh();
      } catch {
        setError("Unable to save this entry right now.");
      }
    });
  }

  function handleDelete() {
    const formData = new FormData();
    formData.set("id", String(entry.id));
    if (returnPath) formData.set("return_path", returnPath);

    startTransition(async () => {
      try {
        await deleteJournalEntry(formData);
        setError(null);
        router.refresh();
      } catch {
        setError("Unable to delete this entry right now.");
      }
    });
  }

  return (
    <Card
      className={cn(
        compact && "border-l-2 border-l-[color:var(--accent)] p-4 hover:shadow-none",
        className,
      )}
    >
      {isEditing ? (
        <form className="flex flex-col gap-3" onSubmit={handleSave}>
          <input
            type="date"
            name="entry_date"
            required
            value={entryDate}
            onChange={(event) => setEntryDate(event.target.value)}
            disabled={isPending}
            className="h-10 w-fit rounded-[var(--radius-sm)] border border-[color:var(--line)] bg-[color:var(--bg)] px-3 text-sm focus:border-[color:var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <input
            type="text"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title (optional)"
            disabled={isPending}
            className="h-10 rounded-[var(--radius-sm)] border border-[color:var(--line)] bg-[color:var(--bg)] px-3 text-sm focus:border-[color:var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <textarea
            name="body"
            required
            rows={compact ? 5 : 8}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={isPending}
            className="rounded-[var(--radius-sm)] border border-[color:var(--line)] bg-[color:var(--bg)] p-3 text-sm leading-relaxed focus:border-[color:var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          {error && <p className="text-sm text-[color:var(--accent-strong)]">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-[var(--radius-pill)] bg-[color:var(--accent)] px-4 py-1.5 text-xs font-medium text-white hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isPending}
              className="rounded-[var(--radius-pill)] px-4 py-1.5 text-xs font-medium text-[color:var(--text-soft)] hover:text-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <article className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="micro-label">{formatDate(entry.entry_date)}</span>
            {perfume && (
              <Link
                href={`/perfumes/${perfume.manufacturer?.slug ?? ""}/${perfume.slug}`}
                className="text-xs text-[color:var(--text-soft)] hover:text-[color:var(--accent-strong)]"
              >
                {perfume.manufacturer?.name} · {perfume.name} ↗
              </Link>
            )}
          </div>

          {entry.title && (
            <h3
              className={cn(
                "font-display leading-tight text-[color:var(--text)]",
                compact ? "text-lg" : "text-2xl",
              )}
            >
              {entry.title}
            </h3>
          )}

          <p
            className={cn(
              "whitespace-pre-wrap text-[color:var(--text)] leading-relaxed",
              compact ? "text-sm" : "text-base",
            )}
          >
            {entry.body}
          </p>

          {error && <p className="text-sm text-[color:var(--accent-strong)]">{error}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {isConfirmingDelete ? (
              <>
                <span className="text-xs text-[color:var(--text-soft)]">
                  Delete this entry?
                </span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="rounded-[var(--radius-pill)] border border-[color:var(--line)] px-3 py-1 text-xs font-medium text-[color:var(--accent-strong)] hover:border-[color:var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isPending ? "Deleting..." : "Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  disabled={isPending}
                  className="rounded-[var(--radius-pill)] px-3 py-1 text-xs font-medium text-[color:var(--text-soft)] hover:text-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={openEditor}
                  disabled={isPending}
                  className="rounded-[var(--radius-pill)] border border-[color:var(--line)] px-3 py-1 text-xs font-medium text-[color:var(--text-soft)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  disabled={isPending}
                  className="rounded-[var(--radius-pill)] px-3 py-1 text-xs font-medium text-[color:var(--text-soft)] hover:text-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </article>
      )}
    </Card>
  );
}
