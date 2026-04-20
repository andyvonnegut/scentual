import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/brand/PageShell";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card } from "@/components/brand/Card";
import { Chip } from "@/components/brand/Chip";
import { FavoriteStar } from "@/components/brand/FavoriteStar";
import { SaveControls } from "@/components/brand/SaveControls";
import { RatingsControlGroup } from "@/components/brand/RatingControl";
import { TagTypeahead } from "@/components/brand/TagTypeahead";
import { SourceDescriptionTabs } from "@/components/brand/SourceDescriptionTabs";
import {
  getPerfumeByManufacturerAndSlug,
  getPriceHistory,
  getStockHistory,
  getAllNotes,
} from "@/lib/queries/perfumes";
import {
  getAllThemeTags,
  getPersonalPerfumeByPerfumeId,
} from "@/lib/queries/library";
import { getSessionUser } from "@/lib/auth";
import {
  addPersonalNoteByName,
  addThemeTagByName,
  detachPersonalNote,
  detachThemeTag,
} from "@/app/actions/tags";
import { JournalSection } from "./_components/JournalSection";

function formatPrice(price: number | null, currency: string) {
  if (price === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
  }).format(price);
}

function formatStock(status: string, raw: string | null) {
  const label =
    {
      in_stock: "In stock",
      out_of_stock: "Sold out",
      low_stock: "Low stock",
      unavailable: "Unavailable",
      unknown: "Unknown",
    }[status] ?? status;
  return raw && raw !== label.toLowerCase() ? `${label} · ${raw}` : label;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function PerfumeDetailPage({
  params,
}: {
  params: Promise<{ manufacturer: string; slug: string }>;
}) {
  const { manufacturer, slug } = await params;
  const perfume = await getPerfumeByManufacturerAndSlug(manufacturer, slug);
  if (!perfume) notFound();
  const returnPath = `/perfumes/${manufacturer}/${slug}`;

  const user = await getSessionUser();
  const [personal, allNotes, allThemeTags] = await Promise.all([
    getPersonalPerfumeByPerfumeId(perfume.id),
    getAllNotes(),
    getAllThemeTags(),
  ]);

  const attachedPersonalNotes =
    personal?.personal_perfume_notes
      ?.map((t) => t.note)
      .filter((t): t is { id: number; name: string; slug: string } => t !== null) ?? [];
  const attachedThemeTags =
    personal?.personal_perfume_theme_tags
      ?.map((t) => t.theme_tag)
      .filter((t): t is { id: number; name: string; slug: string } => t !== null) ?? [];

  const storeNotes = (perfume.perfume_notes ?? [])
    .map((pn) => pn.note)
    .filter(Boolean) as { id: number; name: string; slug: string }[];
  const storeNoteSlugs = new Set(storeNotes.map((note) => note.slug));
  const availablePersonalNotes = allNotes.filter(
    (note) => !storeNoteSlugs.has(note.slug),
  );

  const variantInfo = new Map<
    number,
    { retailer: string; size: string }
  >();
  for (const l of perfume.perfume_listings ?? []) {
    const retailer = l.retailer?.name ?? "Unknown";
    for (const v of l.listing_variants ?? []) {
      variantInfo.set(v.id, { retailer, size: v.size_label ?? "" });
    }
  }
  const allVariantIds = Array.from(variantInfo.keys());

  const [priceHistories, stockHistories] = await Promise.all([
    Promise.all(allVariantIds.map((id) => getPriceHistory(id))),
    Promise.all(allVariantIds.map((id) => getStockHistory(id))),
  ]);

  const changeRows: ChangeRow[] = [];
  const MERGE_WINDOW_MS = 5000;
  allVariantIds.forEach((id, i) => {
    const info = variantInfo.get(id)!;
    type Event =
      | { date: string; kind: "price"; changeType: string; value: string }
      | { date: string; kind: "stock"; changeType: string; value: string };
    const events: Event[] = [];
    for (const h of priceHistories[i]) {
      events.push({
        date: h.observed_at,
        kind: "price",
        changeType: h.change_type,
        value: formatPrice(Number(h.price), h.currency),
      });
    }
    for (const h of stockHistories[i]) {
      events.push({
        date: h.observed_at,
        kind: "stock",
        changeType: h.change_type,
        value: formatStock(h.stock_status, h.stock_raw),
      });
    }
    events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const variantRows: ChangeRow[] = [];
    for (const e of events) {
      const last = variantRows[variantRows.length - 1];
      const field = e.kind === "price" ? "price" : "stock";
      const canMerge =
        last &&
        !last[field] &&
        Math.abs(
          new Date(last.date).getTime() - new Date(e.date).getTime(),
        ) <= MERGE_WINDOW_MS;
      if (canMerge) {
        last[field] = { value: e.value, changeType: e.changeType };
      } else {
        variantRows.push({
          date: e.date,
          retailer: info.retailer,
          size: info.size,
          [field]: { value: e.value, changeType: e.changeType },
        });
      }
    }
    changeRows.push(...variantRows);
  });

  return (
    <PageShell>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <Link
              href={`/browse/manufacturers/${perfume.manufacturer?.slug ?? ""}`}
              className="text-sm font-medium uppercase tracking-[0.12em] text-[color:var(--text-soft)] hover:text-[color:var(--accent-strong)]"
            >
              {perfume.manufacturer?.name ?? "—"}
            </Link>
            <div className="flex items-start gap-3">
              <h1 className="font-display text-5xl md:text-6xl leading-[0.98] tracking-tight">
                {perfume.name}
              </h1>
              {user && (
                <FavoriteStar
                  perfumeId={perfume.id}
                  initialFavorite={personal?.favorite ?? false}
                />
              )}
            </div>
            {user ? (
              <>
                <SaveControls
                  perfumeId={perfume.id}
                  initialInOwned={personal?.in_owned ?? false}
                  initialInDesired={personal?.in_desired ?? false}
                  initialInSniffed={personal?.in_sniffed ?? false}
                />
                <RatingsControlGroup
                  perfumeId={perfume.id}
                  initialRatings={{
                    projection: personal?.projection_rating ?? null,
                    overall: personal?.overall_rating ?? null,
                    design: personal?.design_rating ?? null,
                  }}
                />
              </>
            ) : (
              <Link
                href={`/auth/signin?next=${encodeURIComponent(returnPath)}`}
                className="inline-flex w-fit items-center gap-2 rounded-[var(--radius-pill)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 py-1.5 text-sm font-medium hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
              >
                Sign in to save, rate, and journal
              </Link>
            )}
          </div>

          {user && (
            <div className="flex flex-col gap-6 border-t border-[color:var(--line)] pt-6">
              <TagTypeahead
                label="Your notes"
                placeholder="Type a note…"
                listId={`personal-notes-${perfume.id}`}
                variant="fragrance-note"
                attached={attachedPersonalNotes}
                suggestions={availablePersonalNotes}
                onAdd={addPersonalNoteByName.bind(null, perfume.id)}
                onRemove={detachPersonalNote.bind(null, perfume.id)}
              />
              <TagTypeahead
                label="Themes"
                placeholder="Type a theme…"
                listId={`theme-tags-${perfume.id}`}
                variant="theme"
                attached={attachedThemeTags}
                suggestions={allThemeTags}
                onAdd={addThemeTagByName.bind(null, perfume.id)}
                onRemove={detachThemeTag.bind(null, perfume.id)}
              />
            </div>
          )}

          {storeNotes.length > 0 && (
            <section className="flex flex-col gap-3">
              <span className="micro-label">Store notes</span>
              <div className="flex flex-wrap gap-1.5">
                {storeNotes.map((n) => (
                  <Chip key={n.id} variant="store">
                    {n.name}
                  </Chip>
                ))}
              </div>
            </section>
          )}

          <SourceDescriptionTabs listings={perfume.perfume_listings ?? []} />
        </div>

        <aside className="flex flex-col gap-8">
          <Card>
            <div className="flex flex-col gap-4">
              <span className="micro-label">Availability</span>
              {perfume.perfume_listings?.map((listing) => (
                <div
                  key={listing.id}
                  className="flex flex-col gap-3 border-b border-[color:var(--line)] pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-sm">
                      {listing.source_url ? (
                        <a
                          href={listing.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-[color:var(--accent-strong)]"
                        >
                          {listing.retailer?.name ?? "—"} ↗
                        </a>
                      ) : (
                        listing.retailer?.name ?? "—"
                      )}
                    </span>
                    {!listing.active && (
                      <Chip variant="theme" size="sm">
                        Inactive
                      </Chip>
                    )}
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {listing.listing_variants?.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-baseline justify-between text-sm"
                      >
                        <span className="text-[color:var(--text-soft)]">
                          {v.size_label}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">
                            {formatPrice(
                              v.current_price === null
                                ? null
                                : Number(v.current_price),
                              v.currency,
                            )}
                          </span>
                          <span className="text-xs text-[color:var(--text-soft)]">
                            {formatStock(
                              v.current_stock_status,
                              v.current_stock_raw,
                            )}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {(!perfume.perfume_listings ||
                perfume.perfume_listings.length === 0) && (
                <p className="text-sm text-[color:var(--text-soft)]">
                  No retailer listings yet.
                </p>
              )}
            </div>
          </Card>

          {user && (
            <JournalSection perfumeId={perfume.id} returnPath={returnPath} />
          )}
        </aside>
      </div>

      <section className="mt-16 flex flex-col gap-6">
        <SectionHeader label="History" title="Recent price & stock changes" />
        <Card>
          <ChangesTable rows={changeRows} />
        </Card>
      </section>
    </PageShell>
  );
}

type ChangeCell = { value: string; changeType: string };
type ChangeRow = {
  date: string;
  retailer: string;
  size: string;
  price?: ChangeCell;
  stock?: ChangeCell;
};

function ChangesTable({ rows }: { rows: ChangeRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[color:var(--text-soft)] mt-3">
        No price or stock changes recorded.
      </p>
    );
  }
  const sorted = [...rows].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
  return (
    <table className="mt-3 w-full text-sm">
      <tbody>
        {sorted.slice(0, 20).map((row, i) => (
          <tr
            key={i}
            className="border-b border-[color:var(--line)] last:border-b-0"
          >
            <td className="py-2 pr-3 text-[color:var(--text-soft)] whitespace-nowrap align-top">
              {formatDate(row.date)}
            </td>
            <td className="py-2 pr-3 align-top">
              <span className="inline-flex flex-wrap items-center gap-1.5">
                <Chip variant="store" size="sm">
                  {row.retailer}
                </Chip>
                {row.size && (
                  <span className="text-[color:var(--text-soft)]">
                    {row.size}
                  </span>
                )}
              </span>
            </td>
            <td className="py-2 pr-3 text-right font-medium align-top whitespace-nowrap">
              {row.price ? (
                <span>
                  {row.price.value}
                  {row.price.changeType && row.price.changeType !== "initial" && (
                    <span className="ml-1 text-xs font-normal text-[color:var(--text-soft)]">
                      · {row.price.changeType}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-[color:var(--text-soft)]">—</span>
              )}
            </td>
            <td className="py-2 text-right font-medium align-top whitespace-nowrap">
              {row.stock ? (
                <span>{row.stock.value}</span>
              ) : (
                <span className="text-[color:var(--text-soft)]">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
