"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Listing = {
  id: number;
  retailer: { name: string } | null;
  source_description: string | null;
};

type Props = {
  listings: Listing[];
};

export function SourceDescriptionTabs({ listings }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (listings.length === 0) return null;

  const safeIndex = Math.min(activeIndex, listings.length - 1);
  const active = listings[safeIndex];

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Source descriptions"
        className="flex flex-wrap border-b border-[color:var(--line)]"
      >
        {listings.map((listing, i) => {
          const isActive = i === safeIndex;
          return (
            <button
              key={listing.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveIndex(i)}
              className={cn(
                "micro-label px-3 py-2 -mb-px border-b-2 transition-colors duration-[160ms]",
                isActive
                  ? "border-[color:var(--accent-strong)] text-[color:var(--text)]"
                  : "border-transparent text-[color:var(--text-soft)] hover:text-[color:var(--text)]",
              )}
            >
              {listing.retailer?.name ?? "Source"}
            </button>
          );
        })}
      </div>

      {active.source_description && (
        <div
          role="tabpanel"
          className="prose prose-sm max-w-none text-[color:var(--text-soft)] leading-relaxed [&_p]:my-2 [&_li]:my-1"
          dangerouslySetInnerHTML={{ __html: active.source_description }}
        />
      )}
    </div>
  );
}
