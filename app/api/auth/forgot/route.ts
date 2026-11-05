import { NextResponse } from "next/server";
import { appOrigin } from "@/lib/authutil";
import { supaForRequest } from "@/lib/supa";

export const dynamic = "force-dynamic";

// always answers the same way, so nobody can use this form to find out who has an account
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase().slice(0, 120);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
    const { sb } = supaForRequest(req);
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${appOrigin(req)}/auth/confirm?next=/reset` });
    if (error && (error.status === 429 || /rate limit|too many/i.test(error.message))) {
      return NextResponse.json({ error: "ขอลิงก์ถี่เกินไป รอสักครู่แล้วลองใหม่" }, { status: 429 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
