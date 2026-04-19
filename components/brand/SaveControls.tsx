"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { toggleCollection, toggleWanted } from "@/app/actions/library";

export function SaveControls({
  perfumeId,
  initialInCollection,
  initialInWanted,
  compact = false,
}: {
  perfumeId: number;
  initialInCollection: boolean;
  initialInWanted: boolean;
  compact?: boolean;
}) {
  const [inCollection, setInCollection] = useState(initialInCollection);
  const [inWanted, setInWanted] = useState(initialInWanted);
  const [isPending, startTransition] = useTransition();

  const handleCollection = () => {
    const next = !inCollection;
    setInCollection(next);
    startTransition(() => toggleCollection(perfumeId, next));
  };
  const handleWanted = () => {
    const next = !inWanted;
    setInWanted(next);
    startTransition(() => toggleWanted(perfumeId, next));
  };

  const base =
    "rounded-[var(--radius-pill)] border transition-all text-sm font-medium disabled:opacity-60";
  const sizing = compact ? "px-3 py-1 text-xs" : "px-5 py-2";
  const active =
    "bg-[color:var(--accent)] border-[color:var(--accent)] text-white hover:bg-[color:var(--accent-strong)]";
  const inactive =
    "bg-transparent border-[color:var(--line)] text-[color:var(--text)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]";

  return (
    <div className={cn("flex gap-2", compact ? "flex-row" : "flex-wrap")}>
      <button
        type="button"
        disabled={isPending}
        onClick={handleCollection}
        className={cn(base, sizing, inCollection ? active : inactive)}
      >
        {inCollection ? "✓ In Collection" : "Add to Collection"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={handleWanted}
        className={cn(base, sizing, inWanted ? active : inactive)}
      >
        {inWanted ? "✓ In Wanted" : "Add to Wanted"}
      </button>
    </div>
  );
}
