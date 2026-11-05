"use client";
import { useEffect, useState } from "react";
import { BgDeco, Piggy } from "@/components/Cute";

const EMAIL_KEY = "pt-email";
const CACHE_KEY = "pt-cache-v1";
const OWNER_KEY = "pt-cache-owner"; // whose list is in the offline cache
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);

  useEffect(() => {
    try { setEmail(localStorage.getItem(EMAIL_KEY) || ""); } catch { /* ignore */ }
    const q = new URLSearchParams(location.search);
    if (q.get("e") === "link") setErr("ลิงก์ไม่ถูกต้อง — ลองกดลิงก์จากอีเมลอีกครั้ง");
    if (q.get("e") === "expired") setErr("ลิงก์หมดอายุหรือถูกใช้ไปแล้ว — ลองเข้าสู่ระบบ หรือขอลิงก์ใหม่");
    if (q.has("reset")) setNote("ตั้งรหัสผ่านใหม่เรียบร้อย เข้าสู่ระบบได้เลย");
    if (q.has("registered")) setNote("สมัครเรียบร้อย — ยืนยันอีเมลแล้วเข้าสู่ระบบได้เลย");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setErr("");
    setNote("");
    if (!validEmail(email)) return setErr("กรุณาใส่อีเมลให้ถูกต้อง");
    if (!password) return setErr("กรุณาใส่รหัสผ่าน");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUnconfirmed(!!data.unconfirmed);
        throw new Error(data.error || "เข้าสู่ระบบไม่สำเร็จ");
      }
      try {
        const addr = email.trim().toLowerCase();
        localStorage.setItem(EMAIL_KEY, addr);
        // another person signing in on this device must not see the previous person's cached list
        if (localStorage.getItem(OWNER_KEY) !== addr) localStorage.removeItem(CACHE_KEY);
        localStorage.setItem(OWNER_KEY, addr);
      } catch { /* ignore */ }
      location.replace("/");
    } catch (e2) {
      setErr((e2 as Error).message);
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <>
      <BgDeco />
      <main className="login">
        <div className="login-card glass-strong pop-in signup-card">
          <Piggy size={96} mood={err ? "wow" : "wink"} className="bob center" />
          <h1>เป๋าตังค์</h1>
          <form onSubmit={submit} noValidate>
            <label htmlFor="li-email">อีเมล</label>
            <input id="li-email" className="in" type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
            <label htmlFor="li-pass">รหัสผ่าน</label>
            <input id="li-pass" className="in" type="password" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setErr(""); }} />
            <button className="btn" type="submit" disabled={busy}>{busy ? <span className="pulse">กำลังตรวจสอบ…</span> : "เข้าสู่ระบบ"}</button>
            {note && <div className="ok pop-in" role="status">{note}</div>}
            {err && <div className="err pop-in" role="alert">{err}</div>}
            {unconfirmed && <p className="hint">ไม่พบอีเมล? ดูในโฟลเดอร์สแปม หรือสมัครอีกครั้งด้วยอีเมลเดิมเพื่อส่งลิงก์ใหม่</p>}
            <p className="login-foot center"><a href="/forgot">ลืมรหัสผ่าน?</a></p>
            <p className="login-foot center">ยังไม่มีบัญชี? <a href="/signup">สมัครใช้งาน</a></p>
          </form>
        </div>
      </main>
    </>
  );
}
