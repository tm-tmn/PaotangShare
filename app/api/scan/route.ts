import { NextResponse } from "next/server";
import type { ScanResult } from "@/lib/types";

export const maxDuration = 60;

const SCHEMA = {
  type: "OBJECT",
  properties: {
    isSlip: { type: "BOOLEAN", description: "true if the image is a Thai bank transfer / payment slip or e-receipt" },
    amount: { type: "NUMBER", description: "transfer amount in THB, without fee" },
    date: { type: "STRING", description: "transaction date as YYYY-MM-DD in the Gregorian calendar (convert Buddhist year: subtract 543)" },
    time: { type: "STRING", description: "HH:MM if visible" },
    fromName: { type: "STRING" },
    fromBank: { type: "STRING", description: "sender bank in Thai, e.g. กสิกรไทย, ไทยพาณิชย์, กรุงเทพ, กรุงไทย, กรุงศรี, ทีทีบี, ออมสิน" },
    toName: { type: "STRING", description: "receiver / shop name" },
    toBank: { type: "STRING" },
    transRef: { type: "STRING", description: "transaction reference number" },
    memo: { type: "STRING", description: "memo / note written on the slip, if any" },
    suggestedCategory: { type: "STRING", description: "best matching category from the given list" },
  },
  required: ["isSlip"],
};

function fixDate(d?: string) {
  const m = d?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  let y = Number(m[1]);
  if (y > 2400) y -= 543; // Buddhist year slipped through
  return `${y}-${m[2]}-${m[3]}`;
}

export async function POST(req: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY" }, { status: 501 });
  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return NextResponse.json({ error: "no image" }, { status: 400 });
    const categories = String(form.get("categories") || "");
    // try the chosen model first, then other stable Flash models: when one is overloaded another usually isn't
    const models = [...new Set([process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.1-flash-lite"])];
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");

    const urlFor = (m: string) => `${process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(m)}:generateContent`;
    const init: RequestInit = {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { inline_data: { mime_type: file.type || "image/jpeg", data } },
                {
                  text:
                    "Read this Thai bank transfer slip and extract the fields. " +
                    "Thai months: ม.ค.=01 ก.พ.=02 มี.ค.=03 เม.ย.=04 พ.ค.=05 มิ.ย.=06 ก.ค.=07 ส.ค.=08 ก.ย.=09 ต.ค.=10 พ.ย.=11 ธ.ค.=12. " +
                    "A 2-digit year like 69 means Buddhist 2569 = 2026. Leave fields empty if unreadable; never guess the amount. " +
                    `Categories to choose from: ${categories}`,
                },
              ],
            },
          ],
          generationConfig: { responseMimeType: "application/json", responseSchema: SCHEMA, temperature: 0 },
        }),
    };
    // busy (503/429), server hiccup (500) or unknown/blocked model (404/403) -> move on to the next model
    const retryable = (c: number) => [429, 500, 503, 404, 403].includes(c);
    let res: Response | undefined;
    for (let pass = 0; pass < 2; pass++) {
      for (const m of models) {
        try {
          res = await fetch(urlFor(m), { ...init, signal: AbortSignal.timeout(15000) });
        } catch {
          res = undefined;
          continue;
        }
        if (res.ok || !retryable(res.status)) break;
      }
      if (res && (res.ok || !retryable(res.status))) break;
      if (pass === 0) await new Promise((r) => setTimeout(r, 1500));
    }
    const body = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) {
      const busy = !res || res.status === 503 || res.status === 429;
      return NextResponse.json(
        { error: busy ? "Gemini กำลังมีคนใช้งานเยอะ ลองกดแนบสลิปอีกครั้งในอีกสักครู่ (กรอกยอดเองหรือใช้ยอดจาก QR ได้เลย)" : `Gemini: ${body?.error?.message || res?.status}` },
        { status: 502 },
      );
    }
    const text: string = body?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "{}";
    const r = JSON.parse(text) as ScanResult;
    const out: ScanResult = {
      ...r,
      amount: r.amount && r.amount > 0 ? Math.round(r.amount * 100) / 100 : undefined,
      date: fixDate(r.date),
    };
    return NextResponse.json({ result: out });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
