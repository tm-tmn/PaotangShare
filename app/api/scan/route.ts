import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/session";
import type { ScanResult } from "@/lib/types";

export const maxDuration = 60;
export const preferredRegion = "sin1"; // closest to the users (Thailand)

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
  let key = "";
  try {
    // each user's own Gemini key; an optional shared key set by the admin is the fallback
    const user = await requireActiveUser(req);
    key = user.geminiKey || process.env.GEMINI_API_KEY || "";
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 401 });
  }
  if (!key) return NextResponse.json({ error: "ยังไม่ได้ใส่คีย์ AI — ไปที่ ตั้งค่า → AI อ่านสลิป" }, { status: 501 });
  try {
    const form = await req.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return NextResponse.json({ error: "no image" }, { status: 400 });
    const categories = String(form.get("categories") || "");
    // try the chosen model first, then other stable Flash models: when one is overloaded another usually isn't
    const models = [...new Set([process.env.GEMINI_MODEL || "gemini-3.8-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash", "gemini-3.1-flash-lite"])];
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");

    const urlFor = (m: string) => `${process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com"}/v1beta/models/${encodeURIComponent(m)}:generateContent`;
    const prompt =
      "Read this image — a Thai bank transfer / payment slip, or a shop receipt / invoice — and extract the fields. " +
      "For a shop receipt: amount = the final total actually paid (รวมสุทธิ / ยอดชำระ, after discount and VAT), toName = the shop name, date = the receipt date. " +
      "Thai months: ม.ค.=01 ก.พ.=02 มี.ค.=03 เม.ย.=04 พ.ค.=05 มิ.ย.=06 ก.ค.=07 ส.ค.=08 ก.ย.=09 ต.ค.=10 พ.ย.=11 ธ.ค.=12. " +
      "A 2-digit year like 69 means Buddhist 2569 = 2026. Leave fields empty if unreadable; never guess the amount. " +
      `Categories to choose from: ${categories}`;
    // Reading a slip needs no reasoning: ask for the lowest "thinking" level (much faster). Some models reject the
    // field, so on a 400 that mentions it we retry the same model without it.
    const initFor = (thinking: boolean): RequestInit => ({
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ inline_data: { mime_type: file.type || "image/jpeg", data } }, { text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: 0,
          maxOutputTokens: 1024,
          ...(thinking ? { thinkingConfig: { thinkingLevel: "minimal" } } : {}),
        },
      }),
    });
    // busy (503/429), server hiccup (500) or unknown/blocked model (404/403) -> try another model
    const retryable = (c: number) => [429, 500, 503, 404, 403].includes(c);
    const t0 = Date.now();
    const deadline = t0 + 40_000; // stay under maxDuration
    const HEDGE_MS = Number(process.env.GEMINI_HEDGE_MS || 5000); // still no answer after this long -> ask a second model in parallel
    const ctrls: AbortController[] = [];
    const ask = (m: string, thinking: boolean) => {
      const c = new AbortController();
      ctrls.push(c);
      const t = setTimeout(() => c.abort(), Math.max(3000, Math.min(15000, deadline - Date.now())));
      return fetch(urlFor(m), { ...initFor(thinking), signal: c.signal }).finally(() => clearTimeout(t));
    };
    type Attempt = { res: Response; model: string };
    const tryModel = async (m: string): Promise<Attempt | null> => {
      try {
        let r = await ask(m, true);
        if (r.status === 400 && /thinking/i.test(JSON.stringify(await r.clone().json().catch(() => ({}))))) r = await ask(m, false);
        return { res: r, model: m };
      } catch {
        return null;
      }
    };
    // first model answers -> done. Slow (hedge) or failed -> start the next model without waiting; first good answer wins.
    const won = await new Promise<Attempt | undefined>((resolve) => {
      const order = [...models, ...models].slice(0, Math.max(4, models.length));
      let started = 0, finished = 0, done = false, last: Attempt | undefined, hedge: ReturnType<typeof setTimeout> | undefined;
      const finish = (a?: Attempt) => {
        if (done) return;
        done = true;
        clearTimeout(hedge);
        clearTimeout(cap);
        resolve(a ?? last);
      };
      const cap = setTimeout(() => finish(), Math.max(1000, deadline - Date.now()));
      const launch = () => {
        if (done || started >= order.length) return;
        const m = order[started++];
        clearTimeout(hedge);
        if (started < order.length) hedge = setTimeout(launch, HEDGE_MS);
        tryModel(m).then((a) => {
          finished++;
          if (done) return;
          if (a && (a.res.ok || !retryable(a.res.status))) return finish(a);
          if (a) last = a;
          if (started < order.length) launch();
          else if (finished >= started) finish();
        });
      };
      launch();
    });
    const res = won?.res;
    const usedModel = won?.model || "";
    const body = res ? await res.json().catch(() => ({})) : {};
    ctrls.forEach((c) => c.abort()); // drop the losers (only after the winner's body has been read)
    if (!res || !res.ok) {
      console.log(`scan failed status=${res?.status ?? "none"} ms=${Date.now() - t0}`);
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
    const ms = Date.now() - t0;
    console.log(`scan ok model=${usedModel} ms=${ms} bytes=${file.size}`);
    return NextResponse.json({ result: out, ms, model: usedModel });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
