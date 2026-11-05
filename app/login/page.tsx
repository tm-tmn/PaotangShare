"use client";
import { Delete } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BgDeco, Piggy } from "@/components/Cute";

const EMAIL_KEY = "pt-email";
const CACHE_KEY = "pt-cache-v1";
const OWNER_KEY = "pt-cache-owner"; // whose list is in the offline cache
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];
const LEN = 6;
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

  const emailRef = useRef(email);
  emailRef.current = email;
  const [shake, setShake] = useState(0);

  const submit = useCallback(async (password: string) => {
    if (busy) return;
    setErr("");
    setNote("");
    const email = emailRef.current;
    if (!validEmail(email)) { setPassword(""); return setErr("กรุณาใส่อีเมลให้ถูกต้อง"); }
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
      setShake(Date.now());
      setPassword("");
      setBusy(false);
    }
  }, [busy]);

  const press = useCallback((k: string) => {
    if (busy) return;
    setErr("");
    if (k === "del") return setPassword((p) => p.slice(0, -1));
    if (!k) return;
    setPassword((p) => {
      const n = p.length < LEN ? p + k : p;
      if (n.length === LEN && n !== p) setTimeout(() => submit(n), 120); // auto-enter on the 6th digit
      return n;
    });
  }, [busy, submit]);

  // physical keyboard digits work too (but not while typing the e-mail)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [press]);

  return (
    <>
      <BgDeco />
      <main className="login">
        <div className="login-card glass-strong pop-in signup-card">
          <Piggy size={96} mood={err ? "wow" : "wink"} className="bob center" />
          <h1>เป๋าตังค์</h1>
          <form onSubmit={(e) => { e.preventDefault(); submit(password); }} noValidate>
            <label htmlFor="li-email">อีเมล</label>
            <input id="li-email" className="in" type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
            <p className="login-pin-label">รหัสผ่าน (ตัวเลข 6 หลัก)</p>
            <div className={`pin-dots ${shake ? "shake" : ""}`} key={shake} aria-live="polite" aria-label={`ใส่แล้ว ${password.length} หลัก`}>
              {Array.from({ length: LEN }, (_, i) => (
                <i key={i} className={i < password.length ? "on" : ""} />
              ))}
            </div>
            <div className="keypad">
              {KEYS.map((k, i) =>
                k === "" ? (
                  <span key={i} />
                ) : (
                  <button key={i} type="button" className={`key ${k === "del" ? "del" : ""}`} onClick={() => press(k)} aria-label={k === "del" ? "ลบ" : k} disabled={busy}>
                    {k === "del" ? <Delete size={22} /> : k}
                  </button>
                ),
              )}
            </div>
            {busy && <p className="hint center"><span className="pulse">กำลังตรวจสอบ…</span></p>}
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
