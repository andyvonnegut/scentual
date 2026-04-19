"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Card } from "@/components/brand/Card";
import { Chip } from "@/components/brand/Chip";
import { SectionHeader } from "@/components/brand/SectionHeader";
import {
  buildBrowseSearchParams,
  normalizeBrowseQuery,
  type BrowseFilterState,
  type BrowseManufacturerOption,
  type BrowseNoteFilter,
  type BrowseNoteOption,
  type BrowseSearchResponse,
} from "@/lib/browse";
import { cn } from "@/lib/utils";

const INPUT_CLASS =
  "h-11 w-full rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 text-[color:var(--text)] placeholder:text-[color:var(--text-soft)] focus:border-[color:var(--accent)] focus:outline-none";

const LIST_CLASS =
  "absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-auto rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] shadow-lg";

function useCloseOnOutsideClick<T extends HTMLElement>(setOpen: (open: false) => void) {
  const rootRef = useRef<T | null>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [setOpen]);

  return rootRef;
}

function HouseCombobox({
  manufacturers,
  manufacturerSlug,
  onChange,
}: {
  manufacturers: BrowseManufacturerOption[];
  manufacturerSlug: string;
  onChange: (nextSlug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useCloseOnOutsideClick<HTMLDivElement>(setOpen);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  const selected =
    manufacturers.find((manufacturer) => manufacturer.slug === manufacturerSlug) ??
    null;
  const filtered = query.trim()
    ? manufacturers.filter((manufacturer) =>
        manufacturer.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : manufacturers;
  const clampedActiveIndex = Math.min(
    activeIndex,
    Math.max(filtered.length - 1, 0),
  );
  const showList = open && !selected && filtered.length > 0;
  const showEmpty = open && !selected && query.trim().length > 0 && filtered.length === 0;

  const pick = (manufacturer: BrowseManufacturerOption) => {
    onChange(manufacturer.slug);
    setQuery("");
    setActiveIndex(0);
    setOpen(false);
  };

  return (
    <label className="flex flex-col gap-2">
      <span className="micro-label">House</span>

      {selected ? (
        <div className="flex h-11 items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{selected.name}</span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--text-soft)]">
              Selected house
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setQuery("");
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="text-sm text-[color:var(--text-soft)] hover:text-[color:var(--text)]"
            aria-label="Clear house filter"
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
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                setOpen(true);
                return;
              }

              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) =>
                  Math.min(index + 1, Math.max(filtered.length - 1, 0)),
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter") {
                if (filtered[clampedActiveIndex]) {
                  event.preventDefault();
                  pick(filtered[clampedActiveIndex]);
                }
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Type to filter houses..."
            className={INPUT_CLASS}
          />

          {(showList || showEmpty) && (
            <ul id={listId} role="listbox" className={LIST_CLASS}>
              {filtered.map((manufacturer, index) => (
                <li
                  key={manufacturer.id}
                  role="option"
                  aria-selected={index === clampedActiveIndex}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(manufacturer);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "cursor-pointer px-4 py-2.5 text-sm",
                    index === clampedActiveIndex
                      ? "bg-[color:var(--surface)]"
                      : "hover:bg-[color:var(--surface)]",
                  )}
                >
                  {manufacturer.name}
                </li>
              ))}
              {showEmpty && (
                <li className="px-4 py-3 text-xs text-[color:var(--text-soft)]">
                  No house matches that search.
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </label>
  );
}

function NotesCombobox({
  selected,
  options,
  onChange,
}: {
  selected: BrowseNoteFilter[];
  options: BrowseNoteOption[];
  onChange: (next: BrowseNoteFilter[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useCloseOnOutsideClick<HTMLDivElement>(setOpen);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = useId();

  const selectedKeys = new Set(selected.map((note) => note.slug));
  const available = options.filter((option) => !selectedKeys.has(option.slug));
  const filtered = query.trim()
    ? available.filter((option) =>
        option.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : available;
  const clampedActiveIndex = Math.min(
    activeIndex,
    Math.max(filtered.length - 1, 0),
  );
  const showList = open && filtered.length > 0;
  const showEmpty = open && query.trim().length > 0 && filtered.length === 0;

  const pick = (option: BrowseNoteOption) => {
    onChange([...selected, { slug: option.slug, name: option.name }]);
    setQuery("");
    setActiveIndex(0);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="micro-label">Notes</span>

      <div className="flex flex-wrap items-center gap-1.5">
        {selected.map((note) => {
          const key = note.slug;
          return (
            <button
              key={key}
              type="button"
              onClick={() =>
                onChange(
                  selected.filter((selectedNote) => selectedNote.slug !== key),
                )
              }
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-[color:var(--accent)]/40 bg-[color:var(--surface)] px-3 py-1 text-xs text-[color:var(--accent-strong)] transition-colors hover:bg-[color:var(--accent)] hover:text-white",
              )}
              title="Remove note filter"
            >
              <span>{note.name ?? note.slug}</span>
              <span className="opacity-60">×</span>
            </button>
          );
        })}

        <div ref={rootRef} className="relative min-w-56 flex-1">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                setOpen(true);
                return;
              }

              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) =>
                  Math.min(index + 1, Math.max(filtered.length - 1, 0)),
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter") {
                if (filtered[clampedActiveIndex]) {
                  event.preventDefault();
                  pick(filtered[clampedActiveIndex]);
                }
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Type to add note filters..."
            className={INPUT_CLASS}
          />

          {(showList || showEmpty) && (
            <ul id={listId} role="listbox" className={LIST_CLASS}>
              {filtered.map((option, index) => (
                <li
                  key={option.id}
                  role="option"
                  aria-selected={index === clampedActiveIndex}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    pick(option);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5",
                    index === clampedActiveIndex
                      ? "bg-[color:var(--surface)]"
                      : "hover:bg-[color:var(--surface)]",
                  )}
                >
                  <span className="text-sm">{option.name}</span>
                </li>
              ))}
              {showEmpty && (
                <li className="px-4 py-3 text-xs text-[color:var(--text-soft)]">
                  No notes match that search.
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export function BrowseClient({
  initialState,
  initialResponse,
  manufacturers,
  noteOptions,
}: {
  initialState: BrowseFilterState;
  initialResponse: BrowseSearchResponse;
  manufacturers: BrowseManufacturerOption[];
  noteOptions: BrowseNoteOption[];
}) {
  const initialResponseRef = useRef(initialResponse);
  const initialKeyRef = useRef(buildBrowseSearchParams(initialState).toString());
  const abortRef = useRef<AbortController | null>(null);

  const [q, setQ] = useState(initialState.q ?? "");
  const [manufacturerSlug, setManufacturerSlug] = useState(
    initialState.manufacturerSlug ?? "",
  );
  const [selectedNotes, setSelectedNotes] = useState(initialState.notes ?? []);
  const [response, setResponse] = useState(initialResponse);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestParams = useMemo(
    () =>
      buildBrowseSearchParams({
        q,
        manufacturerSlug,
        notes: selectedNotes,
      }),
    [manufacturerSlug, q, selectedNotes],
  );
  const requestKey = requestParams.toString();
  const href = requestKey ? `/browse?${requestKey}` : "/browse";
  const cleanedQuery = normalizeBrowseQuery(q);
  const activeManufacturer =
    manufacturers.find((manufacturer) => manufacturer.slug === manufacturerSlug) ??
    null;
  const hasActiveFilters =
    cleanedQuery.length > 0 || manufacturerSlug.length > 0 || selectedNotes.length > 0;

  useEffect(() => {
    window.history.replaceState(null, "", href);
  }, [href]);

  useEffect(() => {
    abortRef.current?.abort();

    if (requestKey === initialKeyRef.current) {
      setResponse(initialResponseRef.current);
      setError(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/catalog/browse?${requestKey}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Browse request failed with ${res.status}`);
        }

        const data = (await res.json()) as BrowseSearchResponse;
        setResponse(data);
        setError(null);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError("Could not update the browse results.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey]);

  const summaryParts = [];
  if (cleanedQuery) summaryParts.push(`matching “${cleanedQuery}”`);
  if (activeManufacturer) summaryParts.push(activeManufacturer.name);
  if (selectedNotes.length > 0) {
    summaryParts.push(
      `${selectedNotes.length} note filter${selectedNotes.length === 1 ? "" : "s"}`,
    );
  }

  const countCopy =
    response.total > response.results.length
      ? `Showing ${response.results.length} of ${response.total} results`
      : `${response.total} ${response.total === 1 ? "result" : "results"}`;

  return (
    <div className="flex flex-col gap-10">
      <SectionHeader title="The catalog">
        <div className="flex flex-col gap-1 text-base text-[color:var(--text-soft)]">
          <p>
            {countCopy}
            {summaryParts.length > 0 ? ` · ${summaryParts.join(" · ")}` : ""}
            {isLoading ? " · Updating..." : ""}
          </p>
          <p className="text-sm">
            Live search matches perfume names, houses, and notes from either
            store data or your personal note attachments.
          </p>
          {error && <p className="text-sm text-[color:var(--warning)]">{error}</p>}
        </div>
      </SectionHeader>

      <Card>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="micro-label">Search</span>
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Type any perfume, house, or note words..."
              className={INPUT_CLASS}
            />
          </label>

          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[280px_minmax(0,1fr)_auto] lg:items-start">
            <HouseCombobox
              manufacturers={manufacturers}
              manufacturerSlug={manufacturerSlug}
              onChange={setManufacturerSlug}
            />
            <NotesCombobox
              selected={selectedNotes}
              options={noteOptions}
              onChange={setSelectedNotes}
            />
            <div className="flex lg:pt-6">
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setManufacturerSlug("");
                  setSelectedNotes([]);
                }}
                disabled={!hasActiveFilters}
                className="h-11 rounded-[var(--radius-md)] border border-[color:var(--line)] px-4 text-sm text-[color:var(--text-soft)] transition-colors hover:text-[color:var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      </Card>

      {response.results.length === 0 ? (
        <Card className="text-[color:var(--text-soft)]">
          <p className="text-sm">No perfumes match those filters.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {response.results.map((perfume) => (
            <Link
              key={perfume.id}
              href={`/perfumes/${perfume.manufacturer?.slug ?? ""}/${perfume.slug}`}
              className="block"
            >
              <Card>
                <div className="flex flex-col gap-3">
                  <span className="micro-label">
                    {perfume.manufacturer?.name ?? "—"}
                  </span>
                  <h3 className="font-display text-2xl leading-tight">
                    {perfume.name}
                  </h3>
                  {perfume.perfume_notes && perfume.perfume_notes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {perfume.perfume_notes.slice(0, 6).map((perfumeNote, index) =>
                        perfumeNote.note ? (
                          <Chip key={index} variant="store" size="sm">
                            {perfumeNote.note.name}
                          </Chip>
                        ) : null,
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
