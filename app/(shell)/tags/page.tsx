import { PageShell } from "@/components/brand/PageShell";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card } from "@/components/brand/Card";
import { Chip } from "@/components/brand/Chip";
import {
  getAllFragranceNoteTags,
  getAllGenericTags,
} from "@/lib/queries/library";
import { createFragranceNoteTag, createGenericTag } from "@/app/actions/tags";

export default async function TagsPage() {
  const [fragranceTags, genericTags] = await Promise.all([
    getAllFragranceNoteTags(),
    getAllGenericTags(),
  ]);

  return (
    <PageShell>
      <div className="flex flex-col gap-10">
        <SectionHeader label="Organization" title="Tag libraries">
          <p className="text-[color:var(--text-soft)] text-base">
            Reusable tags you&rsquo;ve created. Store notes are source-derived
            and live on perfume pages.
          </p>
        </SectionHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TagSection
            title="User fragrance-note tags"
            label="Personal scent impressions"
            tags={fragranceTags}
            variant="fragrance-note"
            createAction={async (formData: FormData) => {
              "use server";
              const name = String(formData.get("name") ?? "");
              await createFragranceNoteTag(name);
            }}
          />
          <TagSection
            title="Generic tags"
            label="Organizational labels"
            tags={genericTags}
            variant="generic"
            createAction={async (formData: FormData) => {
              "use server";
              const name = String(formData.get("name") ?? "");
              await createGenericTag(name);
            }}
          />
        </div>
      </div>
    </PageShell>
  );
}

function TagSection({
  title,
  label,
  tags,
  variant,
  createAction,
}: {
  title: string;
  label: string;
  tags: { id: number; name: string; slug: string }[];
  variant: "fragrance-note" | "generic";
  createAction: (formData: FormData) => Promise<void>;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="micro-label">{label}</span>
          <h2 className="font-display text-2xl">{title}</h2>
        </div>

        <form action={createAction} className="flex gap-2">
          <input
            name="name"
            required
            placeholder="New tag name"
            className="h-10 flex-1 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 text-sm focus:border-[color:var(--accent)] focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-[var(--radius-md)] bg-[color:var(--accent)] px-4 text-sm font-medium text-white hover:bg-[color:var(--accent-strong)]"
          >
            Add
          </button>
        </form>

        {tags.length === 0 ? (
          <p className="text-sm text-[color:var(--text-soft)]">
            No tags yet. Create one above.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 pt-2">
            {tags.map((t) => (
              <Chip key={t.id} variant={variant}>
                {t.name}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
