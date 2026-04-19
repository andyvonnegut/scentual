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
              <BottleSpray filled={isFilled} size={puffSize} />
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

const BOTTLE_PATH =
  "M 4.3 5.5 L 8.7 5.5 Q 9 5.5 9 5.8 L 9 7.5 L 7.5 7.5 L 7.5 9 L 10 11 L 10 18.5 Q 10 19.5 9 19.5 L 4 19.5 Q 3 19.5 3 18.5 L 3 11 L 5.5 9 L 5.5 7.5 L 4 7.5 L 4 5.8 Q 4 5.5 4.3 5.5 Z";
const CLOUD_PATH =
  "M 11.6 8.6 C 10.5 8.6 10.5 7 11.8 6.8 C 11.8 5.5 13 5 14 5.6 C 14.5 3.6 17 3.6 17.8 5.1 C 19 4.6 20 5.6 19.8 7 C 21 7.5 20 9 18.5 8.6 L 11.6 8.6 Z";

function BottleSpray({ filled, size }: { filled: boolean; size: number }) {
  if (filled) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="text-[color:var(--accent)] transition-colors duration-[160ms]"
      >
        <path d={BOTTLE_PATH} fill="currentColor" />
        <path d={CLOUD_PATH} fill="currentColor" />
        <circle cx="10" cy="6.8" r="0.45" fill="currentColor" />
        <circle cx="11" cy="7.3" r="0.35" fill="currentColor" />
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
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[color:var(--text-soft)] transition-colors duration-[160ms] hover:text-[color:var(--accent)]"
    >
      <path d={BOTTLE_PATH} />
      <path d={CLOUD_PATH} />
    </svg>
  );
}
