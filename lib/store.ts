// Server-only client for the Apps Script web app that owns the Google Sheet + slip folder.
import { DEFAULT_SETTINGS, type Settings, type Tx } from "./types";

export class StoreError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

type Slip = { name: string; mime: string; bytes: ArrayBuffer } | undefined;

async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const url = process.env.APPS_SCRIPT_URL;
  const secret = process.env.APPS_SCRIPT_SECRET;
  if (!url || !secret) throw new StoreError("ยังไม่ได้ตั้งค่า APPS_SCRIPT_URL / APPS_SCRIPT_SECRET");

  // Apps Script answers POST with a 302 to a googleusercontent URL; fetch follows it as GET.
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ secret, action, ...payload }),
    redirect: "follow",
    cache: "no-store",
  });
  const text = await res.text();
  let data: { error?: string; duplicate?: boolean } & Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new StoreError(
      res.ok
        ? "Apps Script ตอบกลับไม่ใช่ JSON — ตรวจว่า Deploy เป็นเว็บแอป และตั้ง 'ผู้มีสิทธิ์เข้าถึง: ทุกคน'"
        : `Apps Script error ${res.status}`,
    );
  }
  if (data.error === "user_inactive") throw new StoreError("บัญชียังไม่พร้อมใช้งาน หรือถูกระงับ — ลองรีเฟรชหน้านี้ หรือติดต่อผู้ดูแล", 403);
  if (data.error === "unauthorized") throw new StoreError("APPS_SCRIPT_SECRET ไม่ตรงกับรหัสลับในสคริปต์ — ใน Apps Script เลือกฟังก์ชัน showSecret แล้วกด Run เพื่อดูรหัสที่ถูกต้อง (ถ้ายังไม่เคย Run setup ให้ Run setup ก่อน)", 500);
  if (data.error === "unknown action")
    throw new StoreError("Apps Script ยังเป็นเวอร์ชันเก่า — วางโค้ด apps-script/Code.gs ใหม่แล้ว Deploy เป็น New version");
  if (data.error) throw new StoreError(data.error, data.duplicate ? 409 : 400);
  return data as T;
}

const encSlip = (slip: Slip) =>
  slip ? { name: slip.name, mime: slip.mime, data: Buffer.from(slip.bytes).toString("base64") } : null;

const normTx = (t: Tx): Tx => ({ ...t, account: t.account || "" });
const normSettings = (s: Partial<Settings> | undefined): Settings => ({ ...DEFAULT_SETTINGS, ...(s || {}) });

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  status: "active" | "suspended";
  role: "admin" | "user";
  createdAt: string;
  lastLogin: string;
  hasGeminiKey: boolean;
  hasPdfPass: boolean;
  txCount?: number;
}
export interface UserPrivate extends UserPublic {
  pinEnc: string;
  geminiKey: string;
}

export const ping = () =>
  call<{ ok: boolean; version?: number; multiUser?: boolean; sheet: string; folder: string; users?: number; mailQuota?: number }>("ping");

// ----- accounts (login itself is Supabase; this is the per-user row in the Sheet) -----
// Apps Script round-trips are slow (1–3 s), so a signed-in user's row is remembered briefly per server instance.
// Writes made through this module drop the entry; a suspension made on another instance shows up within the TTL.
const USER_TTL_MS = 45_000;
const userCache = new Map<string, { u: UserPrivate | null; exp: number }>();
const forget = (id: string) => void userCache.delete(id);

export const findUser = async (email: string) => (await call<{ user: UserPrivate | null }>("userFind", { email })).user;
export const getUser = async (id: string) => {
  const hit = userCache.get(id);
  if (hit && hit.exp > Date.now() && hit.u) return hit.u;
  const u = (await call<{ user: UserPrivate | null }>("userGet", { id })).user;
  if (u) userCache.set(id, { u, exp: Date.now() + USER_TTL_MS });
  return u;
};
export const createUser = async (user: { id: string; email: string; name: string; status: "active" | "suspended"; role: "admin" | "user" }) =>
  (await call<{ user: UserPublic }>("userCreate", { user }).finally(() => forget(user.id))).user;
// pinEnc holds the encrypted PDF password the user chose
export const updateUser = async (id: string, patch: Partial<Pick<UserPrivate, "name" | "status" | "role" | "pinEnc" | "geminiKey" | "lastLogin">>) =>
  (await call<{ user: UserPublic }>("userUpdate", { id, patch }).finally(() => forget(id))).user;
export const listUsers = async () => (await call<{ users: UserPublic[] }>("userList")).users;
export const deleteUser = (id: string) => call<{ ok: boolean; removed: number }>("userDelete", { id }).finally(() => forget(id));

// ----- one user's data -----
export async function bootstrap(uid: string): Promise<{ items: Tx[]; settings: Settings; user: UserPublic }> {
  const r = await call<{ items: Tx[]; settings: Settings; user: UserPublic }>("bootstrap", { uid });
  return { items: r.items.map(normTx), settings: normSettings(r.settings), user: r.user };
}

export async function addTx(uid: string, tx: Tx, slip?: Slip): Promise<Tx> {
  return (await call<{ item: Tx }>("add", { uid, tx, slip: encSlip(slip) })).item;
}

export async function updateTx(uid: string, id: string, patch: Partial<Tx>, slip?: Slip): Promise<Tx> {
  return (await call<{ item: Tx }>("update", { uid, id, patch, slip: encSlip(slip) })).item;
}

export async function deleteTx(uid: string, id: string) {
  await call("delete", { uid, id });
}

export async function getSlip(uid: string, id: string): Promise<{ mime: string; bytes: Buffer }> {
  const res = await call<{ mime: string; data: string }>("slip", { uid, id });
  return { mime: res.mime, bytes: Buffer.from(res.data, "base64") };
}

export async function saveSettings(uid: string, settings: Settings, appUrl?: string): Promise<Settings> {
  return normSettings((await call<{ settings: Settings }>("saveSettings", { uid, settings, appUrl })).settings);
}

export const testEmail = (uid: string, appUrl?: string) =>
  call<{ ok: boolean; to: string; pdf?: boolean }>("testEmail", { uid, appUrl });

