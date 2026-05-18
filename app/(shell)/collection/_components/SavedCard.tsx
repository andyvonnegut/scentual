import Link from "next/link";
import { Card } from "@/components/brand/Card";
import { Chip } from "@/components/brand/Chip";
import { FavoriteStar } from "@/components/brand/FavoriteStar";
import { SaveControls } from "@/components/brand/SaveControls";
import { RatingsControlGroup } from "@/components/brand/RatingControl";

type Ref = { id: number; name: string; slug: string };

type Saved = {
  id: number;
  in_owned: boolean;
  in_desired: boolean;
  in_sniffed: boolean;
  in_curious: boolean;
  size_owned_text: string | null;
  personal_note: string | null;
  favorite: boolean;
  projection_rating: number | null;
  overall_rating: number | null;
  design_rating: number | null;
  perfume: {
    id: number;
    name: string;
    slug: string;
    manufacturer: { id: number; name: string; slug: string } | null;
    perfume_notes: { note: Ref | null }[] | null;
  } | null;
  personal_perfume_notes: { note: Ref | null }[] | null;
  personal_perfume_theme_tags:
    | { theme_tag: Ref | null }[]
    | null;
};

export function SavedCard({ saved }: { saved: Saved }) {
  const perfume = saved.perfume;
  if (!perfume) return null;
  const href = perfume.manufacturer
    ? `/perfumes/${perfume.manufacturer.slug}/${perfume.slug}`
    : `/perfumes/${perfume.slug}`;

  const storeNotes =
    perfume.perfume_notes
      ?.map((pn) => pn.note)
      .filter((n): n is Ref => n !== null) ?? [];

  const personalNotes =
    saved.personal_perfume_notes
      ?.map((t) => t.note)
      .filter((t): t is Ref => t !== null) ?? [];

  const themeTags =
    saved.personal_perfume_theme_tags
      ?.map((t) => t.theme_tag)
      .filter((t): t is Ref => t !== null) ?? [];

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <Link href={href} className="micro-label">
              {perfume.manufacturer?.name}
            </Link>
            <div className="flex gap-1">
              {saved.in_owned && (
                <Chip variant="fragrance-note" size="sm">
                  Owned
                </Chip>
              )}
              {saved.in_desired && (
                <Chip variant="theme" size="sm">
                  Desired
                </Chip>
              )}
              {saved.in_sniffed && (
                <Chip variant="store" size="sm">
                  Sniffed
                </Chip>
              )}
              {saved.in_curious && (
                <Chip variant="fragrance-note" size="sm">
                  Curious
                </Chip>
              )}
            </div>
          </div>
          <div className="flex items-start justify-between gap-3">
            <Link href={href} className="min-w-0">
              <h3 className="font-display text-2xl leading-tight">
                {perfume.name}
              </h3>
            </Link>
            <FavoriteStar
              perfumeId={perfume.id}
              initialFavorite={saved.favorite}
              size="sm"
            />
          </div>
        </div>

        {saved.size_owned_text && (
          <p className="text-xs text-[color:var(--text-soft)]">
            Owned: {saved.size_owned_text}
          </p>
        )}
        {saved.personal_note && (
          <p className="text-sm text-[color:var(--text-soft)] line-clamp-3">
            {saved.personal_note}
          </p>
        )}

        {storeNotes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {storeNotes.slice(0, 5).map((n) => (
              <Chip key={n.id} variant="store" size="sm">
                {n.name}
              </Chip>
            ))}
          </div>
        )}

        {(personalNotes.length > 0 || themeTags.length > 0) && (
          <div className="flex flex-wrap gap-1 border-t border-[color:var(--line)] pt-3">
            {personalNotes.map((t) => (
              <Chip key={`f-${t.id}`} variant="fragrance-note" size="sm">
                {t.name}
              </Chip>
            ))}
            {themeTags.map((t) => (
              <Chip key={`t-${t.id}`} variant="theme" size="sm">
                {t.name}
              </Chip>
            ))}
          </div>
        )}

        <RatingsControlGroup
          perfumeId={perfume.id}
          initialRatings={{
            projection: saved.projection_rating,
            overall: saved.overall_rating,
            design: saved.design_rating,
          }}
          size="sm"
        />

        <SaveControls
          perfumeId={perfume.id}
          initialInOwned={saved.in_owned}
          initialInDesired={saved.in_desired}
          initialInSniffed={saved.in_sniffed}
          initialInCurious={saved.in_curious}
          compact
        />
      </div>
    </Card>
  );
}
