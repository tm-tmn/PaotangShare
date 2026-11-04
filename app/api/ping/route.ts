import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Keep-alive: the proxy has already checked and slid the session; reaching here means it is still valid.
export function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
