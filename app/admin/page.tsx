"use client";
import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BgDeco } from "@/components/Cute";

interface U {
  id: string;
  email: string;
  name: string;
  status: "pending" | "active" | "suspended";
  role: "admin" | "user";
  createdAt: string;
  lastLogin: string;
  txCount?: number;
}

const STATUS = { pending: "รออนุมัติ", active: "ใช้งานอยู่", suspended: "ระงับ" } as const;
const when = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "–" : d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
};

export default function Admin() {
  const [users, setUsers] = useState<U[] | null>(null);
  const [me, setMe] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [temp, setTemp] = useState<{ email: string; pin: string } | null>(null);
  const [filter, setFilter] = useState<"all" | U["status"]>("all");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users", { cache: "no-store" });
    if (res.status === 401) return location.replace("/login");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(data.error || "โหลดไม่สำเร็จ");
      setUsers([]);
      return;
    }
    setUsers(data.users);
    setMe(data.me);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(u: U, body: Record<string, unknown>, method = "PATCH") {
    setBusy(u.id);
    setErr("");
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "PATCH" ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "ทำรายการไม่สำเร็จ");
      if (data.tempPin) setTemp({ email: u.email, pin: data.tempPin });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, active: 0, suspended: 0 };
    (users || []).forEach((u) => { c.all++; c[u.status]++; });
    return c;
  }, [users]);
  const shown = (users || [])
    .filter((u) => filter === "all" || u.status === filter)
    .sort((a, b) => (a.status === "pending" ? -1 : 0) - (b.status === "pending" ? -1 : 0) || a.email.localeCompare(b.email));

  return (
    <>
      <BgDeco />
      <main className="wrap">
        <a href="/" className="link-btn"><ChevronLeft size={16} /> กลับหน้าหลัก</a>
        <h2>👑 จัดการผู้ใช้</h2>
        <div className="chips">
          {(["all", "pending", "active", "suspended"] as const).map((k) => (
            <button key={k} className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>
              {k === "all" ? "ทั้งหมด" : STATUS[k]} {counts[k]}
            </button>
          ))}
        </div>
        {temp && (
          <section className="panel glass" role="status">
            <h3>🔑 PIN ชั่วคราวของ {temp.email}</h3>
            <div className="temp-pin">{temp.pin}</div>
            <p className="hint">แจ้ง PIN นี้ให้เจ้าของบัญชีทางช่องทางส่วนตัว แล้วให้เขาเปลี่ยน PIN เองในหน้าตั้งค่า — PIN นี้แสดงครั้งเดียว</p>
            <button className="btn ghost" onClick={() => setTemp(null)}>ปิด</button>
          </section>
        )}
        {err && <p className="err" role="alert">{err}</p>}
        <section className="panel glass">
          {users === null && <p className="hint">กำลังโหลด…</p>}
          {users && shown.length === 0 && <p className="hint">ไม่มีผู้ใช้ในกลุ่มนี้</p>}
          {shown.map((u) => {
            const self = u.id === me;
            const b = busy === u.id;
            return (
              <div className="user-row" key={u.id} data-email={u.email}>
                <div className="who">
                  <b>{u.name || "(ไม่มีชื่อ)"} {self && "· คุณ"}</b>
                  <span>
                    {u.role === "admin" && <span className="badge admin">ผู้ดูแล</span>}{" "}
                    <span className={`badge ${u.status}`}>{STATUS[u.status]}</span>
                  </span>
                </div>
                <small>{u.email}</small>
                <small>สมัคร {when(u.createdAt)} · เข้าล่าสุด {u.lastLogin ? when(u.lastLogin) : "–"} · {u.txCount ?? 0} รายการ</small>
                {!self && (
                  <div className="acts">
                    {u.status !== "active" && (
                      <button className="chip on" disabled={b} onClick={() => act(u, { status: "active" })}>
                        {u.status === "pending" ? "✓ อนุมัติ" : "เปิดใช้งานอีกครั้ง"}
                      </button>
                    )}
                    {u.status === "active" && (
                      <button className="chip" disabled={b} onClick={() => confirm(`ระงับการใช้งานของ ${u.email}?`) && act(u, { status: "suspended" })}>ระงับ</button>
                    )}
                    {u.status === "active" && (
                      <button className="chip" disabled={b} onClick={() => act(u, { role: u.role === "admin" ? "user" : "admin" })}>
                        {u.role === "admin" ? "ถอดสิทธิ์ผู้ดูแล" : "ตั้งเป็นผู้ดูแล"}
                      </button>
                    )}
                    <button className="chip" disabled={b} onClick={() => confirm(`รีเซ็ต PIN ของ ${u.email}? ระบบจะสร้าง PIN ชั่วคราวให้`) && act(u, { resetPin: true })}>รีเซ็ต PIN</button>
                    <button
                      className="chip danger-text"
                      disabled={b}
                      onClick={() =>
                        confirm(`ลบบัญชี ${u.email} พร้อมรายการทั้งหมด ${u.txCount ?? 0} รายการ และรูปสลิป?\nลบแล้วกู้คืนรายการไม่ได้ (รูปสลิปอยู่ในถังขยะ Drive 30 วัน)`) &&
                        act(u, {}, "DELETE")
                      }
                    >
                      ลบบัญชี
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
        <p className="hint">ข้อมูลทั้งหมดอยู่ใน Google Sheet และ Drive ของคุณ — <a href="/setup">สถานะการเชื่อมต่อ</a></p>
      </main>
    </>
  );
}
