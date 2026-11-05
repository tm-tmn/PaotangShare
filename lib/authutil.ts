// the login "password" is a 6-digit PIN (typed on the keypad); Supabase's minimum length is 6
export const PIN_LEN = 6;
export const PIN_MSG = "รหัสผ่านต้องเป็นตัวเลข 6 หลัก";
export const validPassword = (p: unknown): p is string => typeof p === "string" && /^\d{6}$/.test(p);

/** where e-mail links should point: the address the visitor used (works for custom domains and previews) */
export function appOrigin(req: Request): string {
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host;
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** only same-site relative paths are allowed as a post-login destination */
export const safeNext = (n: string | null) => (n && /^\/[A-Za-z0-9/_-]*$/.test(n) && !n.startsWith("//") ? n : "/");
