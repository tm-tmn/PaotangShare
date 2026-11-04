import { NextResponse } from "next/server";
import { saveSettings, testEmail } from "@/lib/store";
import { fail } from "@/lib/txform";
import type { Recurring, Settings } from "@/lib/types";

const strList = (v: unknown, max = 40) =>
  Array.isArray(v)
    ? [...new Set(v.map((x) => String(x).trim().slice(0, 40)).filter(Boolean))].slice(0, max)
    : [];

function sanitize(body: Partial<Settings>): Settings {
  const budgets: Record<string, number> = {};
  for (const [k, v] of Object.entries(body.budgets || {})) {
    const n = Number(v);
    if (k && n > 0) budgets[String(k).slice(0, 40)] = Math.round(n);
  }
  const recurring: Recurring[] = (Array.isArray(body.recurring) ? body.recurring : [])
    .slice(0, 30)
    .map((r) => ({
      id: String(r.id || crypto.randomUUID()).slice(0, 40),
      day: Math.min(28, Math.max(1, Math.round(Number(r.day) || 1))),
      type: (r.type === "income" ? "income" : "expense") as Recurring["type"],
      amount: Math.round(Number(r.amount) * 100) / 100,
      category: String(r.category || "").slice(0, 40),
      note: String(r.note || "").slice(0, 80),
      account: String(r.account || "").slice(0, 40),
    }))
    .filter((r) => r.amount > 0);
  return {
    expenseCategories: strList(body.expenseCategories),
    incomeCategories: strList(body.incomeCategories),
    accounts: strList(body.accounts, 15),
    budgets,
    recurring,
    weeklyEmail: !!body.weeklyEmail,
    monthlyLimit: Math.max(0, Math.round(Number(body.monthlyLimit) || 0)),
  };
}

// public address of this app, so the Apps Script can fetch the weekly PDF from it
function appUrl(req: Request) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  if (!host || /[^\w.:-]/.test(host)) return undefined;
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function PUT(req: Request) {
  try {
    return NextResponse.json({ settings: await saveSettings(sanitize(await req.json()), appUrl(req)) });
  } catch (e) {
    return fail(e);
  }
}

// send a test weekly summary now
export async function POST(req: Request) {
  try {
    return NextResponse.json(await testEmail(appUrl(req)));
  } catch (e) {
    return fail(e);
  }
}
