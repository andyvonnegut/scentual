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
  "M 14 4 Q 15.3 4 15.3 5.2 Q 15 5.8 14.5 6 L 14.5 6.8 Q 18.5 7.5 18.5 12 Q 18 16 17 20 Q 17 21 16 21.5 Q 17 21.5 17 22 L 11 22 Q 11 21.5 12 21.5 Q 11 21 11 20 Q 10 16 9.5 12 Q 9.5 7.5 13.5 6.8 L 13.5 6 Q 13 5.8 12.7 5.2 Q 12.7 4 14 4 Z";
const TUBE_PATH = "M 12.5 5 C 3 2, 0 12, 5.5 17.3";
const CLOUD_PATH =
  "M 15.5 4 C 15.5 1.8, 17.2 0.8, 18.3 2 C 19.3 0.3, 21 0.5, 21.3 2.3 C 22.5 1.8, 23.3 3, 23 4.7 C 23.8 5.2, 23.2 7.3, 21.6 6.8 C 21.3 8, 19 8, 18.7 6.3 C 18.2 7, 16.6 7, 16.2 5.7 C 15.3 5.7, 15.2 4.6, 15.5 4 Z";

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
        <ellipse cx="4" cy="18.5" rx="2" ry="1.3" fill="currentColor" />
        <path
          d={TUBE_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path d={CLOUD_PATH} fill="currentColor" />
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
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-[color:var(--text-soft)] transition-colors duration-[160ms] hover:text-[color:var(--accent)]"
    >
      <path d={BOTTLE_PATH} />
      <ellipse cx="4" cy="18.5" rx="2" ry="1.3" />
      <path d={TUBE_PATH} />
      <path d={CLOUD_PATH} />
    </svg>
  );
}
