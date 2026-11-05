// Route-handler helpers: who is calling (Supabase session), and are they allowed.
import { claimsOf, supaForRequest, type Claims } from "./supa";
import { createUser, getUser, listUsers, StoreError, type UserPrivate } from "./store";

export async function requireClaims(req: Request): Promise<Claims> {
  const { sb } = supaForRequest(req);
  const c = await claimsOf(sb);
  if (!c) throw new StoreError("unauthorized", 401);
  return c;
}

export async function requireUid(req: Request): Promise<string> {
  return (await requireClaims(req)).uid;
}

/** the signed-in user's row in the Sheet — created on first use (no approval step), suspended accounts are refused */
export async function requireActiveUser(req: Request): Promise<UserPrivate> {
  const c = await requireClaims(req);
  let u = await getUser(c.uid);
  if (!u) {
    // the very first account on a fresh install becomes the admin; everyone after is a normal user
    const first = (await listUsers()).length === 0;
    const made = await createUser({ id: c.uid, email: c.email, name: c.name || c.email.split("@")[0], status: "active", role: first ? "admin" : "user" });
    u = { ...made, pinEnc: "", geminiKey: "" };
  }
  if (u.status !== "active") throw new StoreError("บัญชีนี้ถูกระงับการใช้งาน — ติดต่อผู้ดูแล", 403);
  return u;
}

export async function requireAdmin(req: Request): Promise<UserPrivate> {
  const u = await requireActiveUser(req);
  if (u.role !== "admin") throw new StoreError("เฉพาะผู้ดูแลระบบ", 403);
  return u;
}
