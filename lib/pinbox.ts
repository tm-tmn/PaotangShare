// PINs are stored in the Sheet encrypted (AES-256-GCM) with a key that only the app server holds.
// Encryption (not a one-way hash) is needed because each user's PIN is also the password of their PDF reports,
// which the weekly e-mail job asks the server to build while the user is not around.
import crypto from "node:crypto";

function key() {
  const base = process.env.PIN_KEY || process.env.APPS_SCRIPT_SECRET;
  if (!base) throw new Error("APPS_SCRIPT_SECRET is not set");
  return crypto.createHash("sha256").update(`pt-pin:${base}`).digest();
}

export function sealPin(pin: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(pin, "utf8"), c.final()]);
  return "v1." + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}

export function openPin(box: string): string | null {
  try {
    if (!box?.startsWith("v1.")) return null;
    const raw = Buffer.from(box.slice(3), "base64url");
    const d = crypto.createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** constant-time string compare (no early exit on the first wrong digit) */
export function samePin(a: string, b: string) {
  const len = Math.max(a.length, b.length, 1);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export const validPin = (p: unknown): p is string => typeof p === "string" && /^\d{6,8}$/.test(p);

export function randomPin() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}
