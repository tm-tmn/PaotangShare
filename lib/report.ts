// Cute, password-protected PDF summary (server only). Uses pdfkit + Mali (Thai) fonts bundled in assets/fonts.
import path from "node:path";
import crypto from "node:crypto";
import PDFDocument from "pdfkit";
import type { Settings, Tx } from "./types";

export interface ReportInput {
  items: Tx[];
  settings: Settings;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  password: string;
  now?: Date;
}

// ---------- palette ----------
const C = {
  pink: "#ff8fc0",
  pinkDeep: "#e0508e",
  lav: "#b99cff",
  lavDeep: "#6b4f9e",
  mint: "#5fd0a8",
  mintDeep: "#1f9d6b",
  amber: "#ffb36b",
  text: "#5b3a55",
  muted: "#9a7d94",
  line: "#f1dce8",
  zebra: "#fff7fb",
};
const CAT_COLORS = ["#ff7eb3", "#b49bff", "#ffb36b", "#5fd0a8", "#7cb8ff", "#ff9a8b", "#e58fe0", "#f5cf5b", "#8fd3e8", "#c9a38f"];

// ---------- page geometry ----------
const W = 595.28;
const H = 841.89;
const M = 34;
const CW = W - 2 * M;
const FOOT = 30;

// ---------- formatting ----------
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const WD = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parts = (iso: string) => iso.split("-").map(Number) as [number, number, number];
const dow = (iso: string) => {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};
const dShort = (iso: string) => {
  const [y, m, d] = parts(iso);
  return `${d} ${MONTHS[m - 1]} ${y + 543}`;
};
const dDay = (iso: string) => `${WD[dow(iso)]} ${dShort(iso)}`;
const monthName = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_FULL[m - 1]} ${y + 543}`;
};
const bkk = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  })
    .formatToParts(d)
    .reduce<Record<string, string>>((a, p) => ((a[p.type] = p.value), a), {});
const dayCount = (from: string, to: string) => {
  const a = Date.UTC(...(parts(from).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number]));
  const b = Date.UTC(...(parts(to).map((v, i) => (i === 1 ? v - 1 : v)) as [number, number, number]));
  return Math.round((b - a) / 86400000) + 1;
};

function timeOf(t: Tx): string {
  const d = new Date(t.createdAt);
  if (isNaN(d.getTime())) return "";
  const p = bkk(d);
  return `${p.year}-${p.month}-${p.day}` === t.date ? `${p.hour}:${p.minute}` : "";
}

// ---------- text helpers (Thai has no spaces, so wrap on ICU word boundaries) ----------
type Doc = InstanceType<typeof PDFDocument>;
const wordSeg = new Intl.Segmenter("th", { granularity: "word" });
const graphSeg = new Intl.Segmenter("th", { granularity: "grapheme" });

function wrap(doc: Doc, text: string, width: number, maxLines: number): string[] {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const lines: string[] = [];
  let cur = "";
  const push = (s: string) => lines.push(s.trimEnd());
  for (const { segment } of wordSeg.segment(clean)) {
    if (doc.widthOfString(cur + segment) <= width) {
      cur += segment;
      continue;
    }
    if (cur) {
      push(cur);
      cur = "";
    }
    const seg = segment.trimStart();
    if (doc.widthOfString(seg) <= width) {
      cur = seg;
    } else {
      // a single huge token: split on grapheme clusters so marks stay attached
      for (const { segment: g } of graphSeg.segment(seg)) {
        if (doc.widthOfString(cur + g) > width && cur) {
          push(cur);
          cur = "";
        }
        cur += g;
      }
    }
  }
  if (cur) push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1];
    while (last && doc.widthOfString(last + "…") > width) last = [...graphSeg.segment(last)].slice(0, -1).map((x) => x.segment).join("");
    kept[maxLines - 1] = last + "…";
    return kept;
  }
  return lines;
}

function fit(doc: Doc, text: string, width: number): string {
  return wrap(doc, text, width, 1)[0] || "";
}

// ---------- small drawings ----------
const HEART = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
const STAR = "M12 2 C12.8 8 16 11.2 22 12 C16 12.8 12.8 16 12 22 C11.2 16 8 12.8 2 12 C8 11.2 11.2 8 12 2 Z";

function shape(doc: Doc, d: string, cx: number, cy: number, size: number, color: string, opacity = 1) {
  const s = size / 24;
  doc.save().translate(cx - 12 * s, cy - 12 * s).scale(s).path(d).fillOpacity(opacity).fill(color).restore();
}

function piggy(doc: Doc, cx: number, cy: number) {
  doc.save();
  // ears
  doc.fillColor("#ffb6d3").path(`M${cx - 30},${cy - 18} L${cx - 20},${cy - 40} L${cx - 6},${cy - 26} Z`).fill();
  doc.fillColor("#ffb6d3").path(`M${cx + 30},${cy - 18} L${cx + 20},${cy - 40} L${cx + 6},${cy - 26} Z`).fill();
  // head
  doc.circle(cx, cy, 34).fillColor("#fff4f9").fill();
  doc.circle(cx, cy, 34).lineWidth(2).strokeColor("#ffd0e4").stroke();
  // cheeks
  doc.circle(cx - 22, cy + 6, 6).fillOpacity(0.55).fill("#ff9fc6").fillOpacity(1);
  doc.circle(cx + 22, cy + 6, 6).fillOpacity(0.55).fill("#ff9fc6").fillOpacity(1);
  // eyes
  doc.circle(cx - 14, cy - 8, 3.2).fill("#5b3a55");
  doc.circle(cx + 14, cy - 8, 3.2).fill("#5b3a55");
  doc.circle(cx - 13, cy - 9, 1).fill("#ffffff");
  doc.circle(cx + 15, cy - 9, 1).fill("#ffffff");
  // snout
  doc.ellipse(cx, cy + 10, 14, 10).fill("#ffb6d3");
  doc.ellipse(cx - 5, cy + 10, 2.2, 3.2).fill("#e0508e");
  doc.ellipse(cx + 5, cy + 10, 2.2, 3.2).fill("#e0508e");
  // coin slot on top
  doc.roundedRect(cx - 9, cy - 33, 18, 4, 2).fill("#e0508e");
  doc.restore();
}

function rrect(doc: Doc, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) {
  doc.save().roundedRect(x, y, w, h, r);
  if (stroke) doc.fillAndStroke(fill, stroke);
  else doc.fill(fill);
  doc.restore();
}

function gradRect(doc: Doc, x: number, y: number, w: number, h: number, r: number) {
  const g = doc.linearGradient(x, y, x + w, y + h);
  g.stop(0, C.pink).stop(1, C.lav);
  doc.save().roundedRect(x, y, w, h, r).fill(g).restore();
}

// ---------- the report ----------
export function buildReport(input: ReportInput): Promise<Buffer> {
  const { items, settings, from, to, password } = input;
  const now = input.now || new Date();
  const range = items
    .filter((t) => t.date >= from && t.date <= to)
    .sort((a, b) => (a.date === b.date ? String(a.createdAt).localeCompare(String(b.createdAt)) : a.date.localeCompare(b.date)));
  const sum = (arr: Tx[], type: Tx["type"]) => arr.filter((t) => t.type === type).reduce((a, t) => a + t.amount, 0);
  const income = sum(range, "income");
  const expense = sum(range, "expense");
  const net = income - expense;
  const ym = to.slice(0, 7);
  const monthExpense = sum(items.filter((t) => t.date.slice(0, 7) === ym), "expense");

  const fontDir = path.join(process.cwd(), "assets", "fonts");
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: M, bottom: M, left: M, right: M },
    bufferPages: true,
    font: path.join(fontDir, "Mali_400Regular.ttf"),
    userPassword: password,
    ownerPassword: crypto.randomBytes(16).toString("hex"),
    pdfVersion: "1.7",
    permissions: { printing: "highResolution", copying: true, modifying: false, annotating: false },
    info: {
      Title: `เป๋าตังค์ สรุป ${dShort(from)} – ${dShort(to)}`,
      Author: "เป๋าตังค์",
      Subject: "สรุปรายรับ-รายจ่าย",
    },
  });
  doc.registerFont("r", path.join(fontDir, "Mali_400Regular.ttf"));
  doc.registerFont("m", path.join(fontDir, "Mali_600SemiBold.ttf"));
  doc.registerFont("b", path.join(fontDir, "Mali_700Bold.ttf"));

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const text = (s: string, x: number, y: number, o: { font?: string; size?: number; color?: string; w?: number; align?: "left" | "right" | "center" } = {}) => {
    doc.font(o.font || "r").fontSize(o.size || 10).fillColor(o.color || C.text);
    doc.text(s, x, y, { width: o.w, align: o.align || "left", lineBreak: false });
  };

  let y = M;
  const bottom = () => H - M - FOOT;

  // ----- header -----
  function header() {
    const h = 108;
    gradRect(doc, M, y, CW, h, 24);
    shape(doc, STAR, M + 250, y + 22, 14, "#ffffff", 0.7);
    shape(doc, STAR, M + 300, y + 84, 9, "#ffffff", 0.6);
    shape(doc, HEART, M + 330, y + 30, 12, "#ffffff", 0.55);
    shape(doc, HEART, M + 215, y + 80, 9, "#ffffff", 0.5);
    text("เป๋าตังค์", M + 24, y + 12, { font: "b", size: 30, color: "#ffffff" });
    text("สรุปรายรับ – รายจ่าย", M + 26, y + 52, { font: "m", size: 13, color: "#ffffff" });
    const label = `${dShort(from)} – ${dShort(to)}  (${dayCount(from, to)} วัน)`;
    doc.font("m").fontSize(10.5);
    const cw = doc.widthOfString(label) + 24;
    doc.save().roundedRect(M + 24, y + 77, cw, 21, 10.5).fillOpacity(0.28).fill("#ffffff").restore();
    text(label, M + 36, y + 80, { font: "m", size: 10.5, color: "#ffffff" });
    piggy(doc, W - M - 62, y + 56);
    y += h + 14;
  }

  function miniHeader() {
    gradRect(doc, M, y, CW, 26, 13);
    shape(doc, HEART, M + 18, y + 13, 11, "#ffffff", 0.9);
    text("เป๋าตังค์", M + 30, y + 5, { font: "b", size: 12, color: "#ffffff" });
    text(`${dShort(from)} – ${dShort(to)}`, M + 30, y + 6, { font: "m", size: 10, color: "#ffffff", w: CW - 52, align: "right" });
    y += 26 + 12;
  }

  function newPage() {
    doc.addPage();
    y = M;
    miniHeader();
  }
  const ensure = (h: number) => {
    if (y + h > bottom()) newPage();
  };

  function section(title: string, sub?: string) {
    ensure(40);
    shape(doc, HEART, M + 8, y + 9, 13, C.pink);
    text(title, M + 22, y + 1, { font: "b", size: 13.5, color: C.pinkDeep });
    if (sub) text(sub, M + 22, y + 3, { size: 9.5, color: C.muted, w: CW - 22, align: "right" });
    y += 26;
  }

  // ----- summary cards -----
  function cards() {
    const gap = 12;
    const w = (CW - 2 * gap) / 3;
    const defs = [
      { label: "รายรับ", val: money(income), sub: `${range.filter((t) => t.type === "income").length} รายการ`, bg: "#e4f8ee", bd: "#bfeedb", fg: C.mintDeep, icon: "up" },
      { label: "รายจ่าย", val: money(expense), sub: `${range.filter((t) => t.type === "expense").length} รายการ`, bg: "#ffe6f1", bd: "#ffc6df", fg: C.pinkDeep, icon: "down" },
      { label: "คงเหลือ", val: (net < 0 ? "-" : "") + money(Math.abs(net)), sub: net < 0 ? "จ่ายมากกว่ารับ" : "รับมากกว่าจ่าย", bg: "#efe8ff", bd: "#d8c9ff", fg: C.lavDeep, icon: "heart" },
    ];
    defs.forEach((d, i) => {
      const x = M + i * (w + gap);
      rrect(doc, x, y, w, 70, 18, d.bg, d.bd);
      if (d.icon === "up") doc.save().path(`M${x + 20},${y + 18} l6,-9 l6,9 Z`).fill(d.fg).restore();
      else if (d.icon === "down") doc.save().path(`M${x + 20},${y + 10} l6,9 l6,-9 Z`).fill(d.fg).restore();
      else shape(doc, HEART, x + 26, y + 15, 14, d.fg);
      text(d.label, x + 38, y + 7, { font: "m", size: 11, color: d.fg });
      text(`฿${d.val}`, x + 14, y + 25, { font: "b", size: d.val.length > 11 ? 14 : 17, color: d.fg });
      text(d.sub, x + 14, y + 52, { size: 8.5, color: C.muted });
    });
    y += 70 + 16;
  }

  function bar(x: number, yy: number, w: number, frac: number, color: string, h = 9) {
    rrect(doc, x, yy, w, h, h / 2, "#f6e9f0");
    const fw = Math.max(0, Math.min(1, frac)) * w;
    if (fw > 0) rrect(doc, x, yy, Math.max(fw, h), h, h / 2, color);
  }
  const pctColor = (p: number) => (p >= 100 ? "#ff6f91" : p >= 80 ? C.amber : C.mint);

  function limitCard() {
    const lim = settings.monthlyLimit || 0;
    if (lim <= 0) return;
    ensure(78);
    const pct = Math.round((monthExpense / lim) * 100);
    rrect(doc, M, y, CW, 62, 18, "#fffaf0", "#ffe3b8");
    text(`วงเงินใช้จ่าย ${monthName(ym)}`, M + 16, y + 9, { font: "b", size: 11.5, color: "#b87a1c" });
    text(`${money(monthExpense)} / ${money(lim)} บาท  (${pct}%)`, M + 16, y + 10, { font: "m", size: 10, color: pctColor(pct) === C.mint ? C.mintDeep : "#c2456b", w: CW - 32, align: "right" });
    bar(M + 16, y + 30, CW - 32, monthExpense / lim, pctColor(pct), 10);
    text(monthExpense > lim ? `เกินวงเงินไป ${money(monthExpense - lim)} บาท` : `เหลือใช้ได้อีก ${money(lim - monthExpense)} บาท`, M + 16, y + 45, { size: 9, color: C.muted });
    y += 62 + 16;
  }

  // ----- category breakdown -----
  function categories() {
    const byCat = new Map<string, { sum: number; n: number }>();
    for (const t of range) {
      if (t.type !== "expense") continue;
      const k = t.category || "อื่น ๆ";
      const v = byCat.get(k) || { sum: 0, n: 0 };
      v.sum += t.amount;
      v.n++;
      byCat.set(k, v);
    }
    const rows = [...byCat.entries()].sort((a, b) => b[1].sum - a[1].sum);
    if (!rows.length) return;
    section("รายจ่ายตามหมวด", `${rows.length} หมวด`);
    const show = rows.slice(0, 9);
    if (rows.length > 9) {
      const rest = rows.slice(9);
      show.push([`อื่น ๆ อีก ${rest.length} หมวด`, { sum: rest.reduce((a, r) => a + r[1].sum, 0), n: rest.reduce((a, r) => a + r[1].n, 0) }]);
    }
    const max = show[0][1].sum || 1;
    show.forEach(([name, v], i) => {
      ensure(25);
      const col = CAT_COLORS[i % CAT_COLORS.length];
      doc.circle(M + 8, y + 9, 4.5).fill(col);
      doc.font("m").fontSize(10.5);
      text(fit(doc, name, 118), M + 20, y + 2, { font: "m", size: 10.5 });
      text(`${v.n}`, M + 140, y + 4, { size: 8.5, color: C.muted });
      bar(M + 160, y + 5, 190, v.sum / max, col);
      text(`฿${money(v.sum)}`, M + 355, y + 2, { font: "m", size: 10.5, w: 100, align: "right" });
      text(`${Math.round((v.sum / (expense || 1)) * 100)}%`, M + 462, y + 3, { size: 9.5, color: C.muted, w: CW - 462, align: "right" });
      y += 25;
    });
    y += 8;
  }

  function budgets() {
    const entries = Object.entries(settings.budgets || {}).filter(([, v]) => v > 0);
    if (!entries.length) return;
    const monthItems = items.filter((t) => t.type === "expense" && t.date.slice(0, 7) === ym);
    section("งบรายหมวด", monthName(ym));
    entries.forEach(([cat, bud]) => {
      ensure(25);
      const used = monthItems.filter((t) => t.category === cat).reduce((a, t) => a + t.amount, 0);
      const pct = Math.round((used / bud) * 100);
      doc.circle(M + 8, y + 9, 4.5).fill(pctColor(pct));
      text(fit(doc, cat, 132), M + 20, y + 2, { font: "m", size: 10.5 });
      bar(M + 160, y + 5, 190, used / bud, pctColor(pct));
      text(`${money(used)} / ${money(bud)}`, M + 355, y + 2, { font: "m", size: 10, w: 100, align: "right" });
      text(`${pct}%`, M + 462, y + 3, { size: 9.5, color: pct >= 100 ? "#c2456b" : C.muted, w: CW - 462, align: "right" });
      y += 25;
    });
    y += 8;
  }

  // ----- transaction table -----
  const COL = { time: M + 10, cat: M + 54, note: M + 160, acct: M + 372, amt: M + 440 };
  const COLW = { cat: 100, note: 205, acct: 62, amt: CW - 440 - 10 };

  function tableHead() {
    rrect(doc, M, y, CW, 22, 11, C.pink);
    const h = { font: "b", size: 9.5, color: "#ffffff" };
    text("เวลา", COL.time, y + 4, h);
    text("หมวด", COL.cat, y + 4, h);
    text("รายละเอียด", COL.note, y + 4, h);
    text("บัญชี", COL.acct, y + 4, h);
    text("จำนวน (บาท)", COL.amt, y + 4, { ...h, w: COLW.amt, align: "right" });
    y += 26;
  }

  function table() {
    ensure(70);
    section("รายการทั้งหมด", `${range.length} รายการ`);
    if (!range.length) {
      rrect(doc, M, y, CW, 70, 18, "#fff7fb", C.line);
      text("ไม่มีรายการในช่วงนี้ — พักกระเป๋าตังค์ได้เลย ♡", M, y + 26, { font: "m", size: 12, color: C.muted, w: CW, align: "center" });
      y += 86;
      return;
    }
    ensure(26 + 22 + 30);
    tableHead();
    let lastDate = "";
    let zebra = 0;
    for (const t of range) {
      const catLines = wrap(doc.font("r").fontSize(10), t.category || "-", COLW.cat, 2);
      const noteLines = wrap(doc.font("r").fontSize(10), t.note || t.bank || "", COLW.note, 2);
      const acctLines = wrap(doc.font("r").fontSize(9), t.account || "", COLW.acct, 2);
      const lines = Math.max(1, catLines.length, noteLines.length, acctLines.length);
      const rowH = Math.max(24, lines * 13 + 9);

      if (t.date !== lastDate) {
        if (y + 24 + rowH > bottom()) {
          newPage();
          tableHead();
        }
        const day = range.filter((x) => x.date === t.date);
        const di = sum(day, "income");
        const de = sum(day, "expense");
        rrect(doc, M, y, CW, 22, 11, "#f1eaff");
        text(dDay(t.date), M + 12, y + 4, { font: "b", size: 10.5, color: C.lavDeep });
        const tot = [di ? `รับ +${money(di)}` : "", de ? `จ่าย -${money(de)}` : ""].filter(Boolean).join("   ");
        text(tot, M + 12, y + 5, { size: 9, color: C.muted, w: CW - 24, align: "right" });
        y += 25;
        lastDate = t.date;
        zebra = 0;
      } else if (y + rowH > bottom()) {
        newPage();
        tableHead();
        // repeat the day label on a continuation page
        rrect(doc, M, y, CW, 22, 11, "#f1eaff");
        text(`${dDay(t.date)} (ต่อ)`, M + 12, y + 4, { font: "b", size: 10.5, color: C.lavDeep });
        y += 25;
      }

      if (zebra++ % 2 === 1) rrect(doc, M, y - 1, CW, rowH, 8, C.zebra);
      const tm = timeOf(t);
      text(tm || "–", COL.time, y + 4, { size: 9, color: C.muted });
      doc.font("r").fontSize(10);
      catLines.forEach((l, i) => text(l, COL.cat, y + 3 + i * 13, { font: "m", size: 10 }));
      noteLines.forEach((l, i) => text(l, COL.note, y + 3 + i * 13, { size: 10 }));
      acctLines.forEach((l, i) => text(l, COL.acct, y + 4 + i * 12, { size: 9, color: C.muted }));
      const inc = t.type === "income";
      text(`${inc ? "+" : "-"}${money(t.amount)}`, COL.amt, y + 3, { font: "b", size: 10.5, color: inc ? C.mintDeep : C.pinkDeep, w: COLW.amt, align: "right" });
      y += rowH;
    }

    // grand total
    ensure(44);
    y += 6;
    rrect(doc, M, y, CW, 34, 17, "#fff0f7", "#ffc6df");
    text("รวมทั้งช่วง", M + 16, y + 8, { font: "b", size: 11, color: C.pinkDeep });
    text(`รับ +${money(income)}    จ่าย -${money(expense)}    คงเหลือ ${net < 0 ? "-" : ""}${money(Math.abs(net))}`, M + 16, y + 9, { font: "m", size: 10.5, w: CW - 32, align: "right" });
    y += 40;
  }

  // ----- compose -----
  header();
  cards();
  limitCard();
  categories();
  budgets();
  table();

  // ----- footer on every page -----
  const stamp = bkk(now);
  const made = `${dShort(`${stamp.year}-${stamp.month}-${stamp.day}`)} ${stamp.hour}:${stamp.minute}`;
  const range_ = doc.bufferedPageRange();
  for (let i = 0; i < range_.count; i++) {
    doc.switchToPage(range_.start + i);
    const fy = H - M - FOOT + 10;
    doc.save().moveTo(M, fy - 6).lineTo(W - M, fy - 6).lineWidth(0.8).strokeColor(C.line).stroke().restore();
    shape(doc, HEART, M + 5, fy + 6, 9, C.pink);
    // pdfkit would add a page if text starts below the bottom margin; drop it for the footer line
    const m = doc.page.margins;
    const saved = m.bottom;
    m.bottom = 0;
    text(`สร้างโดยเป๋าตังค์ · ${made}`, M + 14, fy, { size: 8.5, color: C.muted });
    text(`หน้า ${i + 1} / ${range_.count}`, M, fy, { size: 8.5, color: C.muted, w: CW, align: "right" });
    m.bottom = saved;
  }
  doc.end();
  return done;
}
