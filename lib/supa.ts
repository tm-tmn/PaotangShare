// Supabase Auth only: accounts, e-mail verification, password login & reset. All app data stays in Google Sheet/Drive.
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextResponse } from "next/server";

export const supaEnv = () => ({
  url: (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, ""),
  key: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "",
});

export const supaConfigured = () => {
  const { url, key } = supaEnv();
  return !!(url && key);
};

export type CookieItem = { name: string; value: string; options?: Record<string, unknown> };

export function parseCookieHeader(header: string): { name: string; value: string }[] {
  return header
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf("=");
      const raw = i < 0 ? "" : p.slice(i + 1);
      let value = raw;
      try { value = decodeURIComponent(raw); } catch { /* keep raw */ }
      return { name: i < 0 ? p : p.slice(0, i), value };
    });
}

/** A Supabase client bound to this request's cookies; `apply(res)` copies any refreshed/cleared auth cookies onto the response. */
export function supaForRequest(req: Request) {
  const { url, key } = supaEnv();
  if (!url || !key) throw new SupaConfigError();
  const pending: CookieItem[] = [];
  const sb = createServerClient(url, key, {
    cookies: {
      getAll: () => parseCookieHeader(req.headers.get("cookie") || ""),
      setAll: (list: CookieItem[]) => { pending.push(...list); },
    },
  }) as unknown as SupabaseClient;
  const apply = <T extends NextResponse>(res: T): T => {
    for (const c of pending) res.cookies.set(c.name, c.value, c.options as never);
    return res;
  };
  return { sb, apply };
}

export class SupaConfigError extends Error {
  constructor() {
    super("ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_ANON_KEY ใน Vercel");
  }
}

export interface Claims {
  uid: string;
  email: string;
  name: string;
}

export async function claimsOf(sb: SupabaseClient): Promise<Claims | null> {
  const { data, error } = await sb.auth.getClaims();
  const c = data?.claims as { sub?: string; email?: string; user_metadata?: { name?: string } } | undefined;
  if (error || !c?.sub) return null;
  return { uid: c.sub, email: String(c.email || "").toLowerCase(), name: String(c.user_metadata?.name || "") };
}

/** optional: remove the Supabase login too when the admin deletes an account (needs SUPABASE_SERVICE_ROLE_KEY) */
export async function deleteAuthUser(id: string): Promise<boolean> {
  const { url } = supaEnv();
  const sr = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sr) return false;
  const res = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { apikey: sr, Authorization: `Bearer ${sr}` },
  });
  return res.ok;
}

/** for server components (pages): the signed-in user from next/headers cookies, or null */
export async function claimsFromCookies(): Promise<Claims | null> {
  const { cookies } = await import("next/headers");
  const { url, key } = supaEnv();
  if (!url || !key) return null;
  const jar = await cookies();
  const sb = createServerClient(url, key, { cookies: { getAll: () => jar.getAll(), setAll: () => {} } }) as unknown as SupabaseClient;
  return claimsOf(sb);
}

/** what the Supabase project says about its sign-up settings (public endpoint) */
export async function authSettings(): Promise<{ ok: boolean; confirmEmail?: boolean; signupOpen?: boolean; error?: string }> {
  const { url, key } = supaEnv();
  if (!url || !key) return { ok: false, error: "ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_ANON_KEY" };
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key }, cache: "no-store" });
    if (!res.ok) return { ok: false, error: `Supabase ตอบ ${res.status} — ตรวจ SUPABASE_URL / SUPABASE_ANON_KEY` };
    const d = (await res.json()) as { mailer_autoconfirm?: boolean; disable_signup?: boolean };
    return { ok: true, confirmEmail: !d.mailer_autoconfirm, signupOpen: !d.disable_signup };
  } catch (e) {
    return { ok: false, error: "เชื่อมต่อ Supabase ไม่ได้: " + (e as Error).message };
  }
}
