import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";

export async function listJournalEntries(perfumeId?: number) {
  const user = await getSessionUser();
  if (!user) return [];

  const db = await createClient();
  let query = db
    .from("journal_entries")
    .select(
      `
      id, title, body, entry_date, created_at,
      perfume:perfumes!inner(
        id, name, slug,
        manufacturer:manufacturers(id, name, slug)
      )
      `,
    )
    .eq("user_id", user.id)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (perfumeId) query = query.eq("perfume_id", perfumeId);
  const { data } = await query;
  return data ?? [];
}

export async function listJournalEntriesForPerfume(perfumeId: number) {
  const user = await getSessionUser();
  if (!user) return [];

  const db = await createClient();
  const { data } = await db
    .from("journal_entries")
    .select("id, title, body, entry_date, created_at")
    .eq("user_id", user.id)
    .eq("perfume_id", perfumeId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  return data ?? [];
}
