"use client";

import { useEffect, useId, useRef, useState } from "react";

type Result = {
  id: number;
  name: string;
  slug: string;
  manufacturer: { id: number; name: string; slug: string } | null;
};

export function PerfumePicker() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selected, setSelected] = useState<Result | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listId = useId();

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const runSearch = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = value.trim();
    if (!trimmed) {
      abortRef.current?.abort();
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(
          `/api/catalog/search?q=${encodeURIComponent(trimmed)}`,
          { cache: "no-store", signal: ctrl.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as Result[];
        setResults(data);
        setActiveIndex(0);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setIsSearching(false);
      }
    }, 150);
  };

  const onChange = (value: string) => {
    setQ(value);
    if (selected) setSelected(null);
    setOpen(true);
    runSearch(value);
  };

  const pick = (row: Result) => {
    setSelected(row);
    setQ("");
    setResults([]);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (results[activeIndex]) {
        e.preventDefault();
        pick(results[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && q.trim().length > 0;
  const showEmpty = showList && !isSearching && results.length === 0;

  return (
    <label className="flex flex-col gap-2">
      <span className="micro-label">Perfume</span>

      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 py-2.5">
          <div className="flex flex-col">
            <span className="font-medium">{selected.name}</span>
            <span className="text-xs text-[color:var(--text-soft)]">
              {selected.manufacturer?.name ?? "—"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="text-sm text-[color:var(--text-soft)] hover:text-[color:var(--text)]"
            aria-label="Clear selection"
          >
            ×
          </button>
        </div>
      ) : (
        <div ref={rootRef} className="relative">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            value={q}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => q.trim() && setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search by perfume or house…"
            className="h-11 w-full rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 focus:border-[color:var(--accent)] focus:outline-none"
          />
          {showList && (
            <ul
              id={listId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-auto rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] shadow-lg"
            >
              {isSearching && results.length === 0 && (
                <li className="px-4 py-3 text-xs text-[color:var(--text-soft)]">
                  Searching…
                </li>
              )}
              {results.map((r, i) => (
                <li
                  key={r.id}
                  role="option"
                  aria-selected={i === activeIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(r);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex cursor-pointer flex-col px-4 py-2.5 ${
                    i === activeIndex
                      ? "bg-[color:var(--surface)]"
                      : "hover:bg-[color:var(--surface)]"
                  }`}
                >
                  <span className="text-sm font-medium">{r.name}</span>
                  <span className="text-xs text-[color:var(--text-soft)]">
                    {r.manufacturer?.name ?? "—"}
                  </span>
                </li>
              ))}
              {showEmpty && (
                <li className="px-4 py-3 text-xs text-[color:var(--text-soft)]">
                  Nothing in the catalog matches that. Import it first from
                  the Perfumes page.
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      <input
        type="hidden"
        name="perfume_id"
        value={selected?.id ?? ""}
        required
      />
    </label>
  );
}
