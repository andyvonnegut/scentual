import Link from "next/link";
import { PageShell } from "@/components/brand/PageShell";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card } from "@/components/brand/Card";
import {
  getRecentPerfumes,
  getRecentlyUpdatedPerfumes,
} from "@/lib/queries/perfumes";

export default async function Home() {
  const [recent, updated] = await Promise.all([
    getRecentPerfumes(6),
    getRecentlyUpdatedPerfumes(6),
  ]);

  return (
    <PageShell>
      <div className="flex flex-col gap-16">
        <header className="flex flex-col gap-6 pt-8 pb-4">
          <span className="micro-label">Scentual</span>
          <h1 className="font-display text-6xl md:text-7xl leading-[0.95] tracking-tight text-[color:var(--text)] max-w-3xl">
            A quiet archive of scent.
          </h1>
          <p className="max-w-xl text-lg text-[color:var(--text-soft)] leading-relaxed">
            A private perfume library, journal, and historical record — drawn
            from Ministry of Scent and LuckyScent, organized the way you think.
          </p>
        </header>

        <section className="flex flex-col gap-6">
          <SectionHeader label="Recently added" title="New to the catalog" />
          {recent.length === 0 ? (
            <Card className="text-[color:var(--text-soft)]">
              <p className="text-sm">
                The catalog is empty. Run the Ministry of Scent ingest to
                populate it.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recent.map((p) => (
                <PerfumeTile
                  key={p.id}
                  name={p.name}
                  slug={p.slug}
                  manufacturer={p.manufacturer}
                />
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-6">
          <SectionHeader
            label="Recently updated"
            title="Prices & stock changes"
          />
          {updated.length === 0 ? (
            <Card className="text-[color:var(--text-soft)]">
              <p className="text-sm">Daily scrapes will show updates here.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {updated.map((p) => (
                <PerfumeTile
                  key={p.id}
                  name={p.name}
                  slug={p.slug}
                  manufacturer={p.manufacturer}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}

function PerfumeTile({
  name,
  slug,
  manufacturer,
}: {
  name: string;
  slug: string;
  manufacturer: { name: string; slug: string } | null;
}) {
  const href = manufacturer
    ? `/perfumes/${manufacturer.slug}/${slug}`
    : `/perfumes/${slug}`;
  return (
    <Link href={href} className="block">
      <Card>
        <div className="flex flex-col gap-2">
          <span className="micro-label">{manufacturer?.name ?? "—"}</span>
          <h3 className="font-display text-2xl leading-tight">{name}</h3>
        </div>
      </Card>
    </Link>
  );
}
