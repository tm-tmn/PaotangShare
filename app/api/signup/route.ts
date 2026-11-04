import { NextResponse } from "next/server";
import { sealPin, validPin } from "@/lib/pinbox";
import { isAdminEmail } from "@/lib/session";
import { createUser } from "@/lib/store";
import { fail } from "@/lib/txform";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// open sign-up; new accounts wait for an admin — except the ADMIN_EMAIL account, which becomes the first admin
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase().slice(0, 120);
    const name = String(body?.name || "").trim().slice(0, 60);
    const pin = body?.pin;
    if (!EMAIL.test(email)) return NextResponse.json({ error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "กรุณาใส่ชื่อ" }, { status: 400 });
    if (!validPin(pin)) return NextResponse.json({ error: "PIN ต้องเป็นตัวเลข 6–8 หลัก" }, { status: 400 });
    await new Promise((r) => setTimeout(r, 300));
    const admin = isAdminEmail(email);
    const user = await createUser({ email, name, pinEnc: sealPin(pin), status: admin ? "active" : "pending", role: admin ? "admin" : "user" });
    return NextResponse.json({ ok: true, status: user.status });
  } catch (e) {
    const msg = (e as Error).message;
    if (/สมัครไว้แล้ว/.test(msg)) return NextResponse.json({ error: "อีเมลนี้สมัครไว้แล้ว — ลองเข้าสู่ระบบ" }, { status: 409 });
    return fail(e);
  }
}
