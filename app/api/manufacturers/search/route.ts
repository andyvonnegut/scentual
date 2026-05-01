import { NextResponse, type NextRequest } from "next/server";
import { searchManufacturers } from "@/lib/queries/perfumes";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const limitRaw = req.nextUrl.searchParams.get("limit");
  const limitParsed = limitRaw ? Number(limitRaw) : NaN;
  const limit = Number.isFinite(limitParsed) ? Math.min(limitParsed, 25) : 8;
  const user = await getSessionUser();
  const data = await searchManufacturers(q, user?.id ?? null, limit);
  return NextResponse.json(data);
}
