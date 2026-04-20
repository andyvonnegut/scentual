import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LibraryFilter } from "@/lib/queries/library";

const TABS: { value: LibraryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "owned", label: "Owned" },
  { value: "desired", label: "Desired" },
  { value: "sniffed", label: "Sniffed" },
];

export function LibraryFilterTabs({ active }: { active: LibraryFilter }) {
  return (
    <div
      role="tablist"
      aria-label="Library filter"
      className="flex flex-wrap border-b border-[color:var(--line)]"
    >
      {TABS.map((t) => {
        const isActive = t.value === active;
        const href =
          t.value === "all" ? "/collection" : `/collection?filter=${t.value}`;
        return (
          <Link
            key={t.value}
            href={href}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "micro-label px-3 py-2 -mb-px border-b-2 transition-colors duration-[160ms]",
              isActive
                ? "border-[color:var(--accent-strong)] font-semibold text-[color:var(--accent-strong)]"
                : "border-transparent text-[color:var(--text-soft)] hover:text-[color:var(--text)]",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
