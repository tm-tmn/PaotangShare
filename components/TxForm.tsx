"use client";
import { Camera, Sparkles, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { prepareSlip, type Prepared } from "@/lib/image";
import { baht, cleanAmount, dayLabel, fullDate, todayISO } from "@/lib/format";
import { iconFor } from "@/lib/icons";
import type { ScanResult, Settings, Tx, TxType } from "@/lib/types";

interface Props {
  settings: Settings;
  scanEnabled: boolean;
  editing?: Tx;
  file?: Blob | null;
  defaultDate?: string;
  queue?: { index: number; total: number };
  findByRef: (ref: string) => Tx | undefined;
  onClose: () => void;
  onSkip?: () => void;
  onSaved: (tx: Tx, wasEdit: boolean) => void;
}

function matchAccount(accounts: string[], bank?: string) {
  if (!bank) return "";
  const b = bank.replace(/^ธนาคาร/, "").trim();
  return accounts.find((a) => a && (a.includes(b) || b.includes(a.replace(/^ธนาคาร/, "").trim()))) || "";
}

const yesterdayISO = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayISO(d);
};

export default function TxForm({ settings, scanEnabled, editing, file, defaultDate, queue, findByRef, onClose, onSkip, onSaved }: Props) {
  const [type, setType] = useState<TxType>(editing?.type || "expense");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [category, setCategory] = useState(editing?.category || "");
  const [account, setAccount] = useState(editing ? editing.account : settings.accounts[0] || "");
  const [date, setDate] = useState(editing?.date || defaultDate || todayISO());
  const [note, setNote] = useState(editing?.note || "");
  const [bank, setBank] = useState(editing?.bank || "");
  const [transRef, setTransRef] = useState(editing?.transRef || "");
  const [slip, setSlip] = useState<Prepared | null>(null);
  const [reading, setReading] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanErr, setScanErr] = useState("");
  const [dup, setDup] = useState<Tx | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const touched = useRef<Set<string>>(new Set());
  const touch = (k: string) => touched.current.add(k);
  const typeRef = useRef(type);
  typeRef.current = type;

  function checkDup(ref: string) {
    const hit = ref ? findByRef(ref) : undefined;
    setDup(hit && hit.id !== editing?.id ? hit : null);
  }

  async function handleFile(f: Blob) {
    setErr("");
    setScan(null);
    setScanErr("");
    setDup(null);
    setReading("น้องหมูกำลังอ่าน QR…");
    let p: Prepared;
    try {
      p = await prepareSlip(f);
    } catch (e) {
      setErr("อ่านรูปไม่สำเร็จ: " + (e as Error).message);
      setReading("");
      return;
    }
    setSlip(p);
    const qr = p.qr;
    if (qr?.kind === "slip") {
      if (qr.transRef) {
        setTransRef(qr.transRef);
        checkDup(qr.transRef);
      }
      if (qr.bank) setBank(qr.bank);
      if (!touched.current.has("account")) {
        const acc = matchAccount(settings.accounts, qr.bank);
        if (acc) setAccount(acc);
      }
      // slip refs usually start with the transfer date (YYYYMMDD)
      const m = qr.transRef?.match(/^(20\d{2})(\d{2})(\d{2})/);
      if (m && !touched.current.has("date") && Number(m[2]) <= 12 && Number(m[3]) <= 31) setDate(`${m[1]}-${m[2]}-${m[3]}`);
    }
    if (qr?.kind === "promptpay") {
      if (qr.amount && !touched.current.has("amount")) setAmount(String(qr.amount));
      if (qr.payee && !touched.current.has("note")) setNote(qr.payee);
    }

    if (scanEnabled) {
      setReading("AI กำลังอ่านยอดเงินจากสลิป…");
      try {
        const fd = new FormData();
        fd.set("image", p.blob, "slip.jpg");
        fd.set("categories", [...settings.expenseCategories, ...settings.incomeCategories].join(", "));
        const res = await fetch("/api/scan", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const r: ScanResult = data.result;
        setScan(r);
        if (r.isSlip !== false) {
          const t = touched.current;
          if (r.amount && !t.has("amount")) setAmount(String(r.amount));
          if (r.date && !t.has("date")) setDate(r.date);
          if (!t.has("note")) {
            const who = typeRef.current === "income" ? r.fromName : r.toName;
            const n = [r.memo, who].filter(Boolean).join(" · ");
            if (n) setNote(n);
          }
          if (!t.has("category") && r.suggestedCategory) {
            const list = typeRef.current === "income" ? settings.incomeCategories : settings.expenseCategories;
            if (list.includes(r.suggestedCategory)) setCategory(r.suggestedCategory);
          }
          if (r.transRef && qr?.kind !== "slip") {
            setTransRef(r.transRef);
            checkDup(r.transRef);
          }
          if (r.fromBank && qr?.kind !== "slip") setBank(r.fromBank);
          if (!t.has("account")) {
            const acc = matchAccount(settings.accounts, r.fromBank || qr?.bank);
            if (acc) setAccount(acc);
          }
        }
      } catch (e) {
        setScanErr((e as Error).message);
      }
    }
    setReading("");
    setTimeout(() => amountRef.current?.focus({ preventScroll: true }), 50);
  }

  useEffect(() => {
    if (file) handleFile(file);
    else if (!editing) setTimeout(() => amountRef.current?.focus({ preventScroll: true }), 250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cats = type === "expense" ? settings.expenseCategories : settings.incomeCategories;
  const qr = slip?.qr;
  const amountNum = Number(amount);

  async function save() {
    if (!(amountNum > 0)) {
      setErr("ใส่จำนวนเงินก่อนนะคะ");
      amountRef.current?.focus();
      return;
    }
    setBusy(true);
    setErr("");
    const fd = new FormData();
    fd.set("type", type);
    fd.set("amount", amount);
    fd.set("date", date);
    fd.set("category", category);
    fd.set("note", note);
    fd.set("bank", bank);
    fd.set("transRef", transRef);
    fd.set("account", account);
    if (slip) fd.set("slip", slip.blob, "slip.jpg");
    try {
      const res = await fetch(editing ? `/api/transactions/${editing.id}` : "/api/transactions", {
        method: editing ? "PATCH" : "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
      onSaved(data.item, !!editing);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  const slipThumb = slip?.previewUrl || (editing?.slipFileId ? `/api/slip/${editing.slipFileId}` : "");
  const isLast = !queue || queue.index + 1 >= queue.total;

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className={`sheet ${type}`} role="dialog" aria-label={editing ? "แก้ไขรายการ" : "เพิ่มรายการ"}>
        <div className="grab" />
        <div className="sheet-head">
          <b>{editing ? "✏️ แก้ไขรายการ" : type === "income" ? "💰 เงินเข้า" : "🌸 จดรายจ่าย"}</b>
          {queue && queue.total > 1 && (
            <span className="badge">สลิป {queue.index + 1}/{queue.total}</span>
          )}
        </div>
        <div className="seg">
          <button className={`expense ${type === "expense" ? "on" : ""}`} onClick={() => { setType("expense"); if (!settings.expenseCategories.includes(category)) setCategory(""); }}>
            รายจ่าย
          </button>
          <button className={`income ${type === "income" ? "on" : ""}`} onClick={() => { setType("income"); if (!settings.incomeCategories.includes(category)) setCategory(""); }}>
            รายรับ
          </button>
          <i className="seg-pill" />
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) handleFile(f);
          }}
        />
        {slipThumb || reading ? (
          <div className={`slip-box ${reading ? "reading" : ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {slipThumb ? <img src={slipThumb} alt="สลิป" /> : <span className="img-ph" />}
            <div className="meta">
              {reading ? (
                <span className="pulse"><Sparkles size={14} /> {reading}</span>
              ) : !slip ? (
                <small>สลิปเดิม — กด “เปลี่ยน” เพื่อแนบใหม่</small>
              ) : (
                <>
                  {qr?.kind === "slip" ? (
                    <div className="ok">✓ QR สลิป · {qr.bank}</div>
                  ) : qr?.kind === "promptpay" ? (
                    <div className="ok">✓ QR พร้อมเพย์</div>
                  ) : (
                    <div className="muted">ไม่พบ QR ในรูป</div>
                  )}
                  {scan && scan.isSlip !== false && scan.amount ? (
                    <div className="ok">✨ AI อ่านยอด {baht(scan.amount)} บาท — เช็กอีกทีนะคะ</div>
                  ) : scan && scan.isSlip === false ? (
                    <small>AI: รูปนี้ไม่น่าใช่สลิป</small>
                  ) : scanErr ? (
                    <small className="warn">AI อ่านไม่สำเร็จ: {scanErr}</small>
                  ) : null}
                  {transRef && <small className="num">Ref {transRef}</small>}
                </>
              )}
            </div>
            <button className="icon-btn" onClick={() => fileRef.current?.click()} disabled={!!reading}>เปลี่ยน</button>
          </div>
        ) : (
          <button className="attach" onClick={() => fileRef.current?.click()}>
            <Camera size={20} /> แนบสลิป / รูป QR <small>(ไม่บังคับ)</small>
          </button>
        )}

        {dup && (
          <div className="dup pop-in" role="alert">
            <TriangleAlert size={18} />
            <div>
              <b>สลิปนี้บันทึกไปแล้วค่ะ</b>
              <small>{dayLabel(dup.date)} · {baht(dup.amount)} บาท{dup.note ? ` · ${dup.note}` : ""}</small>
            </div>
            {onSkip && queue && queue.total > 1 ? (
              <button className="chip on" onClick={onSkip}>ข้ามใบนี้</button>
            ) : (
              <button className="chip on" onClick={onClose}>ปิด</button>
            )}
          </div>
        )}

        <label className="f" htmlFor="amt">จำนวนเงิน</label>
        <div className="amount-input">
          <span className="cur">฿</span>
          <input
            id="amt"
            ref={amountRef}
            className="num"
            inputMode="decimal"
            enterKeyHint="done"
            placeholder="0"
            value={amount}
            onChange={(e) => { touch("amount"); setAmount(cleanAmount(e.target.value)); setErr(""); }}
          />
        </div>

        <label className="f">หมวด</label>
        <div className="chips">
          {cats.map((c) => (
            <button key={c} className={`chip ${category === c ? "on" : ""}`} onClick={() => { touch("category"); setCategory(category === c ? "" : c); }}>
              <span className="chip-ic">{iconFor(c, type)}</span>
              {c.replace(/^\p{Extended_Pictographic}\s*/u, "")}
            </button>
          ))}
        </div>

        {settings.accounts.length > 0 && (
          <>
            <label className="f">บัญชี / กระเป๋า</label>
            <div className="chips">
              {settings.accounts.map((a) => (
                <button key={a} className={`chip ${account === a ? "on" : ""}`} onClick={() => { touch("account"); setAccount(account === a ? "" : a); }}>
                  👛 {a}
                </button>
              ))}
            </div>
          </>
        )}

        <label className="f" htmlFor="dt">วันที่</label>
        <div className="date-row">
          <button className={`chip ${date === todayISO() ? "on" : ""}`} onClick={() => { touch("date"); setDate(todayISO()); }}>วันนี้</button>
          <button className={`chip ${date === yesterdayISO() ? "on" : ""}`} onClick={() => { touch("date"); setDate(yesterdayISO()); }}>เมื่อวาน</button>
          <input id="dt" className="in" type="date" value={date} max="2100-12-31" onChange={(e) => { touch("date"); if (e.target.value) setDate(e.target.value); }} />
        </div>
        <small className="date-hint">{fullDate(date)}</small>

        <label className="f" htmlFor="nt">หมายเหตุ</label>
        <input id="nt" className="in" placeholder="เช่น ชานมไข่มุก 🧋" value={note} onChange={(e) => { touch("note"); setNote(e.target.value); }} />

        <button className="btn" disabled={busy || !!reading} onClick={save}>
          {busy ? <span className="pulse">กำลังบันทึก…</span> : editing ? "บันทึกการแก้ไข 💾" : isLast ? "บันทึก 💖" : "บันทึก แล้วไปใบถัดไป →"}
        </button>
        {onSkip && queue && queue.total > 1 && !dup && (
          <button className="btn ghost" disabled={busy} onClick={onSkip}>ข้ามสลิปนี้</button>
        )}
        {err && <div className="err pop-in">{err}</div>}
      </div>
    </>
  );
}
