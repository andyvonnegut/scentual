"use client";

import { useTransition } from "react";
import { cn } from "@/lib/utils";
import {
  attachFragranceNoteTag,
  attachGenericTag,
  detachFragranceNoteTag,
  detachGenericTag,
} from "@/app/actions/tags";

type Tag = { id: number; name: string; slug: string };

export function TagManager({
  personalPerfumeId,
  allFragranceTags,
  allGenericTags,
  attachedFragranceTagIds,
  attachedGenericTagIds,
}: {
  personalPerfumeId: number;
  allFragranceTags: Tag[];
  allGenericTags: Tag[];
  attachedFragranceTagIds: number[];
  attachedGenericTagIds: number[];
}) {
  const [isPending, startTransition] = useTransition();

  const togglePill = (
    attached: boolean,
    tag: Tag,
    attachFn: (id: number, tid: number) => Promise<void>,
    detachFn: (id: number, tid: number) => Promise<void>,
    variant: "fragrance-note" | "generic",
  ) => (
    <button
      key={`${variant}-${tag.id}`}
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() =>
          attached
            ? detachFn(personalPerfumeId, tag.id)
            : attachFn(personalPerfumeId, tag.id),
        )
      }
      className={cn(
        "rounded-[var(--radius-pill)] border px-3 py-0.5 text-xs transition-all disabled:opacity-60",
        attached
          ? variant === "fragrance-note"
            ? "bg-[color:var(--surface)] border-[color:var(--accent)]/40 text-[color:var(--accent-strong)]"
            : "bg-[color:var(--surface-2)] border-[color:var(--text)]/20 text-[color:var(--text)]"
          : "bg-transparent border-[color:var(--line)] text-[color:var(--text-soft)] hover:border-[color:var(--accent)]",
      )}
    >
      {attached ? "✓ " : "+ "}
      {tag.name}
    </button>
  );

  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs text-[color:var(--text-soft)] hover:text-[color:var(--accent-strong)]">
        Manage tags <span className="group-open:hidden">▸</span>
        <span className="hidden group-open:inline">▾</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        {allFragranceTags.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="micro-label">Fragrance notes</span>
            <div className="flex flex-wrap gap-1">
              {allFragranceTags.map((t) =>
                togglePill(
                  attachedFragranceTagIds.includes(t.id),
                  t,
                  attachFragranceNoteTag,
                  detachFragranceNoteTag,
                  "fragrance-note",
                ),
              )}
            </div>
          </div>
        )}
        {allGenericTags.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="micro-label">Generic</span>
            <div className="flex flex-wrap gap-1">
              {allGenericTags.map((t) =>
                togglePill(
                  attachedGenericTagIds.includes(t.id),
                  t,
                  attachGenericTag,
                  detachGenericTag,
                  "generic",
                ),
              )}
            </div>
          </div>
        )}
        {allFragranceTags.length === 0 && allGenericTags.length === 0 && (
          <p className="text-xs text-[color:var(--text-soft)]">
            No tags in your libraries yet. Create some on the Tags page.
          </p>
        )}
      </div>
    </details>
  );
}
