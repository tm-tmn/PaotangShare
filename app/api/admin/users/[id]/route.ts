import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { deleteUser, getUser, StoreError, updateUser } from "@/lib/store";
import { deleteAuthUser } from "@/lib/supa";
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

// suspend / reactivate, or change the admin role
export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { me, user } = await target(req, ctx);
    const body = await req.json().catch(() => ({}));
    const patch: Parameters<typeof updateUser>[1] = {};
    const self = user.id === me.id;
    if (body.status !== undefined) {
      if (!["active", "suspended"].includes(body.status)) throw new StoreError("สถานะไม่ถูกต้อง", 400);
      if (self && body.status !== "active") throw new StoreError("ระงับบัญชีตัวเองไม่ได้", 400);
      patch.status = body.status;
    }
    if (body.role !== undefined) {
      if (!["admin", "user"].includes(body.role)) throw new StoreError("สิทธิ์ไม่ถูกต้อง", 400);
      if (self && body.role !== "admin") throw new StoreError("ถอดสิทธิ์ผู้ดูแลของบัญชีนี้ไม่ได้", 400);
      patch.role = body.role;
    }
    return NextResponse.json({ user: await updateUser(user.id, patch) });
  } catch (e) {
    return fail(e);
  }
}

// deletes the account's data in the Sheet/Drive (entries + slip folder); the Supabase login is removed too when SUPABASE_SERVICE_ROLE_KEY is set
export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const { me, user } = await target(req, ctx);
    if (user.id === me.id) throw new StoreError("ลบบัญชีนี้ไม่ได้", 400);
    const r = await deleteUser(user.id);
    const loginRemoved = await deleteAuthUser(user.id).catch(() => false);
    return NextResponse.json({ ...r, loginRemoved });
  } catch (e) {
    return fail(e);
  }
}
