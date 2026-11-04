"use client";
import { ChartPie, ChevronLeft, ChevronRight, House, Paperclip, Plus, RefreshCw, Settings as Cog } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BgDeco, Celebrate, Piggy, Skeleton } from "@/components/Cute";
import DayStrip from "@/components/DayStrip";
import DetailSheet from "@/components/DetailSheet";
import ListView from "@/components/ListView";
import SettingsView from "@/components/SettingsView";
import StatsView from "@/components/StatsView";
import TxForm from "@/components/TxForm";
import { ACTIVE_KEY, IDLE_MS } from "@/lib/idle";
import { baht, daysLeft, fullDate, greeting, monthLabel, shiftMonth, todayISO } from "@/lib/format";
import { DEFAULT_SETTINGS, type Settings, type Tx } from "@/lib/types";

type Tab = "list" | "stats" | "settings";
export interface Me {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  hasGeminiKey: boolean;
  isAdmin: boolean;
  sharedAiKey: boolean;
}
type Sheet =
  | { kind: "add"; queue: Blob[]; index: number }
  | { kind: "edit"; tx: Tx }
  | { kind: "detail"; tx: Tx }
  | null;
interface BIPEvent extends Event { prompt: () => Promise<void> }

const CACHE_KEY = "pt-cache-v1";
const sortTx = (a: Tx, b: Tx) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt);

function readCache(): { items: Tx[]; settings: Settings } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeCache(items: Tx[], settings: Settings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ items, settings }));
  } catch {
    /* storage full or blocked — fine */
  }
}

export default function Home() {
  const [items, setItems] = useState<Tx[] | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [scanEnabled, setScanEnabled] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState<Tab>("list");
  const [month, setMonthRaw] = useState(todayISO().slice(0, 7));
  const [day, setDay] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState("");
  const [party, setParty] = useState(0);
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [iosTip, setIosTip] = useState(false);
  const [hello, setHello] = useState("");
  const slipInput = useRef<HTMLInputElement>(null);

  const setMonth = (m: string) => {
    setMonthRaw(m);
    setDay(null);
  };

  const locking = useRef(false); // set when auto-lock is sending us to the PIN screen
  const load = useCallback(async () => {
    if (locking.current) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/bootstrap", { cache: "no-store" });
      if (res.status === 401) return location.replace("/login");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(data.items);
      setSettings(data.settings);
      setScanEnabled(!!data.scanEnabled);
      setMe({ ...data.user, isAdmin: !!data.isAdmin, sharedAiKey: !!data.sharedAiKey });
      writeCache(data.items, data.settings);
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setItems((cur) => cur || []);
    } finally {
      setSyncing(false);
    }
  }, []);

  // auto-lock: no touch/keys for IDLE_MS (or the app sat in the background that long) -> back to the PIN screen
  useEffect(() => {
    let last = Date.now();
    try {
      const stored = Number(localStorage.getItem(ACTIVE_KEY));
      if (stored) last = stored;
    } catch { /* ignore */ }
    const lock = async () => {
      if (locking.current) return;
      locking.current = true;
      try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ }
      await fetch("/api/login", { method: "DELETE" }).catch(() => {});
      location.replace("/login?idle=1");
    };
    const idle = () => Date.now() - last > IDLE_MS;
    if (idle()) {
      lock();
      return;
    }
    let saved = 0;
    let pinged = Date.now();
    const touch = () => {
      last = Date.now();
      if (last - saved > 3000) {
        saved = last;
        try { localStorage.setItem(ACTIVE_KEY, String(last)); } catch { /* ignore */ }
      }
      // keep the server-side session alive while the person is busy in the UI (no other requests needed)
      if (last - pinged > 60_000) {
        pinged = last;
        fetch("/api/ping", { cache: "no-store" }).then((r) => { if (r.status === 401) lock(); }).catch(() => {});
      }
    };
    touch();
    const events = ["pointerdown", "keydown", "touchstart", "scroll", "input"] as const;
    events.forEach((e) => addEventListener(e, touch, { capture: true, passive: true }));
    const tick = setInterval(() => idle() && lock(), 10_000);
    const onShow = () => {
      if (document.visibilityState === "visible" && idle()) lock();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      events.forEach((e) => removeEventListener(e, touch, { capture: true }));
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  useEffect(() => {
    if (locking.current) return; // the lock effect above is sending us to the PIN screen
    setHello(greeting());
    const cached = readCache();
    if (cached) {
      setItems(cached.items);
      setSettings({ ...DEFAULT_SETTINGS, ...cached.settings });
    }
    load();
    if (new URLSearchParams(location.search).get("shared")) {
      history.replaceState(null, "", "/");
      caches.open("pt-share").then(async (c) => {
        const blobs: Blob[] = [];
        for (const k of await c.keys()) {
          const r = await c.match(k);
          if (r) blobs.push(await r.blob());
          await c.delete(k);
        }
        if (blobs.length) setSheet({ kind: "add", queue: blobs, index: 0 });
      });
    }
    const standalone = matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (!standalone && /iphone|ipad/i.test(navigator.userAgent)) setIosTip(true);
    const onBip = (e: Event) => { e.preventDefault(); setInstallEvt(e as BIPEvent); };
    addEventListener("beforeinstallprompt", onBip);
    // refresh when coming back to the app
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      removeEventListener("beforeinstallprompt", onBip);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  // keep the offline cache in step with local edits
  useEffect(() => {
    if (items && !locking.current) writeCache(items, settings);
  }, [items, settings]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2200); };

  const all = useMemo(() => items || [], [items]);
  const refIndex = useMemo(() => {
    const m = new Map<string, Tx>();
    for (const t of all) if (t.transRef) m.set(t.transRef, t);
    return m;
  }, [all]);
  const monthItems = useMemo(() => all.filter((t) => t.date.startsWith(month)), [all, month]);
  const shown = useMemo(() => (day ? monthItems.filter((t) => t.date === day) : monthItems), [monthItems, day]);

  const totals = useMemo(() => {
    let inc = 0, exp = 0;
    for (const t of monthItems) t.type === "income" ? (inc += t.amount) : (exp += t.amount);
    return { inc, exp, net: inc - exp };
  }, [monthItems]);

  const limit = useMemo(() => {
    const cap = settings.monthlyLimit;
    if (!(cap > 0)) return null;
    const left = cap - totals.exp;
    const pct = Math.round((totals.exp / cap) * 100);
    const d = daysLeft(month);
    return { left, pct, level: pct >= 100 ? "over" : pct >= 80 ? "near" : "ok", perDay: d && left > 0 ? Math.floor(left / d) : null };
  }, [settings.monthlyLimit, totals.exp, month]);

  const budgetAlerts = useMemo(() => {
    const spent: Record<string, number> = {};
    for (const t of monthItems) if (t.type === "expense") spent[t.category] = (spent[t.category] || 0) + t.amount;
    return Object.entries(settings.budgets)
      .filter(([c, cap]) => cap > 0 && (spent[c] || 0) >= cap * 0.8)
      .map(([c, cap]) => ({ c, pct: Math.round(((spent[c] || 0) / cap) * 100) }));
  }, [monthItems, settings.budgets]);

  function nextInQueue() {
    setSheet((s) => (s?.kind === "add" && s.index + 1 < s.queue.length ? { ...s, index: s.index + 1 } : null));
  }

  async function logout() {
    await fetch("/api/login", { method: "DELETE" });
    try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(ACTIVE_KEY); } catch { /* ignore */ }
    location.replace("/login");
  }

  const needsSetup = /ยังไม่ได้ตั้งค่า|เวอร์ชันเก่า|SECRET/.test(error);
  const isThisMonth = month === todayISO().slice(0, 7);
  const addDefaultDate = day || (isThisMonth ? todayISO() : `${month}-01`);

  return (
    <>
      <BgDeco />
      <main className="wrap">
        <header className="top">
          <div className="hello">
            <Piggy size={46} mood={limit?.level === "over" ? "wow" : "happy"} className="bob" />
            <div>
              <small>{hello || "สวัสดีค่ะ"}{me?.name ? ` คุณ${me.name}` : ""}</small>
              <b>เป๋าตังค์</b>
            </div>
          </div>
          <button className={`round-btn glass ${syncing ? "spin" : ""}`} aria-label="รีเฟรช" onClick={load} disabled={syncing}>
            <RefreshCw size={18} />
          </button>
        </header>

        {tab !== "settings" && (
          <section className="card-balance">
            <i className="spark s1">✦</i><i className="spark s2">✧</i><i className="spark s3">♡</i>
            <div className="month-nav">
              <button aria-label="เดือนก่อน" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={20} /></button>
              <button className="month-label" onClick={() => setMonth(todayISO().slice(0, 7))} aria-label="กลับเดือนนี้">
                {monthLabel(month)}
                {!isThisMonth && <small>แตะเพื่อกลับเดือนนี้</small>}
              </button>
              <button aria-label="เดือนถัดไป" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={20} /></button>
            </div>
            <div className="balance-label">คงเหลือเดือนนี้</div>
            <div className="balance num" key={month + totals.net}>{totals.net < 0 ? "−" : ""}{baht(Math.abs(totals.net))} <small>฿</small></div>
            <div className="split">
              <div><small>💰 รายรับ</small><b className="num">{baht(totals.inc)}</b></div>
              <div><small>💸 รายจ่าย</small><b className="num">{baht(totals.exp)}</b></div>
            </div>
            {limit && (
              <button className="limit" onClick={() => setTab("stats")}>
                <div className="limit-top">
                  <span>💗 วงเงินเดือนนี้</span>
                  <span className="num">{baht(totals.exp)} / {baht(settings.monthlyLimit)}</span>
                </div>
                <div className="meter"><div className={limit.level} style={{ width: `${Math.min(limit.pct, 100)}%` }} /></div>
                <small>
                  {limit.left < 0
                    ? `เกินวงเงิน ${baht(-limit.left)} บาท 🥺`
                    : `เหลือ ${baht(limit.left)} บาท` + (limit.perDay !== null ? ` · ใช้ได้อีกวันละ ~${baht(limit.perDay)} บาท` : "")}
                </small>
              </button>
            )}
          </section>
        )}

        {installEvt && (
          <div className="install-tip glass pop-in">
            📲 ติดตั้งเป๋าตังค์ไว้บนหน้าจอ
            <button className="chip on" onClick={() => { installEvt.prompt(); setInstallEvt(null); }}>ติดตั้ง</button>
          </div>
        )}
        {iosTip && (
          <div className="install-tip glass pop-in">
            📲 กดปุ่ม แชร์ แล้วเลือก “เพิ่มไปยังหน้าจอโฮม” เพื่อติดตั้งแอป
            <button className="icon-btn" aria-label="ปิด" onClick={() => setIosTip(false)}>✕</button>
          </div>
        )}

        {tab === "list" && limit && limit.pct >= 80 && (
          <button className={`alert ${limit.level} pop-in`} onClick={() => setTab("stats")}>
            {limit.pct >= 100 ? "🚨 ใช้เกินวงเงินเดือนนี้แล้วนะคะ" : `⚠️ ใช้ไป ${limit.pct}% ของวงเงินเดือนนี้แล้ว`}
          </button>
        )}
        {tab === "list" && budgetAlerts.length > 0 && (
          <button className="alert pop-in" onClick={() => setTab("stats")}>
            🎯 {budgetAlerts.map((a) => `${a.c} ${a.pct}%`).join(" · ")} ของงบเดือนนี้
          </button>
        )}

        {tab === "list" && items !== null && !needsSetup && (
          <>
            <DayStrip month={month} items={monthItems} day={day} onPick={setDay} />
            {day && (
              <div className="day-banner pop-in">
                <span>📅 {fullDate(day)}</span>
                <button className="link-btn" onClick={() => setDay(null)}>ดูทั้งเดือน</button>
              </div>
            )}
          </>
        )}

        {needsSetup ? (
          <div className="empty-cute">
            <Piggy size={110} mood="wow" />
            <p>{error}</p>
            <a className="chip on" href="/setup">ไปหน้าตรวจสถานะ →</a>
          </div>
        ) : error && !items?.length ? (
          <div className="empty-cute">
            <Piggy size={110} mood="sleepy" />
            <p className="err">{error}</p>
            <button className="chip on" onClick={load}>ลองใหม่</button>
          </div>
        ) : items === null ? (
          <Skeleton rows={5} />
        ) : tab === "list" ? (
          <ListView
            items={shown}
            allItems={all}
            settings={settings}
            day={day}
            onOpen={(tx) => setSheet({ kind: "detail", tx })}
            onAdd={() => setSheet({ kind: "add", queue: [], index: 0 })}
          />
        ) : tab === "stats" ? (
          <StatsView allItems={all} month={month} settings={settings} onPickDay={(d) => { setDay(d); setTab("list"); }} />
        ) : (
          <SettingsView
            settings={settings}
            scanEnabled={scanEnabled}
            me={me}
            onMe={(u) => { setMe((cur) => (cur ? { ...cur, ...u } : cur)); setScanEnabled(u.hasGeminiKey || !!me?.sharedAiKey); }}
            onSaved={(s) => { setSettings(s); flash("บันทึกการตั้งค่าแล้ว 💖"); }}
            onLogout={logout}
          />
        )}

        {error && items && items.length > 0 && !needsSetup && (
          <div className="offline-note">⚠️ ซิงค์ไม่สำเร็จ แสดงข้อมูลล่าสุดที่มี · <button className="link-btn" onClick={load}>ลองใหม่</button></div>
        )}
      </main>

      {tab === "list" && (
        <div className="fab-bar">
          <input
            ref={slipInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files || [])];
              e.target.value = "";
              if (files.length) setSheet({ kind: "add", queue: files, index: 0 });
            }}
          />
          <button className="fab slip" onClick={() => slipInput.current?.click()}><Paperclip size={18} /> สลิป</button>
          <button className="fab add" onClick={() => setSheet({ kind: "add", queue: [], index: 0 })}><Plus size={18} /> จดรายการ</button>
        </div>
      )}

      <nav className="tabbar glass-strong" aria-label="เมนูหลัก">
        {([["list", House, "รายการ"], ["stats", ChartPie, "สรุป"], ["settings", Cog, "ตั้งค่า"]] as const).map(([k, Icon, label]) => (
          <button key={k} className={tab === k ? "on" : ""} aria-current={tab === k ? "page" : undefined} onClick={() => { setTab(k); scrollTo({ top: 0, behavior: "smooth" }); }}>
            <span className="tab-ic"><Icon size={22} /></span>
            {label}
          </button>
        ))}
      </nav>

      {sheet?.kind === "add" && (
        <TxForm
          key={`add-${sheet.index}`}
          settings={settings}
          scanEnabled={scanEnabled}
          file={sheet.queue[sheet.index] || null}
          defaultDate={addDefaultDate}
          queue={{ index: sheet.index, total: sheet.queue.length }}
          findByRef={(r) => refIndex.get(r)}
          onClose={() => setSheet(null)}
          onSkip={nextInQueue}
          onSaved={(tx) => {
            setItems((cur) => [tx, ...(cur || [])].sort(sortTx));
            if (sheet.queue.length <= 1 && !tx.date.startsWith(month)) setMonth(tx.date.slice(0, 7));
            setParty(Date.now());
            flash(sheet.index + 1 < sheet.queue.length ? `บันทึกแล้ว 💖 (${sheet.index + 1}/${sheet.queue.length})` : "บันทึกแล้ว 💖");
            nextInQueue();
          }}
        />
      )}
      {sheet?.kind === "edit" && (
        <TxForm
          key={`edit-${sheet.tx.id}`}
          settings={settings}
          scanEnabled={scanEnabled}
          editing={sheet.tx}
          findByRef={(r) => refIndex.get(r)}
          onClose={() => setSheet(null)}
          onSaved={(tx) => {
            setItems((cur) => (cur || []).map((t) => (t.id === tx.id ? tx : t)).sort(sortTx));
            setSheet({ kind: "detail", tx });
            setParty(Date.now());
            flash("แก้ไขแล้ว ✨");
          }}
        />
      )}
      {sheet?.kind === "detail" && (
        <DetailSheet
          tx={sheet.tx}
          onClose={() => setSheet(null)}
          onEdit={(tx) => setSheet({ kind: "edit", tx })}
          onDeleted={(id) => {
            setItems((cur) => (cur || []).filter((t) => t.id !== id));
            setSheet(null);
            flash("ลบแล้วค่ะ 🗑️");
          }}
        />
      )}
      <Celebrate fire={party} />
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
