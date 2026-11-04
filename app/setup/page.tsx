import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { parseSession, SESSION_COOKIE } from "@/lib/auth";
import { isAdminEmail } from "@/lib/session";
import { getUser, ping } from "@/lib/store";

export const dynamic = "force-dynamic";

function Item({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li>
      {ok ? "✅" : "⬜️"} <code>{label}</code>
    </li>
  );
}

export default async function Setup() {
  const e = process.env;
  const hasScript = !!(e.APPS_SCRIPT_URL && e.APPS_SCRIPT_SECRET);
  let status:
    | { ok: true; sheet: string; folder: string; version?: number; users?: number; mailQuota?: number }
    | { ok: false; error: string }
    | null = null;
  if (hasScript) {
    try {
      const r = await ping();
      status = { ok: true, sheet: r.sheet, folder: r.folder, version: r.version, users: r.users, mailQuota: r.mailQuota };
    } catch (err) {
      status = { ok: false, error: (err as Error).message };
    }
  }

  // once the script works, this page (links to everyone's data) is for admins only
  if (status?.ok && (status.users ?? 0) > 0) {
    const s = await parseSession((await cookies()).get(SESSION_COOKIE)?.value);
    const me = s ? await getUser(s.uid).catch(() => null) : null;
    if (!me || me.status !== "active" || (me.role !== "admin" && !isAdminEmail(me.email))) redirect("/");
  }

  const version = status?.ok ? status.version ?? 0 : 0;
  return (
    <main className="wrap">
      <h2>สถานะการเชื่อมต่อ</h2>
      <ul style={{ listStyle: "none", padding: 0, lineHeight: 2 }}>
        <Item ok={!!e.APPS_SCRIPT_URL} label="APPS_SCRIPT_URL" />
        <Item ok={!!e.APPS_SCRIPT_SECRET} label="APPS_SCRIPT_SECRET" />
        <Item ok={!!e.ADMIN_EMAIL} label="ADMIN_EMAIL (อีเมลผู้ดูแล)" />
        <Item ok={!!status?.ok} label="เชื่อม Apps Script สำเร็จ" />
        <Item ok={version >= 5} label="Apps Script เวอร์ชันหลายผู้ใช้ (v5)" />
      </ul>
      {!e.ADMIN_EMAIL && (
        <p className="warn">ยังไม่ได้ตั้ง ADMIN_EMAIL ใน Vercel — ต้องมีเพื่อให้บัญชีแรกเป็นผู้ดูแลและอนุมัติคนอื่นได้</p>
      )}
      {status?.ok && version < 5 && (
        <p className="warn">Apps Script ยังเป็นเวอร์ชันเก่า (ผู้ใช้คนเดียว) — วางโค้ด Code.gs ใหม่ Run setup แล้ว Deploy เป็น New version</p>
      )}
      {status?.ok ? (
        <>
          <p>
            พร้อมใช้งาน — <a href={status.sheet} target="_blank">เปิดชีต</a> ·{" "}
            <a href={status.folder} target="_blank">โฟลเดอร์สลิป</a> · <a href="/">ไปหน้าหลัก</a>
          </p>
          <p className="hint">
            ผู้ใช้ทั้งหมด {status.users ?? 0} บัญชี · โควตาอีเมลวันนี้เหลือ {status.mailQuota ?? "-"} ฉบับ
            {(status.users ?? 0) === 0 && " — สมัครด้วยอีเมลผู้ดูแลที่หน้า /signup เพื่อเริ่มใช้งาน"}
          </p>
        </>
      ) : status ? (
        <p className="err">{status.error}</p>
      ) : (
        <p>ตั้งค่า APPS_SCRIPT_URL และ APPS_SCRIPT_SECRET ใน Vercel แล้ว Redeploy (ดูขั้นตอนใน README)</p>
      )}
    </main>
  );
}
