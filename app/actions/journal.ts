"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

function revalidateJournalPaths(returnPath?: string) {
  revalidatePath("/journal");
  if (returnPath && returnPath !== "/journal") {
    revalidatePath(returnPath);
  }
  revalidatePath("/", "layout");
}

export async function createJournalEntry(formData: FormData) {
  const user = await requireUser();

  const perfumeId = Number(formData.get("perfume_id"));
  const title = String(formData.get("title") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  const entryDate =
    String(formData.get("entry_date") ?? "") ||
    new Date().toISOString().slice(0, 10);

  if (!perfumeId || !body) {
    throw new Error("perfume_id and body are required");
  }

  const db = await createClient();
  await db.from("journal_entries").insert({
    user_id: user.id,
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
  const user = await requireUser();

  const id = Number(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim();
  const entryDate = String(formData.get("entry_date") ?? "");
  const returnPath =
    String(formData.get("return_path") ?? "").trim() || undefined;

  if (!id || !body) throw new Error("id and body are required");

  const db = await createClient();
  await db
    .from("journal_entries")
    .update({ title, body, entry_date: entryDate || undefined })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidateJournalPaths(returnPath);
}

export async function deleteJournalEntry(formData: FormData) {
  const user = await requireUser();

  const id = Number(formData.get("id"));
  const returnPath =
    String(formData.get("return_path") ?? "").trim() || undefined;

  if (!id) throw new Error("id is required");

  const db = await createClient();
  await db
    .from("journal_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  revalidateJournalPaths(returnPath);
}
