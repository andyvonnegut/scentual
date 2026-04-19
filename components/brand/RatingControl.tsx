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
  "M 10 1.8 C 11.5 1.8, 11.5 4, 10.5 4.2 L 10.5 5.5 L 11.5 5.5 L 11.5 7 L 10.5 7 C 14 8, 14.5 13, 13 18 C 12.5 20, 11 21, 11 21.7 L 12.5 21.7 L 12.5 22.5 L 7.5 22.5 L 7.5 21.7 L 9 21.7 C 9 21, 7.5 20, 7 18 C 5.5 13, 6 8, 9.5 7 L 8.5 7 L 8.5 5.5 L 9.5 5.5 L 9.5 4.2 C 8.5 4, 8.5 1.8, 10 1.8 Z";
const TUBE_PATH = "M 8.5 6.3 C 4 2, 0 11, 2.5 17";
const CLOUD_PATH =
  "M 15 3.5 Q 14.8 1.8, 16 1.7 Q 16.7 0.5, 17.7 1.2 Q 18.5 0.3, 19.5 1.3 Q 20.3 0.5, 21 1.8 Q 22 1.5, 22 3 Q 22.7 3.5, 22 4.5 Q 22.5 5.8, 21.2 5.5 Q 20.5 6.5, 19.2 5.8 Q 18 6.8, 17 5.5 Q 15.5 6.3, 15 5 Q 14.3 4.3, 15 3.5 Z";
const SPRAY_PATH =
  "M 11.5 2.3 L 14.5 2.7 M 11.5 2.8 L 14.8 3.5 M 11.5 3.4 L 14.5 4.3";

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
        <ellipse cx="2.5" cy="18" rx="1.5" ry="1" fill="currentColor" />
        <path
          d={TUBE_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path d={CLOUD_PATH} fill="currentColor" />
        <path
          d={SPRAY_PATH}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
        />
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
      <ellipse cx="2.5" cy="18" rx="1.5" ry="1" />
      <path d={TUBE_PATH} />
      <path d={CLOUD_PATH} />
      <path d={SPRAY_PATH} strokeWidth="1" />
    </svg>
  );
}
