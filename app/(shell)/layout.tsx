import Link from "next/link";
import { ShellNav } from "@/components/brand/ShellNav";
import { HeaderAuth } from "@/components/brand/HeaderAuth";
import { getSessionUser } from "@/lib/auth";

export default async function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-[color:var(--line)] bg-[color:var(--bg)]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between md:px-10">
          <Link
            href="/"
            className="font-display text-xl tracking-tight text-[color:var(--text)]"
          >
            Scentual
          </Link>
          <div className="flex items-center gap-6">
            <ShellNav />
            <HeaderAuth user={user} />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[color:var(--line)] mt-16">
        <div className="mx-auto flex w-full max-w-[1240px] px-6 py-10 md:px-10">
          <span className="micro-label">An archive of scent</span>
        </div>
      </footer>
    </div>
  );
}
