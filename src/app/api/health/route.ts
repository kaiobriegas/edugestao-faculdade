import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await getDatabase().$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", database: "connected" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable", database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
