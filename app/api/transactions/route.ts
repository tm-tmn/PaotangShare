import { NextResponse } from "next/server";
import { requireUid } from "@/lib/session";
import { addTx } from "@/lib/store";
import { fail, parseTxForm } from "@/lib/txform";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const uid = await requireUid(req);
    const { fields, slip, id } = await parseTxForm(req);
    const item = await addTx(
      uid,
      { id: id || crypto.randomUUID(), createdAt: new Date().toISOString(), slipFileId: "", ...fields },
      slip,
    );
    return NextResponse.json({ item });
  } catch (e) {
    return fail(e);
  }
}
