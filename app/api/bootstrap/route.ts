import { NextResponse } from "next/server";
import { bootstrap } from "@/lib/store";
import { fail } from "@/lib/txform";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const { items, settings } = await bootstrap();
    items.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
    return NextResponse.json({ items, settings, scanEnabled: !!process.env.GEMINI_API_KEY });
  } catch (e) {
    return fail(e);
  }
}
