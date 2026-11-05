import { NextResponse } from "next/server";
import { supaForRequest } from "@/lib/supa";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { sb, apply } = supaForRequest(req);
    await sb.auth.signOut();
    return apply(NextResponse.json({ ok: true }));
  } catch {
    return NextResponse.json({ ok: true });
  }
}
