import { NextResponse, type NextRequest } from "next/server";
import { runScrape, KNOWN_SOURCES } from "@/lib/scrape/runner";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ source: string }> },
) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { source } = await params;
  if (!KNOWN_SOURCES.includes(source)) {
    return NextResponse.json(
      { error: `unknown source: ${source}`, known: KNOWN_SOURCES },
      { status: 404 },
    );
  }

  const result = await runScrape(source, "daily");
  return NextResponse.json(result);
}
