import { NextResponse } from "next/server";
import { requireUid } from "@/lib/session";
import { deleteTx, updateTx } from "@/lib/store";
import { fail, parseTxForm } from "@/lib/txform";

export const maxDuration = 30;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const uid = await requireUid(req);
    const { fields, slip } = await parseTxForm(req);
    return NextResponse.json({ item: await updateTx(uid, id, fields, slip) });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await deleteTx(await requireUid(req), id); // slip goes to Drive trash (recoverable for 30 days)
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
