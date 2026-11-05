"use client";
import { useEffect, useState } from "react";
import { BgDeco, Piggy } from "@/components/Cute";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    try { setEmail(localStorage.getItem("pt-email") || ""); } catch { /* ignore */ }
    if (new URLSearchParams(location.search).get("e") === "expired") setErr("ลิงก์หมดอายุหรือถูกใช้ไปแล้ว — ขอลิงก์ใหม่ได้ที่นี่");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr("อีเมลไม่ถูกต้อง");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "ส่งไม่สำเร็จ");
      setSent(true);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <BgDeco />
      <main className="login">
        <div className="login-card glass-strong pop-in signup-card">
          <Piggy size={88} mood={sent ? "happy" : "wink"} className="bob center" />
          <h1>ลืมรหัสผ่าน</h1>
          {sent ? (
            <div className="center" role="status">
              <p>ถ้าอีเมลนี้มีบัญชีอยู่ เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว 💌<br />ลิงก์ใช้ได้ช่วงสั้น ๆ และใช้ได้ครั้งเดียว (ถ้าไม่เห็น ลองดูในโฟลเดอร์สแปม)</p>
              <a className="btn" href="/login">กลับไปหน้าเข้าสู่ระบบ</a>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <label htmlFor="fg-email">อีเมลที่ใช้สมัคร</label>
              <input id="fg-email" className="in" type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className="btn" type="submit" disabled={busy}>{busy ? "กำลังส่ง…" : "ส่งลิงก์ตั้งรหัสผ่านใหม่"}</button>
              {err && <div className="err pop-in" role="alert">{err}</div>}
              <p className="login-foot center"><a href="/login">กลับไปเข้าสู่ระบบ</a></p>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
