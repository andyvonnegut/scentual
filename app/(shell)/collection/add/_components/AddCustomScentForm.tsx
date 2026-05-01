"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/brand/Button";
import {
  createUserPerfume,
  type ListKind,
} from "@/app/actions/user-perfumes";
import {
  toggleOwned,
  toggleDesired,
  toggleSniffed,
} from "@/app/actions/library";

type ManufacturerResult = { id: number; name: string; slug: string };
type PerfumeResult = {
  id: number;
  name: string;
  slug: string;
  manufacturer: ManufacturerResult | null;
};

type SelectedHouse =
  | { kind: "existing"; row: ManufacturerResult }
  | { kind: "new"; name: string };

const LIST_KINDS: { value: ListKind; label: string }[] = [
  { value: "owned", label: "Owned" },
  { value: "desired", label: "Desired" },
  { value: "sniffed", label: "Sniffed" },
];

export function AddCustomScentForm({
  initialName,
  initialHouse,
}: {
  initialName: string;
  initialHouse: string;
}) {
  const router = useRouter();
  const [house, setHouse] = useState<SelectedHouse | null>(null);
  const [perfumeName, setPerfumeName] = useState(initialName);
  const [listKind, setListKind] = useState<ListKind>("owned");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <HouseField
        initialHouse={initialHouse}
        selected={house}
        onSelect={setHouse}
      />

      <PerfumeNameField
        disabled={!house}
        manufacturerId={house?.kind === "existing" ? house.row.id : null}
        value={perfumeName}
        onChange={setPerfumeName}
        listKind={listKind}
      />

      <ListKindPicker value={listKind} onChange={setListKind} />

      {error && (
        <p className="text-sm text-[color:var(--accent-strong)]">{error}</p>
      )}

      <div className="flex justify-end">
        <Button
          variant="primary"
          disabled={!house || !perfumeName.trim() || isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await createUserPerfume({
                manufacturerId:
                  house?.kind === "existing" ? house.row.id : null,
                manufacturerName:
                  house?.kind === "new" ? house.name : null,
                perfumeName,
                listKind,
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.push(result.redirectTo);
            });
          }}
        >
          {isPending ? "Adding…" : "Add to collection"}
        </Button>
      </div>
    </div>
  );
}

function HouseField({
  initialHouse,
  selected,
  onSelect,
}: {
  initialHouse: string;
  selected: SelectedHouse | null;
  onSelect: (s: SelectedHouse | null) => void;
}) {
  const [q, setQ] = useState(initialHouse);
  const [results, setResults] = useState<ManufacturerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

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
          `/api/manufacturers/search?q=${encodeURIComponent(trimmed)}`,
          { cache: "no-store", signal: ctrl.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as ManufacturerResult[];
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
    if (selected) onSelect(null);
    setOpen(true);
    runSearch(value);
  };

  const pickExisting = (row: ManufacturerResult) => {
    onSelect({ kind: "existing", row });
    setQ(row.name);
    setResults([]);
    setOpen(false);
  };

  const pickNew = () => {
    const trimmed = q.trim();
    if (!trimmed) return;
    onSelect({ kind: "new", name: trimmed });
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
      e.preventDefault();
      if (results[activeIndex]) {
        pickExisting(results[activeIndex]);
      } else if (q.trim()) {
        pickNew();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && q.trim().length > 0;
  const showEmpty = showList && !isSearching && results.length === 0;

  if (selected) {
    return (
      <label className="flex flex-col gap-2">
        <span className="micro-label">House</span>
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 py-2.5">
          <div className="flex flex-col">
            <span className="font-medium">
              {selected.kind === "existing" ? selected.row.name : selected.name}
            </span>
            <span className="text-xs text-[color:var(--text-soft)]">
              {selected.kind === "existing"
                ? "Existing house"
                : "New house — will be created"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setQ("");
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="text-sm text-[color:var(--text-soft)] hover:text-[color:var(--text)]"
            aria-label="Clear house"
          >
            ×
          </button>
        </div>
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-2">
      <span className="micro-label">House</span>
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
          placeholder="Search for a perfume house…"
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
                  pickExisting(r);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex cursor-pointer flex-col px-4 py-2.5 ${
                  i === activeIndex
                    ? "bg-[color:var(--surface)]"
                    : "hover:bg-[color:var(--surface)]"
                }`}
              >
                <span className="text-sm font-medium">{r.name}</span>
              </li>
            ))}
            {showEmpty && (
              <li
                role="option"
                aria-selected={false}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickNew();
                }}
                className="flex cursor-pointer flex-col gap-0.5 border-t border-[color:var(--line)] px-4 py-3 hover:bg-[color:var(--surface)]"
              >
                <span className="text-sm">
                  Add <span className="font-medium">&ldquo;{q}&rdquo;</span> as
                  a new house
                </span>
                <span className="text-xs text-[color:var(--text-soft)]">
                  Press Enter
                </span>
              </li>
            )}
          </ul>
        )}
      </div>
    </label>
  );
}

function PerfumeNameField({
  disabled,
  manufacturerId,
  value,
  onChange,
  listKind,
}: {
  disabled: boolean;
  manufacturerId: number | null;
  value: string;
  onChange: (v: string) => void;
  listKind: ListKind;
}) {
  const [results, setResults] = useState<PerfumeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!manufacturerId) {
      setResults([]);
      return;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await fetch(
          `/api/catalog/search?q=${encodeURIComponent(trimmed)}&manufacturer_id=${manufacturerId}`,
          { cache: "no-store", signal: ctrl.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as PerfumeResult[];
        setResults(data);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setIsSearching(false);
      }
    }, 200);
  }, [value, manufacturerId]);

  const addExisting = (row: PerfumeResult) => {
    startTransition(async () => {
      if (listKind === "owned") await toggleOwned(row.id, true);
      else if (listKind === "desired") await toggleDesired(row.id, true);
      else await toggleSniffed(row.id, true);
      router.push(`/collection?filter=${listKind}`);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-2">
        <span className="micro-label">Perfume name</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            disabled ? "Pick a house first" : "e.g. Aventus, Baccarat Rouge 540"
          }
          disabled={disabled}
          className="h-11 w-full rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 focus:border-[color:var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </label>

      {isSearching && (
        <p className="text-xs text-[color:var(--text-soft)]">Checking catalog…</p>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[color:var(--accent)]/40 bg-[color:var(--bg-elevated)] p-3">
          <span className="text-xs font-medium text-[color:var(--accent-strong)]">
            Already in the catalog — pick the existing one to avoid a duplicate
          </span>
          <ul className="flex flex-col divide-y divide-[color:var(--line)]">
            {results.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{r.name}</span>
                  <span className="text-xs text-[color:var(--text-soft)]">
                    {r.manufacturer?.name ?? "—"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => addExisting(r)}
                  className="rounded-[var(--radius-pill)] bg-[color:var(--accent)] px-3 py-1 text-xs font-medium text-white hover:bg-[color:var(--accent-strong)]"
                >
                  Use this
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ListKindPicker({
  value,
  onChange,
}: {
  value: ListKind;
  onChange: (v: ListKind) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="micro-label">Add to</legend>
      <div className="flex gap-2">
        {LIST_KINDS.map((k) => {
          const active = value === k.value;
          return (
            <button
              key={k.value}
              type="button"
              onClick={() => onChange(k.value)}
              className={`rounded-[var(--radius-pill)] px-4 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-[color:var(--accent)] text-white"
                  : "border border-[color:var(--line)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
              }`}
            >
              {k.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
