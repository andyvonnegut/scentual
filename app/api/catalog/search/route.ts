import { NextResponse, type NextRequest } from "next/server";
import { searchCatalog } from "@/lib/queries/perfumes";
import { getSessionUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const manufacturerIdRaw = req.nextUrl.searchParams.get("manufacturer_id");
  const manufacturerId = manufacturerIdRaw ? Number(manufacturerIdRaw) : null;
  const user = await getSessionUser();
  const data = await searchCatalog(q, user?.id ?? null, {
    manufacturerId: Number.isFinite(manufacturerId) ? manufacturerId : null,
  });
  return NextResponse.json(data);
}
