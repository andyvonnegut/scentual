"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { toggleOwned, toggleDesired, toggleSniffed } from "@/app/actions/library";

export function SaveControls({
  perfumeId,
  initialInOwned,
  initialInDesired,
  initialInSniffed,
  compact = false,
}: {
  perfumeId: number;
  initialInOwned: boolean;
  initialInDesired: boolean;
  initialInSniffed: boolean;
  compact?: boolean;
}) {
  const [inOwned, setInOwned] = useState(initialInOwned);
  const [inDesired, setInDesired] = useState(initialInDesired);
  const [inSniffed, setInSniffed] = useState(initialInSniffed);
  const [isPending, startTransition] = useTransition();

  const handleOwned = () => {
    const prev = inOwned;
    const next = !prev;
    setInOwned(next);
    startTransition(async () => {
      try {
        await toggleOwned(perfumeId, next);
      } catch {
        setInOwned(prev);
      }
    });
  };

  const handleDesired = () => {
    const prev = inDesired;
    const next = !prev;
    setInDesired(next);
    startTransition(async () => {
      try {
        await toggleDesired(perfumeId, next);
      } catch {
        setInDesired(prev);
      }
    });
  };

  const handleSniffed = () => {
    const prev = inSniffed;
    const next = !prev;
    setInSniffed(next);
    startTransition(async () => {
      try {
        await toggleSniffed(perfumeId, next);
      } catch {
        setInSniffed(prev);
      }
    });
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
        onClick={handleOwned}
        className={cn(base, sizing, inOwned ? active : inactive)}
      >
        {inOwned ? "✓ Owned" : "Add to Owned"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={handleDesired}
        className={cn(base, sizing, inDesired ? active : inactive)}
      >
        {inDesired ? "✓ Desired" : "Add to Desired"}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={handleSniffed}
        className={cn(base, sizing, inSniffed ? active : inactive)}
      >
        {inSniffed ? "✓ Sniffed" : "Add to Sniffed"}
      </button>
    </div>
  );
}
