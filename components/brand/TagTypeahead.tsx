"use client";

import { useRef, useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const attachedNames = new Set(attached.map((a) => a.name.toLowerCase()));
  const available = suggestions.filter(
    (s) => !attachedNames.has(s.name.toLowerCase()),
  );

  const submit = () => {
    const v = value.trim();
    if (!v) return;
    startTransition(() => onAdd(v));
    setValue("");
    inputRef.current?.focus();
  };

  const pillStyles =
    variant === "fragrance-note"
      ? "bg-[color:var(--surface)] text-[color:var(--accent-strong)] border-[color:var(--accent)]/40 hover:bg-[color:var(--accent)] hover:text-white"
      : "bg-[color:var(--surface-2)] text-[color:var(--text)] border-[color:var(--text)]/15 hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]";

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

        <input
          ref={inputRef}
          list={listId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder ?? "Type to add…"}
          className="h-8 min-w-40 flex-1 rounded-full border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-3 text-xs focus:border-[color:var(--accent)] focus:outline-none"
        />
        <datalist id={listId}>
          {available.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
