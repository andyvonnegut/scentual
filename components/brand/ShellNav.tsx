"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/collection", label: "Collection" },
  { href: "/journal", label: "Journal" },
];

function getActiveHref(pathname: string) {
  if (pathname === "/") return "/";
  if (pathname.startsWith("/browse") || pathname.startsWith("/perfumes")) {
    return "/browse";
  }
  if (pathname.startsWith("/collection")) return "/collection";
  if (pathname.startsWith("/journal")) return "/journal";
  return null;
}

export function ShellNav() {
  const pathname = usePathname();
  const activeHref = getActiveHref(pathname);

  return (
    <nav className="flex gap-1">
      {NAV.map((item) => {
        const isActive = item.href === activeHref;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "rounded-[var(--radius-pill)] px-4 py-1.5 text-sm transition-colors hover:text-[color:var(--accent-strong)]",
              isActive
                ? "font-semibold text-[color:var(--accent-strong)]"
                : "text-[color:var(--text-soft)]",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
