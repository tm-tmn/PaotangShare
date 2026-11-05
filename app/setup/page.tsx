import { redirect } from "next/navigation";
import { getUser, ping } from "@/lib/store";
import { authSettings, claimsFromCookies } from "@/lib/supa";

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
  const auth = await authSettings();

  // once everything works, this page (links to everyone's data) is for admins only
  if (status?.ok && auth.ok && (status.users ?? 0) > 0) {
    const c = await claimsFromCookies();
    const me = c ? await getUser(c.uid).catch(() => null) : null;
    if (!me || me.status !== "active" || me.role !== "admin") redirect("/");
  }

  const version = status?.ok ? status.version ?? 0 : 0;
  return (
    <main className="wrap">
      <h2>สถานะการเชื่อมต่อ</h2>
      <ul style={{ listStyle: "none", padding: 0, lineHeight: 2 }}>
        <Item ok={!!(e.SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL)} label="SUPABASE_URL" />
        <Item ok={!!(e.SUPABASE_ANON_KEY || e.NEXT_PUBLIC_SUPABASE_ANON_KEY || e.SUPABASE_PUBLISHABLE_KEY)} label="SUPABASE_ANON_KEY" />
        <Item ok={auth.ok} label="เชื่อม Supabase สำเร็จ" />
        <Item ok={!!e.APPS_SCRIPT_URL} label="APPS_SCRIPT_URL" />
        <Item ok={!!e.APPS_SCRIPT_SECRET} label="APPS_SCRIPT_SECRET" />
        <Item ok={!!status?.ok} label="เชื่อม Apps Script สำเร็จ" />
        <Item ok={version >= 6} label="Apps Script เวอร์ชันล่าสุด (v6)" />
      </ul>
      {!auth.ok && <p className="err">{auth.error}</p>}
      {auth.ok && !auth.signupOpen && <p className="warn">Supabase ปิดการสมัครผู้ใช้ใหม่ไว้ (Authentication → Sign In / Providers → “Allow new users to sign up”)</p>}
      {auth.ok && !auth.confirmEmail && (
        <p className="warn">Supabase ไม่ได้บังคับยืนยันอีเมล — ใครก็สมัครด้วยอีเมลของคนอื่นได้ แนะนำเปิด “Confirm email” (Authentication → Sign In / Providers → Email)</p>
      )}
      {status?.ok && version < 6 && (
        <p className="warn">Apps Script ยังเป็นเวอร์ชันเก่า — วางโค้ด Code.gs ใหม่ Run setup แล้ว Deploy เป็น New version</p>
      )}
      {status?.ok ? (
        <>
          <p>
            พร้อมใช้งาน — <a href={status.sheet} target="_blank">เปิดชีต</a> ·{" "}
            <a href={status.folder} target="_blank">โฟลเดอร์สลิป</a> · <a href="/">ไปหน้าหลัก</a>
          </p>
          <p className="hint">
            ผู้ใช้ทั้งหมด {status.users ?? 0} บัญชี · โควตาอีเมลของ Apps Script วันนี้เหลือ {status.mailQuota ?? "-"} ฉบับ
            {(status.users ?? 0) === 0 && " — คนแรกที่สมัครที่หน้า /signup จะเป็นผู้ดูแล"}
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
