import { NextResponse } from "next/server";
import { PIN_MSG, validPassword } from "@/lib/authutil";
import { supaForRequest } from "@/lib/supa";

export const dynamic = "force-dynamic";

// sets a new password for the person who just opened the recovery link (that link signed them in)
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (!validPassword(body?.password)) return NextResponse.json({ error: PIN_MSG }, { status: 400 });
    const { sb, apply } = supaForRequest(req);
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return NextResponse.json({ error: "ลิงก์หมดอายุหรือใช้ไปแล้ว — กด “ลืมรหัสผ่าน” เพื่อขอลิงก์ใหม่" }, { status: 401 });
    const { error } = await sb.auth.updateUser({ password: body.password });
    if (error) {
      return NextResponse.json({ error: /same|different/i.test(error.message) ? "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม" : "ตั้งรหัสผ่านไม่สำเร็จ: " + error.message }, { status: 400 });
    }
    return apply(NextResponse.json({ ok: true }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
