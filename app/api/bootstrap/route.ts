import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/session";
import { bootstrap } from "@/lib/store";
import { fail } from "@/lib/txform";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  try {
    const me = await requireActiveUser(req); // creates the Sheet row on first sign-in
    const { items, settings, user } = await bootstrap(me.id);
    items.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    return NextResponse.json({
      items,
      settings,
      user,
      isAdmin: user.role === "admin",
      scanEnabled: user.hasGeminiKey || !!process.env.GEMINI_API_KEY,
      sharedAiKey: !user.hasGeminiKey && !!process.env.GEMINI_API_KEY,
    });
  } catch (e) {
    return fail(e);
  }
}
