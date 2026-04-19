import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/brand/PageShell";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card } from "@/components/brand/Card";
import { Chip } from "@/components/brand/Chip";
import { SaveControls } from "@/components/brand/SaveControls";
import { TagTypeahead } from "@/components/brand/TagTypeahead";
import {
  getPerfumeByManufacturerAndSlug,
  getPriceHistory,
  getStockHistory,
} from "@/lib/queries/perfumes";
import {
  getAllFragranceNoteTags,
  getAllThemeTags,
  getPersonalPerfumeByPerfumeId,
} from "@/lib/queries/library";
import {
  addFragranceNoteTagByName,
  addThemeTagByName,
  detachFragranceNoteTag,
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

  const personal = await getPersonalPerfumeByPerfumeId(perfume.id);
  const [allFragranceTags, allThemeTags] = personal
    ? await Promise.all([getAllFragranceNoteTags(), getAllThemeTags()])
    : [[], []];

  const attachedFragranceTags =
    personal?.personal_perfume_user_fragrance_note_tags
      ?.map((t) => t.user_fragrance_note_tag)
      .filter((t): t is { id: number; name: string; slug: string } => t !== null) ?? [];
  const attachedThemeTags =
    personal?.personal_perfume_theme_tags
      ?.map((t) => t.theme_tag)
      .filter((t): t is { id: number; name: string; slug: string } => t !== null) ?? [];

  const storeNotes = (perfume.perfume_notes ?? [])
    .map((pn) => pn.note)
    .filter(Boolean) as { id: number; name: string; slug: string }[];

  const allVariantIds =
    perfume.perfume_listings?.flatMap((l) =>
      (l.listing_variants ?? []).map((v) => v.id),
    ) ?? [];

  const [priceHistories, stockHistories] = await Promise.all([
    Promise.all(allVariantIds.map((id) => getPriceHistory(id))),
    Promise.all(allVariantIds.map((id) => getStockHistory(id))),
  ]);

  const priceByVariant = new Map(
    allVariantIds.map((id, i) => [id, priceHistories[i]]),
  );
  const stockByVariant = new Map(
    allVariantIds.map((id, i) => [id, stockHistories[i]]),
  );

  return (
    <PageShell>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_1fr]">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <Link
              href={`/browse/manufacturers/${perfume.manufacturer?.slug ?? ""}`}
              className="micro-label text-[color:var(--text-soft)] hover:text-[color:var(--accent-strong)]"
            >
              {perfume.manufacturer?.name ?? "—"}
            </Link>
            <h1 className="font-display text-5xl md:text-6xl leading-[0.98] tracking-tight">
              {perfume.name}
            </h1>
            <SaveControls
              perfumeId={perfume.id}
              initialInCollection={perfume.personal_perfumes?.in_collection ?? false}
              initialInWanted={perfume.personal_perfumes?.in_wanted ?? false}
            />
          </div>

          {personal && (
            <div className="flex flex-col gap-6 border-t border-[color:var(--line)] pt-6">
              <TagTypeahead
                label="Your fragrance-note tags"
                placeholder="Type a note…"
                listId={`frag-tags-${perfume.id}`}
                variant="fragrance-note"
                attached={attachedFragranceTags}
                suggestions={allFragranceTags}
                onAdd={addFragranceNoteTagByName.bind(null, personal.id)}
                onRemove={detachFragranceNoteTag.bind(null, personal.id)}
              />
              <TagTypeahead
                label="Themes"
                placeholder="Type a theme…"
                listId={`theme-tags-${perfume.id}`}
                variant="theme"
                attached={attachedThemeTags}
                suggestions={allThemeTags}
                onAdd={addThemeTagByName.bind(null, personal.id)}
                onRemove={detachThemeTag.bind(null, personal.id)}
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

          {perfume.perfume_listings?.map((listing) => (
            <div key={listing.id} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <span className="micro-label">
                  {listing.retailer?.name ?? "Source"}
                </span>
                {listing.source_url && (
                  <a
                    href={listing.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[color:var(--text-soft)] hover:text-[color:var(--accent-strong)]"
                  >
                    Open source ↗
                  </a>
                )}
              </div>
              {listing.source_description && (
                <div
                  className="prose prose-sm max-w-none text-[color:var(--text-soft)] leading-relaxed [&_p]:my-2 [&_li]:my-1"
                  dangerouslySetInnerHTML={{ __html: listing.source_description }}
                />
              )}
            </div>
          ))}
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
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {listing.retailer?.name ?? "—"}
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
        </aside>
      </div>

      <section className="mt-16 flex flex-col gap-6">
        <SectionHeader label="History" title="Price & stock changes" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <span className="micro-label">Price history</span>
            <HistoryTable
              empty="No price changes recorded."
              rows={Array.from(priceByVariant.entries()).flatMap(
                ([vid, history]) =>
                  history.map((h) => ({
                    date: h.observed_at,
                    label: `${
                      perfume.perfume_listings?.flatMap((l) =>
                        l.listing_variants?.filter((v) => v.id === vid),
                      )[0]?.size_label ?? ""
                    } · ${h.change_type}`,
                    value: formatPrice(Number(h.price), h.currency),
                  })),
              )}
            />
          </Card>
          <Card>
            <span className="micro-label">Stock history</span>
            <HistoryTable
              empty="No stock changes recorded."
              rows={Array.from(stockByVariant.entries()).flatMap(
                ([vid, history]) =>
                  history.map((h) => ({
                    date: h.observed_at,
                    label: `${
                      perfume.perfume_listings?.flatMap((l) =>
                        l.listing_variants?.filter((v) => v.id === vid),
                      )[0]?.size_label ?? ""
                    } · ${h.change_type}`,
                    value: formatStock(h.stock_status, h.stock_raw),
                  })),
              )}
            />
          </Card>
        </div>
      </section>

      <section className="mt-16">
        <JournalSection perfumeId={perfume.id} returnPath={returnPath} />
      </section>
    </PageShell>
  );
}

function HistoryTable({
  rows,
  empty,
}: {
  rows: { date: string; label: string; value: string }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[color:var(--text-soft)] mt-3">{empty}</p>
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
            <td className="py-2 pr-3 text-[color:var(--text-soft)] whitespace-nowrap">
              {formatDate(row.date)}
            </td>
            <td className="py-2 pr-3 text-[color:var(--text-soft)]">
              {row.label}
            </td>
            <td className="py-2 text-right font-medium">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
