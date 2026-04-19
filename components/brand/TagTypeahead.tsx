"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

type Ref = { id: number; name: string; slug?: string };

export function TagTypeahead({
  label,
  placeholder,
  listId,
  variant,
  attached,
  suggestions,
  onAdd,
  onRemove,
}: {
  label: string;
  placeholder?: string;
  listId: string;
  variant: "fragrance-note" | "theme";
  attached: Ref[];
  suggestions: Ref[];
  onAdd: (name: string) => Promise<void>;
  onRemove: (tagId: number) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const attachedNames = new Set(attached.map((a) => a.name.toLowerCase()));
  const available = suggestions.filter(
    (s) => !attachedNames.has(s.name.toLowerCase()),
  );

  const q = value.trim().toLowerCase();
  const filtered = q
    ? available.filter((s) => s.name.toLowerCase().includes(q))
    : available;
  const clampedActiveIndex = Math.min(
    activeIndex,
    Math.max(filtered.length - 1, 0),
  );

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const submit = (name?: string) => {
    const v = (name ?? value).trim();
    if (!v) return;
    startTransition(() => onAdd(v));
    setValue("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[clampedActiveIndex]) {
        submit(filtered[clampedActiveIndex].name);
      } else {
        submit();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const pillStyles =
    variant === "fragrance-note"
      ? "bg-[color:var(--surface)] text-[color:var(--accent-strong)] border-[color:var(--accent)]/40 hover:bg-[color:var(--accent)] hover:text-white"
      : "bg-[color:var(--surface-2)] text-[color:var(--text)] border-[color:var(--text)]/15 hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]";

  const showList = open && filtered.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <span className="micro-label">{label}</span>

      <div className="flex flex-wrap items-center gap-1.5">
        {attached.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => onRemove(t.id))}
            className={cn(
              "group inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-all disabled:opacity-60",
              pillStyles,
            )}
            title="Remove tag"
          >
            <span>{t.name}</span>
            <span className="opacity-50 group-hover:opacity-100">×</span>
          </button>
        ))}

        <div ref={rootRef} className="relative flex-1 min-w-40">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setActiveIndex(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? "Type to add…"}
            className="h-8 w-full rounded-full border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-3 text-xs focus:border-[color:var(--accent)] focus:outline-none"
          />
          {showList && (
            <ul
              id={listId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-auto rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] shadow-lg"
            >
              {filtered.map((s, i) => (
                <li
                  key={s.id}
                  role="option"
                  aria-selected={i === clampedActiveIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    submit(s.name);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`cursor-pointer px-3 py-2 text-xs ${
                    i === clampedActiveIndex
                      ? "bg-[color:var(--surface)]"
                      : "hover:bg-[color:var(--surface)]"
                  }`}
                >
                  {s.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
