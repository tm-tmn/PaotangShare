import { NextResponse } from "next/server";
import { randomPin, sealPin } from "@/lib/pinbox";
import { isAdminEmail, requireAdmin } from "@/lib/session";
import { deleteUser, getUser, StoreError, updateUser } from "@/lib/store";
import { fail } from "@/lib/txform";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

async function target(req: Request, ctx: Ctx) {
  const me = await requireAdmin(req);
  const { id } = await ctx.params;
  const user = await getUser(id);
  if (!user) throw new StoreError("ไม่พบผู้ใช้", 404);
  return { me, user };
}

// approve / suspend / reactivate, change role, or reset the PIN (returns a one-time temporary PIN)
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { me, user } = await target(req, ctx);
    const body = await req.json().catch(() => ({}));
    const patch: Parameters<typeof updateUser>[1] = {};
    const self = user.id === me.id;
    if (body.status !== undefined) {
      if (!["active", "suspended", "pending"].includes(body.status)) throw new StoreError("สถานะไม่ถูกต้อง", 400);
      if (self && body.status !== "active") throw new StoreError("ระงับบัญชีตัวเองไม่ได้", 400);
      if (isAdminEmail(user.email) && body.status !== "active") throw new StoreError("ระงับบัญชีผู้ดูแลหลักไม่ได้", 400);
      patch.status = body.status;
    }
    if (body.role !== undefined) {
      if (!["admin", "user"].includes(body.role)) throw new StoreError("สิทธิ์ไม่ถูกต้อง", 400);
      if ((self || isAdminEmail(user.email)) && body.role !== "admin") throw new StoreError("ถอดสิทธิ์ผู้ดูแลของบัญชีนี้ไม่ได้", 400);
      patch.role = body.role;
    }
    let tempPin: string | undefined;
    if (body.resetPin) {
      tempPin = randomPin();
      patch.pinEnc = sealPin(tempPin);
    }
    const updated = await updateUser(user.id, patch);
    return NextResponse.json({ user: updated, tempPin });
  } catch (e) {
    return fail(e);
  }
}

// deletes the account, all of its entries and its slip folder
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { me, user } = await target(req, ctx);
    if (user.id === me.id || isAdminEmail(user.email)) throw new StoreError("ลบบัญชีนี้ไม่ได้", 400);
    return NextResponse.json(await deleteUser(user.id));
  } catch (e) {
    return fail(e);
  }
}
