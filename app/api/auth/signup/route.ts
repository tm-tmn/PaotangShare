import { NextResponse } from "next/server";
import { supaForRequest } from "@/lib/supa";
import { validPassword, appOrigin } from "@/lib/authutil";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// open sign-up: Supabase e-mails a confirmation link; the account works as soon as it is confirmed (no admin approval)
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase().slice(0, 120);
    const name = String(body?.name || "").trim().slice(0, 60);
    const password = body?.password;
    if (!EMAIL.test(email)) return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "กรุณาใส่ชื่อ" }, { status: 400 });
    if (!validPassword(password)) return NextResponse.json({ error: "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร" }, { status: 400 });
    const { sb, apply } = supaForRequest(req);
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: `${appOrigin(req)}/auth/confirm` },
    });
    if (error) {
      const limited = /rate limit|too many/i.test(error.message) || error.status === 429;
      return NextResponse.json(
        { error: limited ? "ส่งอีเมลยืนยันถี่เกินไป รอสักครู่แล้วลองใหม่" : /already|registered/i.test(error.message) ? "อีเมลนี้สมัครไว้แล้ว — ลองเข้าสู่ระบบ หรือกด “ลืมรหัสผ่าน”" : "สมัครไม่สำเร็จ: " + error.message },
        { status: limited ? 429 : 400 },
      );
    }
    // with "Confirm email" on, Supabase returns no session; an already-registered address comes back with no identities
    const exists = Array.isArray(data.user?.identities) && data.user.identities.length === 0;
    if (exists) return NextResponse.json({ error: "อีเมลนี้สมัครไว้แล้ว — ลองเข้าสู่ระบบ หรือกด “ลืมรหัสผ่าน”" }, { status: 409 });
    return apply(NextResponse.json({ ok: true, confirmed: !!data.session }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
