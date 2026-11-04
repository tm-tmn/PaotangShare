import { NextResponse } from "next/server";
import { StoreError } from "./store";
import type { Tx } from "./types";

export const fail = (e: unknown) =>
  NextResponse.json({ error: (e as Error).message }, { status: e instanceof StoreError ? e.status : 500 });

/** Parse the add/edit form. Throws StoreError(400) on invalid input. */
export async function parseTxForm(req: Request) {
  const form = await req.formData();
  const type = form.get("type") === "income" ? "income" : "expense";
  const amount = Math.round(Number(String(form.get("amount") || "").replace(/,/g, "")) * 100) / 100;
  const date = String(form.get("date") || "");
  if (!(amount > 0)) throw new StoreError("กรุณาใส่จำนวนเงิน", 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new StoreError("วันที่ไม่ถูกต้อง", 400);

  const fields: Omit<Tx, "id" | "createdAt" | "slipFileId"> = {
    date,
    type,
    amount,
    category: String(form.get("category") || "").slice(0, 50),
    note: String(form.get("note") || "").slice(0, 300),
    bank: String(form.get("bank") || "").slice(0, 50),
    transRef: String(form.get("transRef") || "").trim().slice(0, 64),
    account: String(form.get("account") || "").slice(0, 50),
  };

  const file = form.get("slip");
  let slip: { name: string; mime: string; bytes: ArrayBuffer } | undefined;
  if (file instanceof File && file.size > 0) {
    const ext = file.type === "image/png" ? "png" : "jpg";
    const tag = fields.transRef || Math.random().toString(36).slice(2, 10);
    slip = {
      name: `${date}_${type === "income" ? "รับ" : "จ่าย"}_${amount}_${tag}.${ext}`,
      mime: file.type || "image/jpeg",
      bytes: await file.arrayBuffer(),
    };
  }
  return { fields, slip };
}
