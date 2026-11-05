"use client";
import { useState } from "react";
import { BgDeco, Piggy } from "@/components/Cute";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<"" | "mail" | "ready">("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("กรุณาใส่ชื่อ");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr("อีเมลไม่ถูกต้อง");
    if (pass.length < 8) return setErr("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
    if (pass !== pass2) return setErr("รหัสผ่านสองช่องไม่ตรงกัน");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password: pass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "สมัครไม่สำเร็จ");
      try { localStorage.setItem("pt-email", email.trim().toLowerCase()); } catch { /* ignore */ }
      if (data.confirmed) location.replace("/");
      else setDone("mail");
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
          <Piggy size={88} mood={done ? "happy" : err ? "wow" : "wink"} className="bob center" />
          <h1>สมัครใช้งาน</h1>
          {done ? (
            <div className="center" role="status">
              <p>ส่งลิงก์ยืนยันไปที่ <b>{email.trim()}</b> แล้ว 💌<br />เปิดอีเมลแล้วกดลิงก์ จากนั้นเข้าสู่ระบบได้เลย (ถ้าไม่เห็น ลองดูในโฟลเดอร์สแปม)</p>
              <a className="btn" href="/login?registered=1">ไปหน้าเข้าสู่ระบบ</a>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <label htmlFor="su-name">ชื่อที่ใช้แสดง</label>
              <input id="su-name" className="in" autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              <label htmlFor="su-email">อีเมล (ใช้เข้าสู่ระบบ และรับสรุปรายสัปดาห์)</label>
              <input id="su-email" className="in" type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
              <label htmlFor="su-pass">ตั้งรหัสผ่าน (อย่างน้อย 8 ตัวอักษร)</label>
              <input id="su-pass" className="in" type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
              <label htmlFor="su-pass2">ยืนยันรหัสผ่านอีกครั้ง</label>
              <input id="su-pass2" className="in" type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
              <button className="btn" type="submit" disabled={busy}>{busy ? "กำลังสมัคร…" : "สมัครใช้งาน"}</button>
              {err && <div className="err pop-in" role="alert">{err}</div>}
              <p className="hint">ข้อมูลรายการและรูปสลิปของคุณจะเก็บไว้ในระบบของผู้ดูแลแอปนี้ ผู้ดูแลสามารถเข้าถึงได้</p>
              <p className="login-foot center">มีบัญชีแล้ว? <a href="/login">เข้าสู่ระบบ</a></p>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
