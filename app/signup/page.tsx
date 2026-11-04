"use client";
import { useState } from "react";
import { BgDeco, Piggy } from "@/components/Cute";

const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 8);

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<"" | "pending" | "active">("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!name.trim()) return setErr("กรุณาใส่ชื่อ");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr("อีเมลไม่ถูกต้อง");
    if (!/^\d{6,8}$/.test(pin)) return setErr("PIN ต้องเป็นตัวเลข 6–8 หลัก");
    if (pin !== pin2) return setErr("PIN สองช่องไม่ตรงกัน");
    setBusy(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "สมัครไม่สำเร็จ");
      try { localStorage.setItem("pt-email", email.trim().toLowerCase()); } catch { /* ignore */ }
      setDone(data.status === "active" ? "active" : "pending");
    } catch (e) {
      setErr((e as Error).message);
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
              {done === "active" ? (
                <p>สมัครเรียบร้อย คุณเป็นผู้ดูแลระบบ 🎉</p>
              ) : (
                <p>สมัครเรียบร้อย 💌 รอผู้ดูแลอนุมัติบัญชีก่อนนะคะ อนุมัติแล้วเข้าสู่ระบบด้วยอีเมลและ PIN ที่ตั้งไว้ได้เลย</p>
              )}
              <a className="btn" href="/login">ไปหน้าเข้าสู่ระบบ</a>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <label htmlFor="su-name">ชื่อที่ใช้แสดง</label>
              <input id="su-name" className="in" autoComplete="nickname" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              <label htmlFor="su-email">อีเมล (ใช้เข้าสู่ระบบ และรับสรุปรายสัปดาห์)</label>
              <input id="su-email" className="in" type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
              <label htmlFor="su-pin">ตั้ง PIN ตัวเลข 6–8 หลัก (ใช้เปิดไฟล์ PDF สรุปด้วย)</label>
              <input id="su-pin" className="in num" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(onlyDigits(e.target.value))} />
              <label htmlFor="su-pin2">ยืนยัน PIN อีกครั้ง</label>
              <input id="su-pin2" className="in num" type="password" inputMode="numeric" autoComplete="new-password" value={pin2} onChange={(e) => setPin2(onlyDigits(e.target.value))} />
              <button className="btn" type="submit" disabled={busy}>{busy ? "กำลังสมัคร…" : "สมัครใช้งาน 💖"}</button>
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
