"use client";
import { Delete, LockKeyhole } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ACTIVE_KEY } from "@/lib/idle";
import { BgDeco, Piggy } from "@/components/Cute";

function fmtLeft(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (x: number) => String(x).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(sec)}` : `${m}:${p(sec)}`;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export default function Login() {
  const [pin, setPin] = useState("");
  const [autoLocked, setAutoLocked] = useState(false);
  useEffect(() => setAutoLocked(new URLSearchParams(location.search).has("idle")), []);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [lockUntil, setLockUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const locked = lockUntil > now;

  // check for an active lock when the page opens
  useEffect(() => {
    fetch("/api/login", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.locked && setLockUntil(d.lockUntil))
      .catch(() => {});
  }, []);

  // tick the countdown while locked
  useEffect(() => {
    if (!lockUntil) return;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= lockUntil) {
        setLockUntil(0);
        setErr("");
      }
    }, 1000);
    return () => clearInterval(t);
  }, [lockUntil]);

  const submit = useCallback(async (value: string) => {
    if (value.length < 4 || busy || locked) return;
    setBusy(true);
    setErr("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: value }),
    });
    if (res.ok) {
      try { localStorage.setItem(ACTIVE_KEY, String(Date.now())); } catch { /* ignore */ }
      location.replace("/");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (data.locked) {
      setLockUntil(data.lockUntil);
      setNow(Date.now());
      setErr("");
    } else {
      const left = typeof data.remaining === "number" ? ` (ลองได้อีก ${data.remaining} ครั้ง)` : "";
      setErr((data.error || "เข้าสู่ระบบไม่สำเร็จ") + left);
    }
    setShake(Date.now());
    setPin("");
    setBusy(false);
  }, [busy, locked]);

  const press = useCallback((k: string) => {
    if (busy || locked) return;
    setErr("");
    if (k === "del") setPin((p) => p.slice(0, -1));
    else if (k) setPin((p) => (p.length < 8 ? p + k : p));
  }, [busy, locked]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") press("del");
      else if (e.key === "Enter") submit(pin);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [press, submit, pin]);

  return (
    <>
      <BgDeco />
      <main className="login">
        <div className="login-card glass-strong pop-in">
          <Piggy size={104} mood={locked ? "sleepy" : err ? "wow" : pin.length ? "happy" : "wink"} className="bob" />
          <h1>เป๋าตังค์</h1>
          <p>{autoLocked ? "🔒 ล็อกให้อัตโนมัติ เพราะไม่ได้ใช้งานเกิน 5 นาที — ใส่ PIN อีกครั้งนะคะ" : "ใส่ PIN เพื่อเข้าใช้งานค่ะ"}</p>
          <div className={`pin-dots ${shake ? "shake" : ""}`} key={shake} aria-live="polite" aria-label={`ใส่แล้ว ${pin.length} หลัก`}>
            {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
              <i key={i} className={i < pin.length ? "on" : ""} />
            ))}
          </div>
          {locked && (
            <div className="lock-box pop-in" role="alert">
              <LockKeyhole size={20} />
              <div>
                <b>ล็อกชั่วคราวเพื่อความปลอดภัย</b>
                <small>ใส่ PIN ผิดหลายครั้ง ลองใหม่ได้ในอีก <span className="num">{fmtLeft(lockUntil - now)}</span></small>
              </div>
            </div>
          )}
          <div className={`keypad ${locked ? "is-locked" : ""}`}>
            {KEYS.map((k, i) =>
              k === "" ? (
                <span key={i} />
              ) : (
                <button key={i} className={`key ${k === "del" ? "del" : ""}`} onClick={() => press(k)} aria-label={k === "del" ? "ลบ" : k} disabled={locked}>
                  {k === "del" ? <Delete size={22} /> : k}
                </button>
              ),
            )}
          </div>
          <button className="btn key go" disabled={busy || locked || pin.length < 4} onClick={() => submit(pin)}>
            {busy ? <span className="pulse">กำลังตรวจสอบ…</span> : "เข้าเลย 💖"}
          </button>
          {err && <div className="err pop-in" role="alert">{err} 🥺</div>}
        </div>
      </main>
    </>
  );
}
