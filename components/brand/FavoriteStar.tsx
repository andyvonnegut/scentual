"use client";

import { useState, useTransition } from "react";
import { toggleFavorite } from "@/app/actions/library";
import { cn } from "@/lib/utils";

type Props = {
  perfumeId: number;
  initialFavorite: boolean;
  size?: "sm" | "md";
};

const STAR_PATH =
  "M12 2.6 14.9 8.5 21.4 9.4 16.7 14 17.8 20.4 12 17.4 6.2 20.4 7.3 14 2.6 9.4 9.1 8.5Z";

export function FavoriteStar({
  perfumeId,
  initialFavorite,
  size = "md",
}: Props) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const iconSize = size === "sm" ? 18 : 24;

  const handleClick = () => {
    const prev = favorite;
    const next = !prev;
    setFavorite(next);
    setError(null);
    startTransition(async () => {
      try {
        await toggleFavorite(perfumeId, next);
      } catch {
        setFavorite(prev);
        setError("Couldn't save favorite");
      }
    });
  };

  return (
    <button
      type="button"
      aria-pressed={favorite}
      aria-label={favorite ? "Remove favorite" : "Mark as favorite"}
      title={error ?? (favorite ? "Favorite" : "Mark as favorite")}
      disabled={isPending}
      onClick={handleClick}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full transition-all duration-[160ms] disabled:opacity-60",
        "p-1 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]",
      )}
    >
      {favorite ? (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="text-[color:var(--accent)] transition-colors duration-[160ms]"
        >
          <path d={STAR_PATH} fill="currentColor" />
        </svg>
      ) : (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[color:var(--text-soft)] transition-colors duration-[160ms] hover:text-[color:var(--accent)]"
        >
          <path d={STAR_PATH} />
        </svg>
      )}
    </button>
  );
}
