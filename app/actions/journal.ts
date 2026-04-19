"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";

function revalidateJournalPaths(returnPath?: string) {
  revalidatePath("/journal");
  if (returnPath && returnPath !== "/journal") {
    revalidatePath(returnPath);
  }
  revalidatePath("/", "layout");
}

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

  const redirectTo = String(formData.get("redirect_to") ?? "/journal");
  revalidateJournalPaths(redirectTo);
  redirect(redirectTo);
}

export async function updateJournalEntry(formData: FormData) {
  const id = Number(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  const entryDate = String(formData.get("entry_date") ?? "");
  const returnPath =
    String(formData.get("return_path") ?? "").trim() || undefined;

  if (!id || !body) throw new Error("id and body are required");

  const db = createServiceClient();
  await db
    .from("journal_entries")
    .update({ title, body, entry_date: entryDate || undefined })
    .eq("id", id);

  revalidateJournalPaths(returnPath);
}

export async function deleteJournalEntry(formData: FormData) {
  const id = Number(formData.get("id"));
  const returnPath =
    String(formData.get("return_path") ?? "").trim() || undefined;

  if (!id) throw new Error("id is required");

  const db = createServiceClient();
  await db.from("journal_entries").delete().eq("id", id);
  revalidateJournalPaths(returnPath);
}
