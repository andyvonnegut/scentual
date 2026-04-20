import Link from "next/link";
import type { SessionUser } from "@/lib/auth";

export function HeaderAuth({ user }: { user: SessionUser | null }) {
  if (!user) {
    return (
      <Link
        href="/auth/signin"
        className="rounded-[var(--radius-pill)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 py-1.5 text-sm font-medium hover:border-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
      >
        Sign in
      </Link>
    );
  }

  const label = user.displayName ?? user.email ?? "Profile";

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/profile"
        className="flex items-center gap-2 rounded-[var(--radius-pill)] border border-transparent px-2 py-1 text-sm hover:border-[color:var(--line)] hover:bg-[color:var(--bg-elevated)]"
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatarUrl}
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 rounded-full"
          />
        ) : (
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--accent)] text-xs font-medium text-white">
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="max-w-[10rem] truncate">{label}</span>
      </Link>
      <form action="/auth/signout" method="post">
        <button
          type="submit"
          className="text-sm text-[color:var(--text-soft)] hover:text-[color:var(--text)]"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
