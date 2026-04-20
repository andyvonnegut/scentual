import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = {
  id: string;
  email: string | null;
  avatarUrl: string | null;
  displayName: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  const { data: profile } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? null,
    avatarUrl:
      (meta.avatar_url as string | undefined) ??
      (meta.picture as string | undefined) ??
      null,
    displayName:
      profile?.display_name ??
      (meta.full_name as string | undefined) ??
      (meta.name as string | undefined) ??
      null,
  };
}

export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const target = nextPath ? `/auth/signin?next=${encodeURIComponent(nextPath)}` : "/auth/signin";
    redirect(target);
  }
  return user;
}
