import { NextResponse, type NextRequest } from "next/server";
import { searchCatalogForLibrary } from "@/lib/queries/library";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const data = await searchCatalogForLibrary(q);
  return NextResponse.json(data);
}
