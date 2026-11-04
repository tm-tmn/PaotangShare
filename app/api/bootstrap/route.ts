import { NextResponse } from "next/server";
import { isAdminEmail, requireUid } from "@/lib/session";
import { bootstrap } from "@/lib/store";
import { fail } from "@/lib/txform";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const uid = await requireUid(req);
    const { items, settings, user } = await bootstrap(uid);
    items.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    return NextResponse.json({
      items,
      settings,
      user,
      isAdmin: user.role === "admin" || isAdminEmail(user.email),
      scanEnabled: user.hasGeminiKey || !!process.env.GEMINI_API_KEY,
      sharedAiKey: !user.hasGeminiKey && !!process.env.GEMINI_API_KEY,
    });
  } catch (e) {
    return fail(e);
  }
}
