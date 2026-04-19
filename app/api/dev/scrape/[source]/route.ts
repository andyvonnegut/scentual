import { NextResponse, type NextRequest } from "next/server";
import { runScrape, KNOWN_SOURCES } from "@/lib/scrape/runner";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "dev trigger disabled in production" },
      { status: 403 },
    );
  }

  const { source } = await params;
  if (!KNOWN_SOURCES.includes(source)) {
    return NextResponse.json(
      { error: `unknown source: ${source}`, known: KNOWN_SOURCES },
      { status: 404 },
    );
  }

  const runType = req.nextUrl.searchParams.get("runType") === "initial"
    ? "initial"
    : "daily";
  const result = await runScrape(source, runType);
  return NextResponse.json(result);
}
