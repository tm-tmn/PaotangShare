import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { lockout, samePin, type AuthState } from "@/lib/lockout";

export const dynamic = "force-dynamic";

function lockedResponse(st: AuthState) {
  const mins = Math.max(1, Math.ceil((st.lockUntil - Date.now()) / 60000));
  return NextResponse.json(
    { error: `ใส่ PIN ผิดหลายครั้ง ล็อกไว้ ${mins} นาที`, locked: true, lockUntil: st.lockUntil },
    { status: 429, headers: { "Retry-After": String(mins * 60) } },
  );
}

// lets the login screen show a running lock countdown
export async function GET() {
  const st = await lockout("status");
  return NextResponse.json({ locked: st.locked, lockUntil: st.lockUntil, remaining: st.remaining });
}

export async function POST(req: Request) {
  const expected = process.env.APP_PIN;
  if (!expected) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า APP_PIN ใน Vercel" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const pin = typeof body?.pin === "string" ? body.pin.slice(0, 20) : "";
  // small fixed delay slows down scripted guessing
  await new Promise((r) => setTimeout(r, 400));

  if (!samePin(pin, expected)) {
    const st = await lockout("fail"); // does not count while already locked
    if (st.locked) return lockedResponse(st);
    return NextResponse.json({ error: "PIN ไม่ถูกต้อง", remaining: st.remaining }, { status: 401 });
  }

  // right PIN still has to wait out an active lock
  const st = await lockout("status");
  if (st.locked) return lockedResponse(st);
  await lockout("ok");

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(), sessionCookieOptions());
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
