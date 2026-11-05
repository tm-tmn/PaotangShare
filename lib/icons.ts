const ICONS: Record<string, string> = {
  อาหาร: "🍰", เดินทาง: "🚕", ช้อปปิ้ง: "🛍️", "บิล/ค่าน้ำไฟ": "💡", ที่พัก: "🏡", สุขภาพ: "💊",
  บันเทิง: "🎀", โอนให้คนอื่น: "💌", เงินเดือน: "👛", โบนัส: "🎉", ขายของ: "🏷️", รับโอน: "💝",
  "ดอกเบี้ย/ปันผล": "🌱", กาแฟ: "☕", ของใช้: "🧴", ลูก: "🧸", สัตว์เลี้ยง: "🐾", ประกัน: "🛡️",
  ลงทุน: "📈", ท่องเที่ยว: "✈️", การศึกษา: "📚", ของขวัญ: "🎁", น้ำมัน: "⛽", ผ่อน: "💳",
  เครื่องสำอาง: "💄", ความสวยงาม: "💅", ขนม: "🍩", "อื่น ๆ": "🌼",
};

const EMOJI_START = /^\p{Extended_Pictographic}/u;

export function iconFor(category: string, type: "income" | "expense") {
  if (ICONS[category]) return ICONS[category];
  const m = category.match(EMOJI_START);
  if (m) return m[0];
  return type === "income" ? "💰" : "🌸";
}

// categorical palette (charts) — readable on light and dark
export const PALETTE = ["#2b5fa6", "#4f9d7a", "#d9a441", "#c0504d", "#7a6bb0", "#3b9aa8", "#d9843f", "#7b8fb8", "#8a9a5b", "#9a7b6b"];

// pastel bubble behind category icons
const TINTS = ["#ffe1ee", "#ece4ff", "#ffecd9", "#dcf6ec", "#e1efff", "#ffe4df", "#fbe2fa", "#fff3cf", "#dff3f9", "#f1e6df"];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function tintFor(category: string, type: "income" | "expense") {
  if (!category) return type === "income" ? "var(--tint-3)" : "var(--tint-0)";
  return `var(--tint-${hash(category) % TINTS.length})`;
}

export const TINT_VARS = TINTS;
