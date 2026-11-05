// The PDF password each user chooses is stored in the Sheet encrypted (AES-256-GCM) with a key only the app server holds.
// Encryption (not a one-way hash) is needed because the weekly e-mail job asks the server to build the user's PDF,
// protected with that password, while the user is not around. (Login passwords live in Supabase, never here.)
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

/** PDF passwords: printable ASCII (PDF encryption is only reliable with that), 6–32 characters */
export const validPdfPass = (p: unknown): p is string => typeof p === "string" && /^[\x21-\x7e]{6,32}$/.test(p);
