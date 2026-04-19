import { NextResponse, type NextRequest } from "next/server";
import { searchCatalog } from "@/lib/queries/perfumes";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const data = await searchCatalog(q);
  return NextResponse.json(data);
}
