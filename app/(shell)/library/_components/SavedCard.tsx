import Link from "next/link";
import { Card } from "@/components/brand/Card";
import { Chip } from "@/components/brand/Chip";
import { SaveControls } from "@/components/brand/SaveControls";
import { TagManager } from "./TagManager";

type SavedNote = { id: number; name: string; slug: string };

type Saved = {
  id: number;
  in_collection: boolean;
  in_wanted: boolean;
  size_owned_text: string | null;
  personal_note: string | null;
  perfume: {
    id: number;
    name: string;
    slug: string;
    manufacturer: { id: number; name: string; slug: string } | null;
    perfume_notes: { note: SavedNote | null }[] | null;
  } | null;
  personal_perfume_user_fragrance_note_tags:
    | { user_fragrance_note_tag: SavedNote | null }[]
    | null;
  personal_perfume_generic_tags:
    | { generic_tag: SavedNote | null }[]
    | null;
};

export function SavedCard({
  saved,
  allFragranceTags,
  allGenericTags,
}: {
  saved: Saved;
  allFragranceTags: SavedNote[];
  allGenericTags: SavedNote[];
}) {
  const perfume = saved.perfume;
  if (!perfume) return null;
  const href = perfume.manufacturer
    ? `/perfumes/${perfume.manufacturer.slug}/${perfume.slug}`
    : `/perfumes/${perfume.slug}`;

  const storeNotes =
    perfume.perfume_notes
      ?.map((pn) => pn.note)
      .filter((n): n is SavedNote => n !== null) ?? [];

  const fragranceTags =
    saved.personal_perfume_user_fragrance_note_tags
      ?.map((t) => t.user_fragrance_note_tag)
      .filter((t): t is SavedNote => t !== null) ?? [];

  const genericTags =
    saved.personal_perfume_generic_tags
      ?.map((t) => t.generic_tag)
      .filter((t): t is SavedNote => t !== null) ?? [];

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <Link href={href} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span className="micro-label">{perfume.manufacturer?.name}</span>
            <div className="flex gap-1">
              {saved.in_collection && (
                <Chip variant="fragrance-note" size="sm">
                  Collection
                </Chip>
              )}
              {saved.in_wanted && (
                <Chip variant="generic" size="sm">
                  Wanted
                </Chip>
              )}
            </div>
          </div>
          <h3 className="font-display text-2xl leading-tight">
            {perfume.name}
          </h3>
        </Link>

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

        {(fragranceTags.length > 0 || genericTags.length > 0) && (
          <div className="flex flex-wrap gap-1 border-t border-[color:var(--line)] pt-3">
            {fragranceTags.map((t) => (
              <Chip key={`f-${t.id}`} variant="fragrance-note" size="sm">
                {t.name}
              </Chip>
            ))}
            {genericTags.map((t) => (
              <Chip key={`g-${t.id}`} variant="generic" size="sm">
                {t.name}
              </Chip>
            ))}
          </div>
        )}

        <SaveControls
          perfumeId={perfume.id}
          initialInCollection={saved.in_collection}
          initialInWanted={saved.in_wanted}
          compact
        />

        <TagManager
          personalPerfumeId={saved.id}
          allFragranceTags={allFragranceTags}
          allGenericTags={allGenericTags}
          attachedFragranceTagIds={fragranceTags.map((t) => t.id)}
          attachedGenericTagIds={genericTags.map((t) => t.id)}
        />
      </div>
    </Card>
  );
}
