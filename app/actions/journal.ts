"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";

export async function createJournalEntry(formData: FormData) {
  const perfumeId = Number(formData.get("perfume_id"));
  const title = String(formData.get("title") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  const entryDate =
    String(formData.get("entry_date") ?? "") ||
    new Date().toISOString().slice(0, 10);

  if (!perfumeId || !body) {
    throw new Error("perfume_id and body are required");
  }

  const db = createServiceClient();
  await db.from("journal_entries").insert({
    perfume_id: perfumeId,
    title,
    body,
    entry_date: entryDate,
  });

  revalidatePath("/journal");

  const redirectTo = String(formData.get("redirect_to") ?? "/journal");
  redirect(redirectTo);
}

export async function updateJournalEntry(formData: FormData) {
  const id = Number(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  const entryDate = String(formData.get("entry_date") ?? "");

  if (!id || !body) throw new Error("id and body are required");

  const db = createServiceClient();
  await db
    .from("journal_entries")
    .update({ title, body, entry_date: entryDate || undefined })
    .eq("id", id);

  revalidatePath("/journal");
}

export async function deleteJournalEntry(id: number) {
  const db = createServiceClient();
  await db.from("journal_entries").delete().eq("id", id);
  revalidatePath("/journal");
}
