"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export async function updateDisplayName(formData: FormData) {
  const user = await requireUser();
  const raw = String(formData.get("display_name") ?? "").trim();
  const displayName = raw.length > 0 ? raw : null;

  const db = await createClient();
  await db
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  revalidatePath("/", "layout");
}
