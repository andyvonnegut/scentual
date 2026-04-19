"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { setRating } from "@/app/actions/library";

type Props = {
  perfumeId: number;
  initialRating: number | null;
  size?: "sm" | "md";
  showLabel?: boolean;
};

const PUFF_COUNT = 5;

export function RatingControl({
  perfumeId,
  initialRating,
  size = "md",
  showLabel = true,
}: Props) {
  const [rating, setLocalRating] = useState<number | null>(initialRating);
  const [hover, setHover] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const active = hover ?? rating ?? 0;
  const puffSize = size === "sm" ? 18 : 24;
  const gap = size === "sm" ? "gap-0.5" : "gap-1";

  const handleClick = (value: number) => {
    const prev = rating;
    const next = prev === value ? null : value;
    setLocalRating(next);
    setError(null);
    startTransition(async () => {
      try {
        await setRating(perfumeId, next);
      } catch {
        setLocalRating(prev);
        setError("Couldn't save rating");
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <div
        role="radiogroup"
        aria-label="Rating"
        className={cn("flex items-center", gap)}
        onMouseLeave={() => setHover(null)}
      >
        {Array.from({ length: PUFF_COUNT }, (_, i) => i + 1).map((value) => {
          const isFilled = value <= active;
          const isSelected = rating === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Rate ${value} out of 5`}
              disabled={isPending}
              onMouseEnter={() => setHover(value)}
              onFocus={() => setHover(value)}
              onBlur={() => setHover(null)}
              onClick={() => handleClick(value)}
              className={cn(
                "relative grid place-items-center rounded-full transition-all duration-[160ms] disabled:opacity-60",
                "p-1 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]",
              )}
            >
              <Puff filled={isFilled} size={puffSize} />
            </button>
          );
        })}
      </div>
      {showLabel && (
        <span className="text-xs text-[color:var(--text-soft)] tabular-nums">
          {error
            ? error
            : rating != null
              ? `${rating} / 5`
              : "Rate this scent"}
        </span>
      )}
    </div>
  );
}

function Puff({ filled, size }: { filled: boolean; size: number }) {
  if (filled) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="text-[color:var(--accent)] transition-colors duration-[160ms]"
      >
        <path
          d="M7.5 11.2A3.2 3.2 0 0 1 10.7 8a3.2 3.2 0 0 1 3-2 3.3 3.3 0 0 1 3.2 2.6 2.8 2.8 0 0 1 2.1 2.7 2.8 2.8 0 0 1-2.8 2.8H7.3A2.8 2.8 0 0 1 4.5 11a2.8 2.8 0 0 1 3-2.6z"
          fill="currentColor"
        />
        <circle cx="9" cy="17.5" r="0.9" fill="currentColor" />
        <circle cx="12.5" cy="19.2" r="0.8" fill="currentColor" />
        <circle cx="15.8" cy="17.8" r="0.7" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[color:var(--text-soft)] transition-colors duration-[160ms] hover:text-[color:var(--accent)]"
    >
      <path d="M3.5 13c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 5 0" />
    </svg>
  );
}
