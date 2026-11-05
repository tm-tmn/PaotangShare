"use client";
import { useState } from "react";
import PinField from "@/components/PinField";
import { BgDeco, Piggy } from "@/components/Cute";

// reached from the e-mail link (/auth/confirm signs the person in with the recovery token first)
export default function Reset() {
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!/^\d{6}$/.test(pass)) return setErr("รหัสผ่านต้องเป็นตัวเลข 6 หลัก");
    if (pass !== pass2) return setErr("รหัสผ่านสองช่องไม่ตรงกัน");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pass }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "ตั้งรหัสผ่านไม่สำเร็จ");
      // sign out of the recovery session so the new password is used from now on
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      location.replace("/login?reset=1");
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <BgDeco />
      <main className="login">
        <div className="login-card glass-strong pop-in signup-card">
          <Piggy size={88} mood={err ? "wow" : "wink"} className="bob center" />
          <h1>ตั้งรหัสผ่านใหม่</h1>
          <form onSubmit={submit} noValidate>
            <label htmlFor="rs-pass">รหัสผ่านใหม่ (ตัวเลข 6 หลัก)</label>
            <PinField id="rs-pass" value={pass} onChange={setPass} />
            <label htmlFor="rs-pass2">ยืนยันรหัสผ่านอีกครั้ง</label>
            <PinField id="rs-pass2" value={pass2} onChange={setPass2} />
            <button className="btn" type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}</button>
            {err && <div className="err pop-in" role="alert">{err}</div>}
          </form>
        </div>
      </main>
    </>
  );
}
