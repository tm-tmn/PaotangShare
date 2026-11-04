"use client";
import { useMemo, useState } from "react";
import { baht, daysInMonth, daysLeft, monthLabel, shiftMonth, todayISO, WEEKDAYS_SHORT } from "@/lib/format";
import { iconFor, PALETTE } from "@/lib/icons";
import type { Settings, Tx, TxType } from "@/lib/types";

const SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function Donut({ parts, total }: { parts: { label: string; value: number; color: string }[]; total: number }) {
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="สัดส่วนตามหมวด">
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--line)" strokeWidth="18" />
      {parts.map((p) => {
        const len = (p.value / total) * C;
        const el = (
          <circle
            key={p.label}
            cx="70" cy="70" r={R} fill="none" stroke={p.color} strokeWidth="18"
            strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${C}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 70 70)"
          />
        );
        offset += len;
        return el;
      })}
      <text x="70" y="66" textAnchor="middle" className="donut-sub">รวม</text>
      <text x="70" y="84" textAnchor="middle" className="donut-total">{baht(Math.round(total))}</text>
    </svg>
  );
}

function Bars({ data }: { data: { label: string; inc: number; exp: number }[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.inc, d.exp]));
  const W = 320, H = 150, pad = 18, gw = (W - 8) / data.length, bw = Math.min(16, gw / 3);
  return (
    <svg viewBox={`0 0 ${W} ${H + pad}`} className="bars" role="img" aria-label="รายรับรายจ่าย 6 เดือน">
      <line x1="0" x2={W} y1={H} y2={H} stroke="var(--line)" />
      {data.map((d, i) => {
        const x = 4 + i * gw + gw / 2;
        const hi = (d.inc / max) * (H - 10), he = (d.exp / max) * (H - 10);
        return (
          <g key={d.label}>
            <rect x={x - bw - 1} y={H - hi} width={bw} height={hi} rx="3" fill="var(--income)">
              <title>{`รับ ${baht(d.inc)}`}</title>
            </rect>
            <rect x={x + 1} y={H - he} width={bw} height={he} rx="3" fill="var(--expense)">
              <title>{`จ่าย ${baht(d.exp)}`}</title>
            </rect>
            <text x={x} y={H + 14} textAnchor="middle" className="bar-label">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function SpendCalendar({ items, month, onPickDay }: { items: Tx[]; month: string; onPickDay: (d: string) => void }) {
  const today = todayISO();
  const n = daysInMonth(month);
  const [y, m] = month.split("-").map(Number);
  const lead = new Date(y, m - 1, 1).getDay();
  const per: Record<string, { exp: number; inc: number }> = {};
  for (const t of items) {
    const e = (per[t.date] ||= { exp: 0, inc: 0 });
    if (t.type === "income") e.inc += t.amount;
    else e.exp += t.amount;
  }
  const max = Math.max(1, ...Object.values(per).map((v) => v.exp));
  return (
    <div className="cal">
      {WEEKDAYS_SHORT.map((w) => <span key={w} className="cal-h">{w}</span>)}
      {Array.from({ length: lead }, (_, i) => <span key={"e" + i} />)}
      {Array.from({ length: n }, (_, i) => {
        const d = `${month}-${String(i + 1).padStart(2, "0")}`;
        const v = per[d];
        const level = v?.exp ? Math.ceil((v.exp / max) * 4) : 0;
        return (
          <button
            key={d}
            className={`cal-d lv${level} ${d === today ? "today" : ""} ${v?.inc ? "has-inc" : ""}`}
            onClick={() => onPickDay(d)}
            aria-label={`วันที่ ${i + 1}${v ? ` จ่าย ${baht(v.exp)} บาท` : ""}`}
            title={v ? `จ่าย ${baht(v.exp)}${v.inc ? ` · รับ ${baht(v.inc)}` : ""}` : ""}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}

export default function StatsView({ allItems, month, settings, onPickDay }: { allItems: Tx[]; month: string; settings: Settings; onPickDay: (d: string) => void }) {
  const [kind, setKind] = useState<TxType>("expense");
  const monthItems = useMemo(() => allItems.filter((t) => t.date.startsWith(month)), [allItems, month]);

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of monthItems) if (t.type === kind) m.set(t.category || "ไม่ระบุ", (m.get(t.category || "ไม่ระบุ") || 0) + t.amount);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [monthItems, kind]);
  const catTotal = byCat.reduce((s, [, v]) => s + v, 0);
  const parts = byCat.map(([label, value], i) => ({ label, value, color: PALETTE[i % PALETTE.length] }));

  const trend = useMemo(() => {
    const out = [];
    for (let i = 5; i >= 0; i--) {
      const ym = shiftMonth(month, -i);
      let inc = 0, exp = 0;
      for (const t of allItems) if (t.date.startsWith(ym)) t.type === "income" ? (inc += t.amount) : (exp += t.amount);
      out.push({ label: SHORT[Number(ym.slice(5)) - 1], inc, exp, ym });
    }
    return out;
  }, [allItems, month]);

  const spent = useMemo(() => {
    const m: Record<string, number> = {};
    for (const t of monthItems) if (t.type === "expense") m[t.category] = (m[t.category] || 0) + t.amount;
    return m;
  }, [monthItems]);
  const budgets = Object.entries(settings.budgets).filter(([, v]) => v > 0);

  const accounts = useMemo(() => {
    const names = [...settings.accounts];
    if (allItems.some((t) => !t.account)) names.push("");
    return names.map((a) => {
      let net = 0, m = 0;
      for (const t of allItems) {
        if (t.account !== a) continue;
        const v = t.type === "income" ? t.amount : -t.amount;
        net += v;
        if (t.date.startsWith(month)) m += v;
      }
      return { name: a || "ไม่ระบุบัญชี", net, m };
    });
  }, [allItems, settings.accounts, month]);

  const avgExp = trend.slice(0, 5).filter((d) => d.exp > 0);
  const avg = avgExp.length ? avgExp.reduce((s, d) => s + d.exp, 0) / avgExp.length : 0;
  const thisExp = trend[5].exp;

  return (
    <>
      {(budgets.length > 0 || settings.monthlyLimit > 0) && (
        <section className="panel glass">
          <h3>🎯 งบประมาณ · {monthLabel(month)}</h3>
          {settings.monthlyLimit > 0 && (() => {
            const used = trend[5].exp, limit = settings.monthlyLimit;
            const pct = Math.round((used / limit) * 100);
            const level = pct >= 100 ? "over" : pct >= 80 ? "near" : "ok";
            const d = daysLeft(month);
            return (
              <div className="budget total">
                <div className="budget-top">
                  <b>วงเงินรวมทั้งเดือน</b>
                  <span className={`num ${level}`}>{baht(used)} / {baht(limit)}</span>
                </div>
                <div className="meter"><div className={level} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                <small className={level}>
                  {pct >= 100 ? `เกินวงเงิน ${baht(used - limit)} บาท` : `เหลือ ${baht(limit - used)} บาท (${pct}%)`}
                  {d && used < limit ? ` · วันละ ~${baht(Math.floor((limit - used) / d))} บาท อีก ${d} วัน` : ""}
                </small>
              </div>
            );
          })()}
          {budgets.map(([c, limit]) => {
            const used = spent[c] || 0;
            const pct = Math.round((used / limit) * 100);
            const level = pct >= 100 ? "over" : pct >= 80 ? "near" : "ok";
            return (
              <div key={c} className="budget">
                <div className="budget-top">
                  <span>{iconFor(c, "expense")} {c}</span>
                  <span className={`num ${level}`}>{baht(used)} / {baht(limit)}</span>
                </div>
                <div className="meter"><div className={level} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                <small className={level}>
                  {pct >= 100 ? `เกินงบ ${baht(used - limit)} บาท` : `เหลือ ${baht(limit - used)} บาท (${pct}%)`}
                </small>
              </div>
            );
          })}
        </section>
      )}

      <section className="panel glass">
        <h3>🗓️ ปฏิทินรายจ่าย</h3>
        <SpendCalendar items={monthItems} month={month} onPickDay={onPickDay} />
        <div className="cal-legend"><span>น้อย</span><i className="lv1" /><i className="lv2" /><i className="lv3" /><i className="lv4" /><span>มาก</span><span className="inc-mark">• มีรายรับ</span></div>
      </section>

      <section className="panel glass">
        <div className="panel-head">
          <h3>🍩 แยกตามหมวด</h3>
          <div className="seg mini">
            <button className={`expense ${kind === "expense" ? "on" : ""}`} onClick={() => setKind("expense")}>จ่าย</button>
            <button className={`income ${kind === "income" ? "on" : ""}`} onClick={() => setKind("income")}>รับ</button>
          </div>
        </div>
        {catTotal === 0 ? (
          <div className="empty-cute small">ไม่มี{kind === "income" ? "รายรับ" : "รายจ่าย"}ในเดือนนี้</div>
        ) : (
          <div className="donut-wrap">
            <Donut parts={parts} total={catTotal} />
            <ul className="legend">
              {parts.map((p) => (
                <li key={p.label}>
                  <i style={{ background: p.color }} />
                  <span>{p.label}</span>
                  <b className="num">{baht(Math.round(p.value))}</b>
                  <small className="num">{Math.round((p.value / catTotal) * 100)}%</small>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="panel glass">
        <h3>📈 6 เดือนล่าสุด</h3>
        <Bars data={trend} />
        <div className="legend-inline">
          <span><i style={{ background: "var(--income)" }} /> รายรับ</span>
          <span><i style={{ background: "var(--expense)" }} /> รายจ่าย</span>
        </div>
        {avg > 0 && (
          <p className="insight">
            เดือนนี้จ่ายไป <b className="num">{baht(Math.round(thisExp))}</b> บาท
            {thisExp > avg
              ? ` มากกว่าค่าเฉลี่ย 5 เดือนก่อน ${Math.round(((thisExp - avg) / avg) * 100)}%`
              : ` น้อยกว่าค่าเฉลี่ย 5 เดือนก่อน ${Math.round(((avg - thisExp) / avg) * 100)}%`}
          </p>
        )}
      </section>

      {accounts.length > 0 && (
        <section className="panel glass">
          <h3>👛 บัญชี / กระเป๋า</h3>
          <div className="list flat">
            {accounts.map((a) => (
              <div className="row" key={a.name}>
                <span className="mid">
                  <b>{a.name}</b>
                  <small className="num">เดือนนี้ {a.m >= 0 ? "+" : "−"}{baht(Math.abs(a.m))}</small>
                </span>
                <span className={`amt num ${a.net >= 0 ? "income" : "expense"}`}>{a.net >= 0 ? "" : "−"}{baht(Math.abs(a.net))}</span>
              </div>
            ))}
          </div>
          <small className="muted">ยอดสะสมจากรายการที่บันทึกในแอป (รับ − จ่าย)</small>
        </section>
      )}
    </>
  );
}
