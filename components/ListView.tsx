"use client";
import { Paperclip, Repeat, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { baht, dayLabel, fullDate, relativeDay, timeOf, WEEKDAY_COLORS, weekdayOf } from "@/lib/format";
import { iconFor, tintFor } from "@/lib/icons";
import type { Settings, Tx } from "@/lib/types";
import { Piggy } from "./Cute";

interface Props {
  items: Tx[]; // already scoped to the month (and day, if picked)
  allItems: Tx[];
  settings: Settings;
  day: string | null;
  onOpen: (tx: Tx) => void;
  onAdd: () => void;
}

type TypeFilter = "all" | "income" | "expense";

export function TxRow({ t, i, onOpen, showDate }: { t: Tx; i: number; onOpen: (t: Tx) => void; showDate?: boolean }) {
  const recurring = t.note.endsWith("(ประจำ)");
  const title = (recurring ? t.note.replace(/\s*\(ประจำ\)$/, "") : t.note) || t.category || (t.type === "income" ? "รายรับ" : "รายจ่าย");
  const time = timeOf(t.createdAt);
  return (
    <button className="row" onClick={() => onOpen(t)} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
      <span className="dot" style={{ background: tintFor(t.category, t.type) }}>{iconFor(t.category, t.type)}</span>
      <span className="mid">
        <b>{title}</b>
        <small>
          {[t.category, t.account].filter(Boolean).join(" · ")}
          {t.slipFileId && <Paperclip size={12} className="inline-ic" aria-label="มีสลิป" />}
          {recurring && <Repeat size={12} className="inline-ic" aria-label="รายการประจำ" />}
        </small>
      </span>
      <span className="right">
        <span className={`amt num ${t.type}`}>{t.type === "income" ? "+" : "−"}{baht(t.amount)}</span>
        <small className="when">{showDate ? dayLabel(t.date) : recurring ? "ประจำเดือน" : time}</small>
      </span>
    </button>
  );
}

export default function ListView({ items, allItems, settings, day, onOpen, onAdd }: Props) {
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState<TypeFilter>("all");
  const [cat, setCat] = useState("");
  const [acc, setAcc] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const searching = q.trim().length > 0;
  const filtering = typeF !== "all" || !!cat || !!acc;
  const active = searching || filtering;

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (searching ? allItems : items).filter((t) => {
      if (typeF !== "all" && t.type !== typeF) return false;
      if (cat && t.category !== cat) return false;
      if (acc && t.account !== acc) return false;
      if (needle) {
        const hay = `${t.note} ${t.category} ${t.account} ${t.bank} ${t.transRef} ${t.amount}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [items, allItems, q, typeF, cat, acc, searching]);

  const groups = useMemo(() => {
    const m = new Map<string, Tx[]>();
    for (const t of filtered) m.set(t.date, [...(m.get(t.date) || []), t]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const total = filtered.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  const allCats = [...new Set([...settings.expenseCategories, ...settings.incomeCategories])];
  let rowIndex = 0;

  return (
    <>
      <div className="search">
        <label className="search-box glass">
          <Search size={18} aria-hidden="true" />
          <input type="search" placeholder="ค้นหาทุกเดือน…" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && (
            <button className="icon-btn tiny" aria-label="ล้างคำค้น" onClick={() => setQ("")}>
              <X size={16} />
            </button>
          )}
        </label>
        <button
          className={`round-btn glass ${showFilters || filtering ? "on" : ""}`}
          aria-label="ตัวกรอง"
          aria-expanded={showFilters}
          onClick={() => setShowFilters(!showFilters)}
        >
          <SlidersHorizontal size={18} />
          {filtering && <i className="ping" />}
        </button>
      </div>

      {showFilters && (
        <div className="filters glass pop-in">
          <div className="chips">
            {(["all", "expense", "income"] as const).map((t) => (
              <button key={t} className={`chip ${typeF === t ? "on" : ""}`} onClick={() => setTypeF(t)}>
                {t === "all" ? "ทั้งหมด" : t === "income" ? "💰 รายรับ" : "💸 รายจ่าย"}
              </button>
            ))}
          </div>
          <div className="filter-row">
            <select className="in" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="หมวด">
              <option value="">ทุกหมวด</option>
              {allCats.map((c) => <option key={c}>{c}</option>)}
            </select>
            {settings.accounts.length > 0 && (
              <select className="in" value={acc} onChange={(e) => setAcc(e.target.value)} aria-label="บัญชี">
                <option value="">ทุกบัญชี</option>
                {settings.accounts.map((a) => <option key={a}>{a}</option>)}
              </select>
            )}
          </div>
          {filtering && (
            <button className="link-btn" onClick={() => { setTypeF("all"); setCat(""); setAcc(""); }}>
              ล้างตัวกรอง
            </button>
          )}
        </div>
      )}

      {active && (
        <div className="result-bar pop-in">
          พบ <b>{filtered.length}</b> รายการ{searching ? " จากทุกเดือน" : ""} · รวม{" "}
          <b className={`num ${total >= 0 ? "income" : "expense"}`}>{total >= 0 ? "+" : "−"}{baht(Math.abs(total))}</b>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="empty-cute pop-in">
          <Piggy size={110} mood={active ? "wow" : "sleepy"} />
          {active ? (
            <p>ไม่พบรายการที่ตรงกันเลยค่ะ</p>
          ) : day ? (
            <>
              <p>{fullDate(day)}<br />ยังไม่มีรายการค่ะ</p>
              <button className="chip on" onClick={onAdd}>＋ จดรายการของวันนี้</button>
            </>
          ) : (
            <>
              <p>ยังไม่มีรายการในเดือนนี้<br />โยนสลิปเข้ามาให้น้องหมูได้เลย 💕</p>
              <button className="chip on" onClick={onAdd}>＋ จดรายการแรก</button>
            </>
          )}
        </div>
      ) : (
        groups.map(([date, list]) => {
          const inc = list.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
          const exp = list.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
          const rel = relativeDay(date);
          const wd = weekdayOf(date);
          return (
            <section className="day" key={date}>
              <h3>
                <span className="day-title">
                  <i className="wd-dot" style={{ background: WEEKDAY_COLORS[wd] }} />
                  {rel && <b className="rel">{rel}</b>}
                  <span>{dayLabel(date)}</span>
                </span>
                <span className="day-sum num">
                  {inc > 0 && <span className="income">+{baht(inc)}</span>}
                  {exp > 0 && <span className="expense">−{baht(exp)}</span>}
                </span>
              </h3>
              <div className="list glass">
                {list.map((t) => (
                  <TxRow key={t.id} t={t} i={rowIndex++} onOpen={onOpen} />
                ))}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}
