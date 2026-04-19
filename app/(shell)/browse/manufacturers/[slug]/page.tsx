import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/brand/PageShell";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card } from "@/components/brand/Card";
import {
  getManufacturerBySlug,
  getPerfumesByManufacturer,
} from "@/lib/queries/perfumes";

export default async function ManufacturerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const manufacturer = await getManufacturerBySlug(slug);
  if (!manufacturer) notFound();

  const perfumes = await getPerfumesByManufacturer(manufacturer.id);

  return (
    <PageShell>
      <div className="flex flex-col gap-10">
        <SectionHeader label="House" title={manufacturer.name}>
          <p className="text-[color:var(--text-soft)] text-base">
            {perfumes.length} {perfumes.length === 1 ? "perfume" : "perfumes"}{" "}
            in the catalog.
          </p>
        </SectionHeader>

        {perfumes.length === 0 ? (
          <Card className="text-[color:var(--text-soft)]">
            <p className="text-sm">No perfumes for this house yet.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {perfumes.map((p) => (
              <Link
                key={p.id}
                href={`/perfumes/${manufacturer.slug}/${p.slug}`}
                className="block"
              >
                <Card>
                  <div className="flex flex-col gap-2">
                    <span className="micro-label">{manufacturer.name}</span>
                    <h3 className="font-display text-2xl leading-tight">
                      {p.name}
                    </h3>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
