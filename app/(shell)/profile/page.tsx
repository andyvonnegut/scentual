import { PageShell } from "@/components/brand/PageShell";
import { SectionHeader } from "@/components/brand/SectionHeader";
import { Card } from "@/components/brand/Card";
import { requireUser } from "@/lib/auth";
import { updateDisplayName } from "@/app/actions/profile";

export default async function ProfilePage() {
  const user = await requireUser("/profile");

  return (
    <PageShell>
      <div className="flex max-w-2xl flex-col gap-8">
        <SectionHeader label="Profile" title="Your account" />
        <Card>
          <form action={updateDisplayName} className="flex flex-col gap-5">
            <label className="flex flex-col gap-2">
              <span className="micro-label">Display name</span>
              <input
                type="text"
                name="display_name"
                defaultValue={user.displayName ?? ""}
                placeholder="How Scentual should address you"
                className="h-11 rounded-[var(--radius-md)] border border-[color:var(--line)] bg-[color:var(--bg-elevated)] px-4 focus:border-[color:var(--accent)] focus:outline-none"
              />
            </label>
            <div className="flex flex-col gap-1">
              <span className="micro-label">Email</span>
              <span className="text-sm text-[color:var(--text-soft)]">
                {user.email ?? "—"}
              </span>
            </div>
            <div>
              <button
                type="submit"
                className="rounded-[var(--radius-md)] bg-[color:var(--accent)] px-6 py-3 text-sm font-medium text-white hover:bg-[color:var(--accent-strong)]"
              >
                Save
              </button>
            </div>
          </form>
        </Card>
      </div>
    </PageShell>
  );
}
