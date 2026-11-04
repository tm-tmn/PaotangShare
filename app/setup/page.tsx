import { ping } from "@/lib/store";

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
  let status: { ok: true; sheet: string; folder: string; version?: number } | { ok: false; error: string } | null = null;
  if (hasScript) {
    try {
      const r = await ping();
      status = { ok: true, sheet: r.sheet, folder: r.folder, version: r.version };
    } catch (err) {
      status = { ok: false, error: (err as Error).message };
    }
  }

  return (
    <main className="wrap">
      <h2>สถานะการเชื่อมต่อ</h2>
      <ul style={{ listStyle: "none", padding: 0, lineHeight: 2 }}>
        <Item ok={!!e.APP_PIN} label="APP_PIN" />
        <Item ok={(e.APP_PIN || "").length >= 6} label="PIN ยาวอย่างน้อย 6 หลัก (แนะนำ)" />
        <Item ok={!!e.APPS_SCRIPT_URL} label="APPS_SCRIPT_URL" />
        <Item ok={!!e.APPS_SCRIPT_SECRET} label="APPS_SCRIPT_SECRET" />
        <Item ok={!!status?.ok} label="เชื่อม Apps Script สำเร็จ" />
      </ul>
      {(e.APP_PIN || "").length > 0 && (e.APP_PIN || "").length < 6 && (
        <p className="warn">PIN ตอนนี้สั้นกว่า 6 หลัก แนะนำให้เปลี่ยน APP_PIN ใน Vercel เป็น 6–8 หลักเพื่อความปลอดภัย</p>
      )}
      {status?.ok && (status.version ?? 0) >= 3 && (status.version ?? 0) < 4 && (
        <p className="warn">Apps Script เป็นเวอร์ชัน 3 — อีเมลรายสัปดาห์ยังไม่แนบ PDF ให้วาง Code.gs ใหม่ แล้วรัน setup และ Deploy เป็น New version</p>
      )}
      {status?.ok && (status.version ?? 0) < 3 && (
        <p className="warn">Apps Script ยังเป็นเวอร์ชันเก่า — ระบบล็อก PIN ใช้ตัวสำรองชั่วคราวอยู่ ควรวางโค้ด Code.gs ใหม่ Run setup แล้ว Deploy เป็น New version</p>
      )}
      {status?.ok ? (
        <p>
          พร้อมใช้งาน — <a href={status.sheet} target="_blank">เปิดชีต</a> ·{" "}
          <a href={status.folder} target="_blank">โฟลเดอร์สลิป</a> · <a href="/">ไปหน้าหลัก</a>
        </p>
      ) : status ? (
        <p className="err">{status.error}</p>
      ) : (
        <p>ตั้งค่า APPS_SCRIPT_URL และ APPS_SCRIPT_SECRET ใน Vercel แล้ว Redeploy (ดูขั้นตอนใน README)</p>
      )}
    </main>
  );
}
