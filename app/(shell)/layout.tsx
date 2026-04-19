import Link from "next/link";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/collection", label: "Collection" },
  { href: "/journal", label: "Journal" },
];

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b border-[color:var(--line)] bg-[color:var(--bg)]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-6 py-5 md:px-10">
          <Link
            href="/"
            className="font-display text-xl tracking-tight text-[color:var(--text)]"
          >
            Scentual
          </Link>
          <nav className="flex gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[var(--radius-pill)] px-4 py-1.5 text-sm text-[color:var(--text-soft)] transition-colors hover:text-[color:var(--accent-strong)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
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
