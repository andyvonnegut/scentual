import Link from "next/link";
import { PageShell } from "@/components/brand/PageShell";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card } from "@/components/brand/Card";
import { requireUser } from "@/lib/auth";
import { AddCustomScentForm } from "./_components/AddCustomScentForm";

export default async function AddScentPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; house?: string }>;
}) {
  await requireUser("/collection/add");
  const params = await searchParams;

  return (
    <PageShell>
      <div className="flex flex-col gap-8">
        <SectionHeader title="Add a custom scent">
          <p className="text-[color:var(--text-soft)] text-base">
            Can&apos;t find it in the catalog? Add it to your collection
            yourself. We&apos;ll keep it private to you.
          </p>
        </SectionHeader>

        <Card>
          <AddCustomScentForm
            initialName={params.name ?? ""}
            initialHouse={params.house ?? ""}
          />
        </Card>

        <Link
          href="/collection"
          className="text-sm text-[color:var(--text-soft)] hover:text-[color:var(--text)]"
        >
          ← Back to collection
        </Link>
      </div>
    </PageShell>
  );
}
