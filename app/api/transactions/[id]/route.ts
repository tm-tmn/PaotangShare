import { NextResponse } from "next/server";
import { deleteTx, updateTx } from "@/lib/store";
import { fail, parseTxForm } from "@/lib/txform";

export const maxDuration = 30;

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { fields, slip } = await parseTxForm(req);
    return NextResponse.json({ item: await updateTx(id, fields, slip) });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await deleteTx(id); // slip goes to Drive trash (recoverable for 30 days)
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
