import { NextResponse } from "next/server";
import { sealPin, validPdfPass } from "@/lib/pinbox";
import { validPassword } from "@/lib/authutil";
import { requireActiveUser } from "@/lib/session";
import { StoreError, updateUser } from "@/lib/store";
import { supaEnv, supaForRequest } from "@/lib/supa";
import { fail } from "@/lib/txform";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// update own profile: name, login password (needs the current one), PDF password and personal Gemini key ("" removes either)
export async function PATCH(req: Request) {
  try {
    const me = await requireActiveUser(req);
    const body = await req.json().catch(() => ({}));
    const patch: Parameters<typeof updateUser>[1] = {};
    let apply = <T extends NextResponse>(r: T) => r;
    if (typeof body.name === "string") {
      const name = body.name.trim().slice(0, 60);
      if (!name) throw new StoreError("กรุณาใส่ชื่อ", 400);
      patch.name = name;
    }
    if (body.newPassword !== undefined) {
      if (!validPassword(body.newPassword)) throw new StoreError("รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร", 400);
      // re-check the current password with a throw-away client so this session's cookies are not touched
      const { url, key } = supaEnv();
      const probe = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { error: bad } = await probe.auth.signInWithPassword({ email: me.email, password: String(body.currentPassword || "") });
      if (bad) throw new StoreError("รหัสผ่านปัจจุบันไม่ถูกต้อง", 400);
      const s = supaForRequest(req);
      const { error } = await s.sb.auth.updateUser({ password: body.newPassword });
      if (error) throw new StoreError(/same|different/i.test(error.message) ? "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม" : "เปลี่ยนรหัสผ่านไม่สำเร็จ: " + error.message, 400);
      apply = s.apply;
    }
    if (typeof body.pdfPass === "string") {
      const p = body.pdfPass;
      if (p && !validPdfPass(p)) throw new StoreError("รหัสเปิด PDF ต้องเป็นตัวอักษรอังกฤษ/ตัวเลข/สัญลักษณ์ 6–32 ตัว", 400);
      patch.pinEnc = p ? sealPin(p) : "";
    }
    if (typeof body.geminiKey === "string") {
      const k = body.geminiKey.trim();
      if (k && !/^[\w-]{20,100}$/.test(k)) throw new StoreError("รูปแบบคีย์ไม่ถูกต้อง (คีย์ของ Google ขึ้นต้นด้วย AIza…)", 400);
      patch.geminiKey = k;
    }
    const user = Object.keys(patch).length ? await updateUser(me.id, patch) : me;
    return apply(NextResponse.json({ user }));
  } catch (e) {
    return fail(e);
  }
}
