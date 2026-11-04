import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { listUsers } from "@/lib/store";
import { fail } from "@/lib/txform";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const me = await requireAdmin(req);
    return NextResponse.json({ users: await listUsers(), me: me.id });
  } catch (e) {
    return fail(e);
  }
}
