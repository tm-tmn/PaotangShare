export const validPassword = (p: unknown): p is string => typeof p === "string" && p.length >= 8 && p.length <= 72;

/** where e-mail links should point: the address the visitor used (works for custom domains and previews) */
export function appOrigin(req: Request): string {
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host;
  const proto = req.headers.get("x-forwarded-proto") || u.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** only same-site relative paths are allowed as a post-login destination */
export const safeNext = (n: string | null) => (n && /^\/[A-Za-z0-9/_-]*$/.test(n) && !n.startsWith("//") ? n : "/");
