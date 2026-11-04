"use client";
import { useState } from "react";
import { baht, todayISO } from "@/lib/format";
import { iconFor } from "@/lib/icons";
import type { Recurring, Settings, TxType } from "@/lib/types";
import type { Me } from "@/app/page";

function TagEditor({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState("");
  const add = () => {
    const s = v.trim();
    if (s && !items.includes(s)) onChange([...items, s]);
    setV("");
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <>
      <div className="chips">
        {items.map((c, i) => (
          <span key={c} className="chip tag">
            {i > 0 && <button className="tag-move" aria-label="เลื่อนไปข้างหน้า" onClick={() => move(i, -1)}>‹</button>}
            {c}
            <button className="tag-x" aria-label={`ลบ ${c}`} onClick={() => onChange(items.filter((x) => x !== c))}>×</button>
          </span>
        ))}
      </div>
      <div className="add-row">
        <input className="in" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="chip on" onClick={add}>เพิ่ม</button>
      </div>
    </>
  );
}

const blankRec = (s: Settings): Recurring => ({
  id: "",
  day: 1,
  type: "expense",
  amount: 0,
  category: s.expenseCategories[0] || "",
  note: "",
  account: s.accounts[0] || "",
});

interface Props {
  settings: Settings;
  scanEnabled: boolean;
  me: Me | null;
  onMe: (u: Partial<Me> & { hasGeminiKey: boolean }) => void;
  onSaved: (s: Settings) => void;
  onLogout: () => void;
}

function AccountCards({ me, scanEnabled, onMe }: { me: Me | null; scanEnabled: boolean; onMe: Props["onMe"] }) {
  const [name, setName] = useState(me?.name || "");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<{ card: string; ok: boolean; text: string } | null>(null);
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 8);

  async function patch(card: string, body: Record<string, string>, okText: string) {
    setBusy(card);
    setNote(null);
    try {
      const res = await fetch("/api/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      onMe(data.user);
      setNote({ card, ok: true, text: okText });
      return true;
    } catch (e) {
      setNote({ card, ok: false, text: (e as Error).message });
      return false;
    } finally {
      setBusy("");
    }
  }
  const Note = ({ card }: { card: string }) =>
    note?.card === card ? <p className={note.ok ? "ok" : "err"} role="status">{note.text}</p> : null;

  return (
    <>
      <section className="panel glass">
        <h3>🙋 บัญชีของฉัน</h3>
        <p className="hint">{me?.email}</p>
        <div className="add-row">
          <input className="in" aria-label="ชื่อที่ใช้แสดง" placeholder="ชื่อที่ใช้แสดง" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          <button className="chip on" disabled={busy === "name" || !name.trim() || name.trim() === me?.name} onClick={() => patch("name", { name: name.trim() }, "เปลี่ยนชื่อแล้ว")}>บันทึก</button>
        </div>
        <Note card="name" />
        <h4 style={{ margin: "14px 0 6px" }}>🔑 เปลี่ยน PIN</h4>
        <div className="date-row">
          <input className="in num" type="password" inputMode="numeric" autoComplete="current-password" placeholder="PIN ปัจจุบัน" aria-label="PIN ปัจจุบัน" value={cur} onChange={(e) => setCur(digits(e.target.value))} />
          <input className="in num" type="password" inputMode="numeric" autoComplete="new-password" placeholder="PIN ใหม่ 6–8 หลัก" aria-label="PIN ใหม่" value={next} onChange={(e) => setNext(digits(e.target.value))} />
        </div>
        <button
          className="btn ghost"
          style={{ marginTop: 10 }}
          disabled={busy === "pin" || cur.length < 4 || next.length < 6}
          onClick={async () => {
            if (await patch("pin", { currentPin: cur, newPin: next }, "เปลี่ยน PIN แล้ว — ครั้งหน้าใช้ PIN ใหม่ และไฟล์ PDF ใหม่จะใช้ PIN ใหม่เป็นรหัส")) {
              setCur("");
              setNext("");
            }
          }}
        >
          เปลี่ยน PIN
        </button>
        <Note card="pin" />
        {me?.isAdmin && (
          <a className="btn" style={{ marginTop: 12, textAlign: "center" }} href="/admin">👑 จัดการผู้ใช้</a>
        )}
      </section>

      <section className="panel glass">
        <h3>✨ AI อ่านสลิป</h3>
        {me?.hasGeminiKey ? (
          <>
            <p className="ok">✓ ใช้คีย์ของคุณอยู่ — แอปจะอ่านยอด วันที่ และชื่อผู้รับจากสลิปให้อัตโนมัติ</p>
            <button className="btn ghost" disabled={busy === "key"} onClick={() => patch("key", { geminiKey: "" }, "ลบคีย์แล้ว")}>ลบคีย์ของฉัน</button>
          </>
        ) : (
          <>
            {scanEnabled && me?.sharedAiKey ? (
              <p className="ok">✓ ใช้คีย์กลางของผู้ดูแลอยู่ — ใส่คีย์ของตัวเองได้ถ้าต้องการ</p>
            ) : (
              <p className="hint">
                ใส่คีย์ Gemini ของคุณเอง (ฟรี) — ขอได้ที่ <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>{" "}
                ไม่ใส่ก็ใช้แอปได้ แค่ต้องกรอกยอดเอง (QR ยังอ่านได้ปกติ)
              </p>
            )}
            <div className="add-row">
              <input className="in" aria-label="คีย์ Gemini" placeholder="AIza…" value={key} autoComplete="off" onChange={(e) => setKey(e.target.value.trim())} />
              <button className="chip on" disabled={busy === "key" || key.length < 20} onClick={async () => { if (await patch("key", { geminiKey: key }, "บันทึกคีย์แล้ว ✨")) setKey(""); }}>บันทึก</button>
            </div>
            <p className="hint">รูปสลิปจะถูกส่งไปที่ Google เพื่ออ่าน และคีย์จะเก็บไว้ในระบบของผู้ดูแลแอป</p>
          </>
        )}
        <Note card="key" />
      </section>
    </>
  );
}

export default function SettingsView({ settings, scanEnabled, me, onMe, onSaved, onLogout }: Props) {
  const [s, setS] = useState<Settings>(settings);
  const [rec, setRec] = useState<Recurring>(blankRec(settings));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  async function save(next = s) {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setS(data.settings);
      onSaved(data.settings);
      setMsg("บันทึกการตั้งค่าแล้ว ✓");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const [pFrom, setPFrom] = useState(() => todayISO().slice(0, 8) + "01");
  const [pTo, setPTo] = useState(() => todayISO());
  const [pdfBusy, setPdfBusy] = useState(false);

  function preset(kind: "7d" | "month" | "last") {
    const now = new Date();
    const iso = (d: Date) => todayISO(d);
    if (kind === "7d") {
      const a = new Date(now);
      a.setDate(a.getDate() - 6);
      setPFrom(iso(a));
      setPTo(iso(now));
    } else if (kind === "month") {
      setPFrom(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
      setPTo(iso(now));
    } else {
      setPFrom(iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
      setPTo(iso(new Date(now.getFullYear(), now.getMonth(), 0)));
    }
  }

  async function downloadPdf() {
    if (!pFrom || !pTo || pFrom > pTo) {
      setErr("เลือกช่วงวันที่ให้ถูกต้องก่อนนะ (วันเริ่มต้องไม่เกินวันสิ้นสุด)");
      return;
    }
    setPdfBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch(`/api/report?from=${pFrom}&to=${pTo}`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "สร้าง PDF ไม่สำเร็จ");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `paotang-${pFrom}_${pTo}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setMsg("สร้าง PDF แล้ว — รหัสผ่านเปิดไฟล์คือ PIN ของคุณ");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setPdfBusy(false);
    }
  }

  async function testEmail() {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/settings", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg(data.pdf ? `ส่งสรุปพร้อม PDF ไปที่ ${data.to} แล้ว` : `ส่งสรุปไปที่ ${data.to} แล้ว (ยังไม่ได้แนบ PDF — บันทึกการตั้งค่าอีกครั้ง แล้วลองใหม่)`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addRecurring() {
    if (!(rec.amount > 0)) return setErr("ใส่ยอดของรายการประจำก่อน");
    setErr("");
    set("recurring", [...s.recurring, { ...rec, id: crypto.randomUUID() }]);
    setRec(blankRec(s));
  }

  const budgetSum = Object.values(s.budgets).reduce((a, b) => a + b, 0);
  const recCats = rec.type === "income" ? s.incomeCategories : s.expenseCategories;

  return (
    <div className="settings">
      <section className="panel glass">
        <h3>💗 วงเงินใช้จ่ายต่อเดือน</h3>
        <p className="hint">รายจ่ายรวมทุกหมวดต่อเดือน — แสดงบนหน้าหลักและเตือนเมื่อใช้ถึง 80% (เว้นว่าง = ไม่จำกัด)</p>
        <div className="amount-input">
          <input
            className="num"
            inputMode="numeric"
            placeholder="ไม่จำกัด"
            value={s.monthlyLimit || ""}
            onChange={(e) => set("monthlyLimit", Number(e.target.value.replace(/\D/g, "")) || 0)}
          />
          <span>บาท/เดือน</span>
        </div>
        {s.monthlyLimit > 0 && budgetSum > s.monthlyLimit && (
          <small className="near">งบรายหมวดรวมกัน {baht(budgetSum)} บาท มากกว่าวงเงินรวม</small>
        )}
      </section>

      <section className="panel glass">
        <h3>🌸 หมวดรายจ่าย</h3>
        <TagEditor items={s.expenseCategories} onChange={(v) => set("expenseCategories", v)} placeholder="เพิ่มหมวด เช่น ☕ กาแฟ" />
      </section>

      <section className="panel glass">
        <h3>💰 หมวดรายรับ</h3>
        <TagEditor items={s.incomeCategories} onChange={(v) => set("incomeCategories", v)} placeholder="เพิ่มหมวดรายรับ" />
      </section>

      <section className="panel glass">
        <h3>👛 บัญชี / กระเป๋า</h3>
        <p className="hint">ตั้งชื่อให้มีชื่อธนาคาร เช่น “กสิกร” หรือ “ไทยพาณิชย์” แอปจะเลือกบัญชีให้อัตโนมัติจากสลิป</p>
        <TagEditor items={s.accounts} onChange={(v) => set("accounts", v)} placeholder="เช่น เงินสด, กสิกร, ไทยพาณิชย์" />
      </section>

      <section className="panel glass">
        <h3>🎯 งบประมาณรายหมวด</h3>
        <p className="hint">เว้นว่างหมวดที่ไม่ต้องการตั้งงบ — แอปจะเตือนเมื่อใช้ถึง 80%</p>
        {s.expenseCategories.map((c) => (
          <div className="budget-input" key={c}>
            <span>{iconFor(c, "expense")} {c.replace(/^\p{Extended_Pictographic}\s*/u, "")}</span>
            <input
              className="in num"
              inputMode="numeric"
              placeholder="—"
              value={s.budgets[c] || ""}
              onChange={(e) => {
                const n = Number(e.target.value.replace(/\D/g, ""));
                const b = { ...s.budgets };
                if (n > 0) b[c] = n;
                else delete b[c];
                set("budgets", b);
              }}
            />
          </div>
        ))}
      </section>

      <section className="panel glass">
        <h3>🔁 รายการประจำทุกเดือน</h3>
        <p className="hint">ลงรายการให้อัตโนมัติเมื่อถึงวันที่กำหนด (เช่น ค่าเช่า ค่าเน็ต เงินเดือน)</p>
        {s.recurring.length > 0 && (
          <div className="list flat">
            {s.recurring.map((r) => (
              <div className="row" key={r.id}>
                <span className="mid">
                  <b>{r.note || r.category}</b>
                  <small>ทุกวันที่ {r.day} · {r.category}{r.account ? ` · ${r.account}` : ""}</small>
                </span>
                <span className={`amt num ${r.type}`}>{r.type === "income" ? "+" : "−"}{baht(r.amount)}</span>
                <button className="icon-btn" aria-label="ลบ" onClick={() => set("recurring", s.recurring.filter((x) => x.id !== r.id))}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div className="rec-form">
          <div className="seg mini">
            {(["expense", "income"] as TxType[]).map((t) => (
              <button key={t} className={`${t} ${rec.type === t ? "on" : ""}`}
                onClick={() => setRec({ ...rec, type: t, category: (t === "income" ? s.incomeCategories : s.expenseCategories)[0] || "" })}>
                {t === "income" ? "รายรับ" : "รายจ่าย"}
              </button>
            ))}
          </div>
          <div className="rec-grid">
            <input className="in num" inputMode="decimal" placeholder="ยอด (บาท)" value={rec.amount || ""}
              onChange={(e) => setRec({ ...rec, amount: Number(e.target.value.replace(/[^\d.]/g, "")) })} />
            <select className="in" value={rec.day} onChange={(e) => setRec({ ...rec, day: Number(e.target.value) })}>
              {Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>วันที่ {i + 1}</option>)}
            </select>
            <select className="in" value={rec.category} onChange={(e) => setRec({ ...rec, category: e.target.value })}>
              {recCats.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="in" value={rec.account} onChange={(e) => setRec({ ...rec, account: e.target.value })}>
              <option value="">ไม่ระบุบัญชี</option>
              {s.accounts.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
          <input className="in" placeholder="ชื่อรายการ เช่น ค่าเช่าห้อง" value={rec.note} onChange={(e) => setRec({ ...rec, note: e.target.value })} />
          <button className="btn ghost" onClick={addRecurring}>＋ เพิ่มรายการประจำ</button>
        </div>
      </section>

      <section className="panel glass">
        <h3>📄 สรุป PDF</h3>
        <p className="hint">ไฟล์ PDF สีหวาน ๆ รวมรายการทั้งหมดในช่วงที่เลือก — เปิดไฟล์ด้วย PIN ที่คุณใช้เข้าแอป</p>
        <div className="chips">
          <button className="chip" onClick={() => preset("7d")}>7 วันล่าสุด</button>
          <button className="chip" onClick={() => preset("month")}>เดือนนี้</button>
          <button className="chip" onClick={() => preset("last")}>เดือนที่แล้ว</button>
        </div>
        <div className="date-row" style={{ marginTop: 10 }}>
          <input className="in" type="date" aria-label="ตั้งแต่วันที่" value={pFrom} max={pTo || undefined} onChange={(e) => setPFrom(e.target.value)} />
          <input className="in" type="date" aria-label="ถึงวันที่" value={pTo} min={pFrom || undefined} onChange={(e) => setPTo(e.target.value)} />
        </div>
        <button className="btn" style={{ marginTop: 12 }} disabled={pdfBusy} onClick={downloadPdf}>{pdfBusy ? "กำลังสร้าง PDF…" : "ดาวน์โหลด PDF"}</button>
      </section>

      <section className="panel glass">
        <h3>💌 สรุปทางอีเมล</h3>
        <label className="switch">
          <input type="checkbox" checked={s.weeklyEmail} onChange={(e) => set("weeklyEmail", e.target.checked)} />
          <span>ส่งสรุปรายสัปดาห์ทุกวันอาทิตย์ 19:00 ไปที่อีเมลของคุณ พร้อมแนบ PDF (รหัสผ่าน = PIN ของคุณ)</span>
        </label>
        <button className="btn ghost" disabled={busy} onClick={testEmail}>ส่งสรุปให้ดูตอนนี้</button>
      </section>

      <AccountCards key={me?.id || "-"} me={me} scanEnabled={scanEnabled} onMe={onMe} />

      <section className="panel glass links">
        {me?.isAdmin ? <a href="/setup">🔌 ตรวจสถานะการเชื่อมต่อ</a> : <span />}
        <button className="link-btn danger-text" onClick={onLogout}>🚪 ออกจากระบบ</button>
      </section>

      {msg && !dirty && <p className="ok">{msg}</p>}
      {(dirty || err) && (
        <div className="save-bar">
          {err && <div className="err">{err}</div>}
          <button className="btn" disabled={busy || !dirty} onClick={() => save()}>
            {busy ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
          </button>
        </div>
      )}
    </div>
  );
}
