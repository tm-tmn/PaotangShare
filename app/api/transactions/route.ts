import { NextResponse } from "next/server";
import { addTx } from "@/lib/store";
import { fail, parseTxForm } from "@/lib/txform";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { fields, slip } = await parseTxForm(req);
    const item = await addTx(
      { id: crypto.randomUUID(), createdAt: new Date().toISOString(), slipFileId: "", ...fields },
      slip,
    );
    return NextResponse.json({ item });
  } catch (e) {
    return fail(e);
  }
}
