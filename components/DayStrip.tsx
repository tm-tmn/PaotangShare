"use client";
import { useEffect, useMemo, useRef } from "react";
import { daysInMonth, todayISO, WEEKDAY_COLORS, WEEKDAYS_SHORT, weekdayOf } from "@/lib/format";
import type { Tx } from "@/lib/types";

interface Props {
  month: string; // YYYY-MM
  items: Tx[]; // items in this month
  day: string | null;
  onPick: (day: string | null) => void;
}

export default function DayStrip({ month, items, day, onPick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const today = todayISO();

  const perDay = useMemo(() => {
    const m: Record<string, { exp: number; inc: number; n: number }> = {};
    for (const t of items) {
      const e = (m[t.date] ||= { exp: 0, inc: 0, n: 0 });
      e.n++;
      if (t.type === "income") e.inc += t.amount;
      else e.exp += t.amount;
    }
    return m;
  }, [items]);
  const maxExp = Math.max(1, ...Object.values(perDay).map((v) => v.exp));

  const days = useMemo(
    () => Array.from({ length: daysInMonth(month) }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
    [month],
  );

  // keep the selected day (or today) in view
  useEffect(() => {
    const target = day || (today.startsWith(month) ? today : null);
    const el = target ? ref.current?.querySelector<HTMLElement>(`[data-day="${target}"]`) : null;
    if (el && ref.current) {
      ref.current.scrollTo({ left: el.offsetLeft - ref.current.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
    } else ref.current?.scrollTo({ left: 0 });
  }, [day, month, today]);

  return (
    <div className="daystrip" ref={ref} role="tablist" aria-label="เลือกวัน">
      <button className={`all-chip ${day ? "" : "on"}`} onClick={() => onPick(null)} role="tab" aria-selected={!day}>
        <small>ดู</small>
        <b>ทั้งเดือน</b>
      </button>
      {days.map((d) => {
        const wd = weekdayOf(d);
        const info = perDay[d];
        const future = d > today;
        return (
          <button
            key={d}
            data-day={d}
            role="tab"
            aria-selected={day === d}
            aria-label={`วันที่ ${Number(d.slice(8))}${info ? ` มี ${info.n} รายการ` : ""}`}
            className={`day-chip ${day === d ? "on" : ""} ${d === today ? "today" : ""} ${future ? "future" : ""}`}
            style={{ "--wd": WEEKDAY_COLORS[wd] } as React.CSSProperties}
            onClick={() => onPick(day === d ? null : d)}
          >
            <small>{WEEKDAYS_SHORT[wd]}</small>
            <b>{Number(d.slice(8))}</b>
            <span className="spend">
              {info ? <i style={{ height: `${Math.max(18, (info.exp / maxExp) * 100)}%` }} className={info.exp ? "" : "inc"} /> : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
