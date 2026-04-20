import { NextResponse, type NextRequest } from "next/server";
import { parseBrowseNoteParams } from "@/lib/browse";
import { browsePerfumes } from "@/lib/queries/perfumes";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const notes = parseBrowseNoteParams(
    req.nextUrl.searchParams.getAll("note"),
    req.nextUrl.searchParams.getAll("note_q"),
  );
  const user = await getSessionUser();
  const data = await browsePerfumes(
    {
      q: req.nextUrl.searchParams.get("q") ?? "",
      manufacturerSlug: req.nextUrl.searchParams.get("manufacturer") ?? "",
      notes,
      limit: 120,
    },
    user?.id ?? null,
  );

  return NextResponse.json(data);
}
