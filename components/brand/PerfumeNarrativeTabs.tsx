"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { marked } from "marked";
import { cn } from "@/lib/utils";
import { updatePersonalNarrative } from "@/app/actions/library";

type Listing = {
  id: number;
  retailer: { name: string } | null;
  source_description: string | null;
};

type Props = {
  listings: Listing[];
  isAuthed: boolean;
  perfumeId: number;
  initialNarrative: string | null;
};

// Default marked options already keep raw HTML escaped (html=false), so
// user-pasted <script> tags in markdown become literal text. This is the
// guardrail we rely on instead of a heavier sanitizer dep.
function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false, gfm: true, breaks: true }) as string;
}

export function PerfumeNarrativeTabs({
  listings,
  isAuthed,
  perfumeId,
  initialNarrative,
}: Props) {
  const sourceCount = listings.length;
  const yoursIndex = isAuthed ? sourceCount : -1;
  const totalTabs = sourceCount + (isAuthed ? 1 : 0);
  const [activeIndex, setActiveIndex] = useState(0);

  if (totalTabs === 0) return null;

  const safeIndex = Math.min(activeIndex, totalTabs - 1);
  const isYoursActive = isAuthed && safeIndex === yoursIndex;
  const activeListing = isYoursActive ? null : listings[safeIndex];

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Source descriptions"
        className="flex flex-wrap border-b border-[color:var(--line)]"
      >
        {listings.map((listing, i) => {
          const isActive = i === safeIndex && !isYoursActive;
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
        {isAuthed && (
          <button
            type="button"
            role="tab"
            aria-selected={isYoursActive}
            onClick={() => setActiveIndex(yoursIndex)}
            className={cn(
              "micro-label px-3 py-2 -mb-px border-b-2 transition-colors duration-[160ms]",
              isYoursActive
                ? "border-[color:var(--accent-strong)] text-[color:var(--text)]"
                : "border-transparent text-[color:var(--text-soft)] hover:text-[color:var(--text)]",
            )}
          >
            Yours
          </button>
        )}
      </div>

      {!isYoursActive && activeListing?.source_description && (
        <div
          role="tabpanel"
          className="prose prose-sm max-w-none text-[color:var(--text-soft)] leading-relaxed [&_p]:my-2 [&_li]:my-1"
          dangerouslySetInnerHTML={{ __html: activeListing.source_description }}
        />
      )}

      {isYoursActive && (
        <PersonalNarrativeEditor
          perfumeId={perfumeId}
          initialNarrative={initialNarrative}
        />
      )}
    </div>
  );
}

function PersonalNarrativeEditor({
  perfumeId,
  initialNarrative,
}: {
  perfumeId: number;
  initialNarrative: string | null;
}) {
  const [committed, setCommitted] = useState(initialNarrative ?? "");
  const [draft, setDraft] = useState(initialNarrative ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const renderedHtml = useMemo(
    () => (committed.trim() ? renderMarkdown(committed) : ""),
    [committed],
  );

  useEffect(() => {
    if (isEditing) textareaRef.current?.focus();
  }, [isEditing]);

  const save = () => {
    startTransition(async () => {
      const next = draft.trim() ? draft : "";
      await updatePersonalNarrative(perfumeId, next || null);
      setCommitted(next);
      setIsEditing(false);
    });
  };

  const cancel = () => {
    setDraft(committed);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div role="tabpanel" className="flex flex-col gap-3">
        {renderedHtml ? (
          <div
            className="prose prose-sm max-w-none text-[color:var(--text-soft)] leading-relaxed [&_p]:my-2 [&_li]:my-1 [&_h1]:font-display [&_h1]:text-2xl [&_h2]:font-display [&_h2]:text-xl [&_h3]:font-display [&_h3]:text-lg [&_blockquote]:border-l-2 [&_blockquote]:border-[color:var(--line)] [&_blockquote]:pl-3 [&_blockquote]:italic [&_a]:text-[color:var(--accent-strong)] [&_a]:underline [&_code]:bg-[color:var(--surface)] [&_code]:px-1 [&_code]:rounded"
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        ) : (
          <p className="text-sm text-[color:var(--text-soft)] italic">
            Nothing yet. Capture your impressions, wear notes, or memories tied
            to this scent.
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded-[var(--radius-pill)] border border-[color:var(--line)] px-3 py-1 text-xs font-medium hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
          >
            {committed ? "Edit" : "Write"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div role="tabpanel" className="flex flex-col gap-3">
      <Toolbar textareaRef={textareaRef} draft={draft} setDraft={setDraft} />
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        rows={Math.max(8, draft.split("\n").length + 2)}
        placeholder="Markdown supported. **bold**, *italic*, # heading, - list, [link](url), > quote."
        className="min-h-[200px] w-full rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 py-3 font-mono text-sm leading-relaxed focus:border-[color:var(--accent)] focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-[color:var(--text-soft)]">
          ⌘ Enter to save · Esc to cancel
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={isPending}
            className="rounded-[var(--radius-pill)] border border-[color:var(--line)] px-3 py-1 text-xs font-medium hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="rounded-[var(--radius-pill)] bg-[color:var(--accent)] px-3 py-1 text-xs font-medium text-white hover:bg-[color:var(--accent-strong)] disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

type ToolbarProps = {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  draft: string;
  setDraft: (v: string) => void;
};

function Toolbar({ textareaRef, draft, setDraft }: ToolbarProps) {
  const wrap = (left: string, right: string = left, placeholder = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = draft.slice(start, end) || placeholder;
    const next =
      draft.slice(0, start) + left + selected + right + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      ta.focus();
      const cursorStart = start + left.length;
      ta.setSelectionRange(cursorStart, cursorStart + selected.length);
    });
  };

  const linePrefix = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const lineStart = draft.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = draft.indexOf("\n", end);
    const sliceEnd = lineEnd === -1 ? draft.length : lineEnd;
    const block = draft.slice(lineStart, sliceEnd);
    const lines = block.split("\n");
    const next =
      draft.slice(0, lineStart) +
      lines.map((l) => (l.startsWith(prefix) ? l : prefix + l)).join("\n") +
      draft.slice(sliceEnd);
    setDraft(next);
    requestAnimationFrame(() => ta.focus());
  };

  const insertLink = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = draft.slice(start, end) || "link text";
    const insertion = `[${selected}](url)`;
    const next = draft.slice(0, start) + insertion + draft.slice(end);
    setDraft(next);
    requestAnimationFrame(() => {
      ta.focus();
      // Put cursor on the "url" placeholder for quick replacement.
      const urlStart = start + selected.length + 3;
      ta.setSelectionRange(urlStart, urlStart + 3);
    });
  };

  const btn =
    "rounded-[var(--radius-md)] border border-[color:var(--line)] px-2 py-1 text-xs font-medium hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]";

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => wrap("**", "**", "bold")}
        className={`${btn} font-bold`}
        aria-label="Bold"
      >
        B
      </button>
      <button
        type="button"
        onClick={() => wrap("*", "*", "italic")}
        className={`${btn} italic`}
        aria-label="Italic"
      >
        I
      </button>
      <button
        type="button"
        onClick={() => linePrefix("# ")}
        className={btn}
        aria-label="Heading 1"
      >
        H1
      </button>
      <button
        type="button"
        onClick={() => linePrefix("## ")}
        className={btn}
        aria-label="Heading 2"
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => linePrefix("- ")}
        className={btn}
        aria-label="Bulleted list"
      >
        • List
      </button>
      <button
        type="button"
        onClick={() => linePrefix("1. ")}
        className={btn}
        aria-label="Numbered list"
      >
        1. List
      </button>
      <button
        type="button"
        onClick={() => linePrefix("> ")}
        className={btn}
        aria-label="Quote"
      >
        “
      </button>
      <button
        type="button"
        onClick={insertLink}
        className={btn}
        aria-label="Link"
      >
        Link
      </button>
    </div>
  );
}
