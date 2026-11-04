// Route-handler helpers: who is calling, and are they allowed.
import { sessionUid } from "./auth";
import { getUser, StoreError, type UserPrivate } from "./store";

export async function requireUid(req: Request): Promise<string> {
  const uid = await sessionUid(req);
  if (!uid) throw new StoreError("unauthorized", 401);
  return uid;
}

export const isAdminEmail = (email: string) =>
  !!process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase();

export async function requireActiveUser(req: Request): Promise<UserPrivate> {
  const u = await getUser(await requireUid(req));
  if (!u || u.status !== "active") throw new StoreError("บัญชีนี้ยังไม่ได้รับอนุมัติ หรือถูกระงับ — ติดต่อผู้ดูแล", 401);
  return u;
}

export async function requireAdmin(req: Request): Promise<UserPrivate> {
  const u = await requireActiveUser(req);
  if (u.role !== "admin" && !isAdminEmail(u.email)) throw new StoreError("เฉพาะผู้ดูแลระบบ", 403);
  return u;
}
