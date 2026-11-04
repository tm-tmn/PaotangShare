import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { lockout, type AuthState } from "@/lib/lockout";
import { openPin, samePin } from "@/lib/pinbox";
import { isAdminEmail } from "@/lib/session";
import { findUser, updateUser } from "@/lib/store";

export const dynamic = "force-dynamic";

const normEmail = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase().slice(0, 120) : "");

function lockedResponse(st: AuthState) {
  const mins = Math.max(1, Math.ceil((st.lockUntil - Date.now()) / 60000));
  return NextResponse.json(
    { error: `ใส่ PIN ผิดหลายครั้ง บัญชีนี้ล็อกไว้ ${mins} นาที`, locked: true, lockUntil: st.lockUntil },
    { status: 429, headers: { "Retry-After": String(mins * 60) } },
  );
}

// lets the login screen show a running lock countdown for the typed e-mail
export async function GET(req: Request) {
  const email = normEmail(new URL(req.url).searchParams.get("email"));
  if (!email) return NextResponse.json({ locked: false, lockUntil: 0, remaining: 5 });
  const st = await lockout(email, "status");
  return NextResponse.json({ locked: st.locked, lockUntil: st.lockUntil, remaining: st.remaining });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = normEmail(body?.email);
  const pin = typeof body?.pin === "string" ? body.pin.slice(0, 20) : "";
  if (!email) return NextResponse.json({ error: "กรุณาใส่อีเมล" }, { status: 400 });
  // small fixed delay slows down scripted guessing
  await new Promise((r) => setTimeout(r, 400));

  let user;
  try {
    const pre = await lockout(email, "status");
    if (pre.locked) return lockedResponse(pre);
    user = await findUser(email);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }

  // unknown e-mail and wrong PIN look the same from outside (no account probing)
  const stored = user ? openPin(user.pinEnc) : null;
  if (!user || !stored || !samePin(pin, stored)) {
    const st = await lockout(email, "fail");
    if (st.locked) return lockedResponse(st);
    return NextResponse.json({ error: "อีเมลหรือ PIN ไม่ถูกต้อง", remaining: st.remaining }, { status: 401 });
  }
  await lockout(email, "ok");

  if (user.status === "pending") {
    return NextResponse.json({ error: "บัญชีของคุณกำลังรอผู้ดูแลอนุมัติ ลองเข้าใหม่ภายหลังนะคะ", pending: true }, { status: 403 });
  }
  if (user.status !== "active") {
    return NextResponse.json({ error: "บัญชีนี้ถูกระงับการใช้งาน — ติดต่อผู้ดูแล", suspended: true }, { status: 403 });
  }
  // the configured admin e-mail always keeps the admin role
  await updateUser(user.id, { lastLogin: new Date().toISOString(), ...(isAdminEmail(user.email) && user.role !== "admin" ? { role: "admin" } : {}) }).catch(() => {});

  const res = NextResponse.json({ ok: true, name: user.name });
  res.cookies.set(SESSION_COOKIE, await createSession(user.id), sessionCookieOptions());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
