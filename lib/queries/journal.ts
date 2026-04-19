import { createClient } from "@/lib/supabase/server";

export async function listJournalEntries(perfumeId?: number) {
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
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (perfumeId) query = query.eq("perfume_id", perfumeId);
  const { data } = await query;
  return data ?? [];
}

export async function listJournalEntriesForPerfume(perfumeId: number) {
  const db = await createClient();
  const { data } = await db
    .from("journal_entries")
    .select("id, title, body, entry_date, created_at")
    .eq("perfume_id", perfumeId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getAllPerfumesForPicker() {
  const db = await createClient();
  const { data } = await db
    .from("perfumes")
    .select("id, name, slug, manufacturer:manufacturers(id, name, slug)")
    .order("name", { ascending: true });
  return data ?? [];
}
