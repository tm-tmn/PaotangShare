export const baht = (n: number) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

const p2 = (x: number) => String(x).padStart(2, "0");

export function todayISO(d = new Date()) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
export const WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
export const WEEKDAYS_SHORT = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
// สีประจำวันแบบไทย (pastel)
export const WEEKDAY_COLORS = ["#ff8a9a", "#f7cf4a", "#ff9fcf", "#7fd6a4", "#ffb070", "#8cc3ff", "#b99cff"];

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const weekdayOf = (iso: string) => parse(iso).getDay();

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTHS_FULL[m - 1]} ${y + 543}`;
}

export function relativeDay(iso: string): string | null {
  const today = new Date();
  if (iso === todayISO(today)) return "วันนี้";
  const y = new Date(today);
  y.setDate(y.getDate() - 1);
  if (iso === todayISO(y)) return "เมื่อวาน";
  return null;
}

/** "พฤหัสบดี 22 ต.ค." (+ year when not this year) */
export function dayLabel(iso: string) {
  const d = parse(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? "" : " " + String(d.getFullYear() + 543).slice(2)}`;
}

/** "วันพฤหัสบดีที่ 22 ตุลาคม 2569" */
export function fullDate(iso: string) {
  const d = parse(iso);
  return `วัน${WEEKDAYS[d.getDay()]}ที่ ${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** local HH:MM from an ISO timestamp, or "" */
export function timeOf(isoTs: string) {
  const d = new Date(isoTs);
  if (isNaN(d.getTime())) return "";
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function daysInMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** Days left in the month including today; null if ym is not the current month. */
export function daysLeft(ym: string) {
  const today = todayISO();
  if (!today.startsWith(ym)) return null;
  return daysInMonth(ym) - Number(today.slice(8, 10)) + 1;
}

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "อรุณสวัสดิ์ค่ะ ☀️";
  if (h < 16) return "สวัสดีตอนบ่ายค่ะ 🌷";
  if (h < 20) return "สวัสดีตอนเย็นค่ะ 🌸";
  return "ราตรีสวัสดิ์ค่ะ 🌙";
}

/** keep only digits and one dot, max 2 decimals */
export function cleanAmount(v: string) {
  let s = v.replace(/,/g, "").replace(/[^\d.]/g, "");
  const i = s.indexOf(".");
  if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "").slice(0, 2);
  return s.replace(/^0+(?=\d)/, "");
}
