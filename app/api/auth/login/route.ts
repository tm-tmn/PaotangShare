import { NextResponse } from "next/server";
import { supaForRequest } from "@/lib/supa";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase().slice(0, 120);
    const password = typeof body?.password === "string" ? body.password.slice(0, 200) : "";
    if (!email || !password) return NextResponse.json({ error: "กรุณาใส่อีเมลและรหัสผ่าน" }, { status: 400 });
    const { sb, apply } = supaForRequest(req);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = /email not confirmed/i.test(error.message)
        ? "ยังไม่ได้ยืนยันอีเมล — เปิดอีเมลที่เราส่งให้แล้วกดลิงก์ยืนยันก่อน"
        : /rate limit|too many/i.test(error.message)
          ? "ลองหลายครั้งเกินไป รอสักครู่แล้วลองใหม่"
          : "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
      return NextResponse.json({ error: msg, unconfirmed: /email not confirmed/i.test(error.message) }, { status: error.status === 429 ? 429 : 401 });
    }
    return apply(NextResponse.json({ ok: true }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
