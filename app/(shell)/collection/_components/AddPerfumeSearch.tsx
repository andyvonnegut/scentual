"use client";

import { useState, useTransition } from "react";
import { toggleOwned, toggleDesired, toggleSniffed } from "@/app/actions/library";

type Result = {
  id: number;
  name: string;
  slug: string;
  manufacturer: { id: number; name: string; slug: string } | null;
};

export function AddPerfumeSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [, startTransition] = useTransition();

  async function runSearch(value: string) {
    if (!value.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    const res = await fetch(
      `/api/catalog/search?q=${encodeURIComponent(value)}`,
      { cache: "no-store" },
    );
    if (res.ok) {
      const data = (await res.json()) as Result[];
      setResults(data);
    }
    setIsSearching(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-2">
        <span className="micro-label">Add from catalog</span>
        <input
          type="search"
          value={q}
          onChange={(e) => {
            const v = e.target.value;
            setQ(v);
            runSearch(v);
          }}
          placeholder="Search by perfume name"
          className="h-11 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 focus:border-[color:var(--accent)] focus:outline-none"
        />
      </label>
      {isSearching && (
        <p className="text-xs text-[color:var(--text-soft)]">Searching…</p>
      )}
      {results.length > 0 && (
        <ul className="flex flex-col divide-y divide-[color:var(--line)] rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)]">
          {results.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-[color:var(--text-soft)]">
                  {r.manufacturer?.name ?? "—"}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() => toggleOwned(r.id, true))
                  }
                  className="rounded-[var(--radius-pill)] bg-[color:var(--accent)] px-3 py-1 text-xs font-medium text-white hover:bg-[color:var(--accent-strong)]"
                >
                  + Owned
                </button>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() => toggleDesired(r.id, true))
                  }
                  className="rounded-[var(--radius-pill)] border border-[color:var(--line)] px-3 py-1 text-xs font-medium hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
                >
                  + Desired
                </button>
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() => toggleSniffed(r.id, true))
                  }
                  className="rounded-[var(--radius-pill)] border border-[color:var(--line)] px-3 py-1 text-xs font-medium hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
                >
                  + Sniffed
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
