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

export const ping = () => call<{ ok: boolean; version?: number; sheet: string; folder: string }>("ping");

export async function bootstrap(): Promise<{ items: Tx[]; settings: Settings }> {
  const r = await call<{ items: Tx[]; settings: Settings }>("bootstrap");
  return { items: r.items.map(normTx), settings: normSettings(r.settings) };
}

export async function addTx(tx: Tx, slip?: Slip): Promise<Tx> {
  return (await call<{ item: Tx }>("add", { tx, slip: encSlip(slip) })).item;
}

export async function updateTx(id: string, patch: Partial<Tx>, slip?: Slip): Promise<Tx> {
  return (await call<{ item: Tx }>("update", { id, patch, slip: encSlip(slip) })).item;
}

export async function deleteTx(id: string) {
  await call("delete", { id });
}

export async function getSlip(id: string): Promise<{ mime: string; bytes: Buffer }> {
  const res = await call<{ mime: string; data: string }>("slip", { id });
  return { mime: res.mime, bytes: Buffer.from(res.data, "base64") };
}

export async function saveSettings(settings: Settings, appUrl?: string): Promise<Settings> {
  return normSettings((await call<{ settings: Settings }>("saveSettings", { settings, appUrl })).settings);
}

export const testEmail = (appUrl?: string) =>
  call<{ ok: boolean; to: string; pdf?: boolean }>("testEmail", { appUrl });

export const authOp = (op: "status" | "fail" | "ok") =>
  call<{ locked: boolean; lockUntil: number; remaining: number }>("auth", { op });
