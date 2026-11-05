import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireUid } from "@/lib/session";
import { openPin } from "@/lib/pinbox";
import { bootstrap, getUser } from "@/lib/store";
import { buildReport } from "@/lib/report";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const err = (error: string, status: number) => NextResponse.json({ error }, { status });

// PDF summary. Allowed for a logged-in session, or for the Apps Script (weekly email) via x-report-secret.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const secret = req.headers.get("x-report-secret");
    let uid: string | null;
    if (secret) {
      const expected = process.env.APPS_SCRIPT_SECRET || "";
      if (!expected || !sameSecret(secret, expected)) return err("unauthorized", 401);
      uid = url.searchParams.get("uid");
    } else {
      uid = await requireUid(req).catch(() => null);
    }
    if (!uid) return err("unauthorized", 401);

    const user = await getUser(uid);
    if (!user || user.status !== "active") return err("unauthorized", 401);
    // each user's PDF is locked with the PDF password they chose in Settings
    const pass = openPin(user.pinEnc);
    if (!pass) return err("ตั้ง “รหัสเปิด PDF” ในหน้าตั้งค่าก่อน แล้วค่อยสร้างไฟล์ PDF", 400);

    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    if (!ISO.test(from) || !ISO.test(to) || from > to) return err("ช่วงวันที่ไม่ถูกต้อง", 400);
    if (Date.parse(to) - Date.parse(from) > 366 * 86400000) return err("เลือกช่วงได้ไม่เกิน 1 ปี", 400);

    const { items, settings } = await bootstrap(uid);
    const pdf = await buildReport({ items, settings, from, to, password: pass });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="paotang-${from}_${to}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return err((e as Error).message || "สร้าง PDF ไม่สำเร็จ", 500);
  }
}
