import Link from "next/link";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/brand/PageShell";
import { Card } from "@/components/brand/Card";
import { SignInButton } from "@/components/brand/SignInButton";
import { getSessionUser } from "@/lib/auth";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const user = await getSessionUser();
  if (user) redirect(next ?? "/");

  return (
    <PageShell>
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 pt-12">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-display text-4xl leading-tight tracking-tight">
            Sign in to Scentual
          </h1>
          <p className="text-sm text-[color:var(--text-soft)]">
            Use your Google account to save collections, ratings, and journal entries.
          </p>
        </div>
        <Card>
          <div className="flex flex-col items-center gap-4 py-4">
            <SignInButton next={next} />
            {error && (
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            )}
            <p className="text-xs text-[color:var(--text-soft)]">
              Browsing stays public —{" "}
              <Link href="/" className="underline-offset-2 hover:underline">
                back to the catalog
              </Link>
              .
            </p>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}
