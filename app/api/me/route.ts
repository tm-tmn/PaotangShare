import { NextResponse } from "next/server";
import { openPin, samePin, sealPin, validPin } from "@/lib/pinbox";
import { requireActiveUser } from "@/lib/session";
import { StoreError, updateUser } from "@/lib/store";
import { fail } from "@/lib/txform";

export const dynamic = "force-dynamic";

// update own profile: name, PIN (needs the current PIN) and personal Gemini key ("" removes it)
export async function PATCH(req: Request) {
  try {
    const me = await requireActiveUser(req);
    const body = await req.json().catch(() => ({}));
    const patch: Parameters<typeof updateUser>[1] = {};
    if (typeof body.name === "string") {
      const name = body.name.trim().slice(0, 60);
      if (!name) throw new StoreError("กรุณาใส่ชื่อ", 400);
      patch.name = name;
    }
    if (body.newPin !== undefined) {
      const cur = openPin(me.pinEnc);
      if (!cur || typeof body.currentPin !== "string" || !samePin(body.currentPin, cur)) throw new StoreError("PIN ปัจจุบันไม่ถูกต้อง", 400);
      if (!validPin(body.newPin)) throw new StoreError("PIN ใหม่ต้องเป็นตัวเลข 6–8 หลัก", 400);
      patch.pinEnc = sealPin(body.newPin);
    }
    if (typeof body.geminiKey === "string") {
      const k = body.geminiKey.trim();
      if (k && !/^[\w-]{20,100}$/.test(k)) throw new StoreError("รูปแบบคีย์ไม่ถูกต้อง (คีย์ของ Google ขึ้นต้นด้วย AIza…)", 400);
      patch.geminiKey = k;
    }
    const user = await updateUser(me.id, patch);
    return NextResponse.json({ user });
  } catch (e) {
    return fail(e);
  }
}
