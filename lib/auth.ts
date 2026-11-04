// HMAC-signed session cookie — works in both Node and the proxy runtime (Web Crypto only).
export const SESSION_COOKIE = "pt_session";
import { IDLE_MS } from "./idle";
export const SESSION_DAYS = 90;

const enc = new TextEncoder();

async function hmac(data: string): Promise<string> {
  // AUTH_SECRET is optional for easy installs: fall back to a key derived from APPS_SCRIPT_SECRET
  const secret = process.env.AUTH_SECRET || (process.env.APPS_SCRIPT_SECRET ? `pt-auth:${process.env.APPS_SCRIPT_SECRET}` : "");
  if (!secret) throw new Error("AUTH_SECRET / APPS_SCRIPT_SECRET is not set");
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  let bin = "";
  for (const b of new Uint8Array(sig)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// token = v2.<issuedAt>.<lastActive>.<hmac>. The session dies after SESSION_DAYS, or IDLE_MS without a request.
// Every request through the proxy slides lastActive forward (touchSession).
export async function createSession(now = Date.now()): Promise<string> {
  const payload = `v2.${now}.${now}`;
  return `${payload}.${await hmac(payload)}`;
}

async function parseSession(token: string | undefined): Promise<{ issued: number; last: number } | null> {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const [v, a, b] = payload.split(".");
  const issued = Number(a);
  const last = Number(b);
  if (v !== "v2" || !issued || !last) return null;
  const now = Date.now();
  if (issued + SESSION_DAYS * 86400_000 < now || last + IDLE_MS < now || last > now + 60_000) return null;
  const expected = await hmac(payload);
  if (expected.length !== sig.length) return null;
  let diff = 0;
  for (let k = 0; k < sig.length; k++) diff |= sig.charCodeAt(k) ^ expected.charCodeAt(k);
  return diff === 0 ? { issued, last } : null;
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  return !!(await parseSession(token));
}

/** A fresh token with lastActive = now, or null when the session is invalid or was refreshed moments ago. */
export async function touchSession(token: string | undefined): Promise<string | null> {
  const s = await parseSession(token);
  const now = Date.now();
  if (!s || now - s.last < 20_000) return null;
  const payload = `v2.${s.issued}.${now}`;
  return `${payload}.${await hmac(payload)}`;
}

export const sessionCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 86400,
});
