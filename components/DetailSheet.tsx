"use client";
import { CalendarHeart, Clock, Landmark, Pencil, Receipt, Tag, Trash2, Wallet, StickyNote } from "lucide-react";
import { useState } from "react";
import { baht, fullDate, relativeDay, timeOf } from "@/lib/format";
import { iconFor, tintFor } from "@/lib/icons";
import type { Tx } from "@/lib/types";

interface Props {
  tx: Tx;
  onClose: () => void;
  onEdit: (tx: Tx) => void;
  onDeleted: (id: string) => void;
}

export default function DetailSheet({ tx, onClose, onEdit, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState("");
  const [zoom, setZoom] = useState(false);

  async function remove() {
    setBusy(true);
    setErr("");
    const res = await fetch(`/api/transactions/${tx.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(tx.id);
    else {
      setErr((await res.json().catch(() => ({}))).error || "ลบไม่สำเร็จ");
      setBusy(false);
      setConfirming(false);
    }
  }

  const rel = relativeDay(tx.date);
  const time = timeOf(tx.createdAt);
  const recurring = tx.note.endsWith("(ประจำ)");

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="รายละเอียดรายการ">
        <div className="grab" />
        <div className="detail-hero">
          <span className="dot big" style={{ background: tintFor(tx.category, tx.type) }}>{iconFor(tx.category, tx.type)}</span>
          <div>
            <small className="muted">{tx.type === "income" ? "รายรับ" : "รายจ่าย"}{tx.category ? ` · ${tx.category}` : ""}</small>
            <div className={`amt num hero-amt ${tx.type}`}>
              {tx.type === "income" ? "+" : "−"}{baht(tx.amount)} <small>บาท</small>
            </div>
          </div>
        </div>

        <dl className="kv">
          <dt><CalendarHeart size={16} /> วันที่</dt>
          <dd>{fullDate(tx.date)}{rel ? <span className="pill">{rel}</span> : null}</dd>
          {!recurring && time && (<><dt><Clock size={16} /> บันทึกเมื่อ</dt><dd className="num">{time} น.</dd></>)}
          {tx.note && (<><dt><StickyNote size={16} /> หมายเหตุ</dt><dd>{tx.note}</dd></>)}
          {tx.category && (<><dt><Tag size={16} /> หมวด</dt><dd>{tx.category}</dd></>)}
          {tx.account && (<><dt><Wallet size={16} /> บัญชี</dt><dd>{tx.account}</dd></>)}
          {tx.bank && (<><dt><Landmark size={16} /> ธนาคารผู้โอน</dt><dd>{tx.bank}</dd></>)}
          {tx.transRef && (<><dt><Receipt size={16} /> เลขอ้างอิง</dt><dd className="num small">{tx.transRef}</dd></>)}
        </dl>

        {tx.slipFileId && (
          <button className={`slip-frame ${zoom ? "zoom" : ""}`} onClick={() => setZoom(!zoom)} aria-label="ขยายสลิป">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/slip/${tx.slipFileId}`} alt="สลิป" loading="lazy" />
            <span className="slip-tag">🧾 สลิป · แตะเพื่อ{zoom ? "ย่อ" : "ขยาย"}</span>
          </button>
        )}

        {confirming ? (
          <div className="confirm pop-in">
            <p>ลบรายการนี้ใช่ไหมคะ? 🥺<br /><small>สลิปจะย้ายไปถังขยะใน Google Drive (กู้คืนได้ 30 วัน)</small></p>
            <div className="btn-row">
              <button className="btn ghost" disabled={busy} onClick={() => setConfirming(false)}>ไม่ลบแล้ว</button>
              <button className="btn danger-solid" disabled={busy} onClick={remove}>{busy ? "กำลังลบ…" : "ลบเลย"}</button>
            </div>
          </div>
        ) : (
          <div className="btn-row">
            <button className="btn ghost" onClick={() => onEdit(tx)}><Pencil size={18} /> แก้ไข</button>
            <button className="btn danger" onClick={() => setConfirming(true)}><Trash2 size={18} /> ลบ</button>
          </div>
        )}
        {err && <div className="err">{err}</div>}
      </div>
    </>
  );
}
