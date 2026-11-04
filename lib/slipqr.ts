// Parse the QR printed on Thai bank transfer slips (BOT "mini QR") and,
// as a fallback, PromptPay / Thai QR payment codes (EMVCo TLV).

export const BANKS: Record<string, string> = {
  "002": "กรุงเทพ",
  "004": "กสิกรไทย",
  "006": "กรุงไทย",
  "011": "ทีทีบี",
  "014": "ไทยพาณิชย์",
  "022": "ซีไอเอ็มบี",
  "024": "ยูโอบี",
  "025": "กรุงศรี",
  "030": "ออมสิน",
  "033": "ธอส.",
  "034": "ธ.ก.ส.",
  "067": "ทิสโก้",
  "069": "เกียรตินาคินภัทร",
  "070": "ไอซีบีซี",
  "073": "แลนด์ แอนด์ เฮ้าส์",
};

export interface QrInfo {
  kind: "slip" | "promptpay" | "unknown";
  raw: string;
  transRef?: string;
  bankCode?: string;
  bank?: string;
  amount?: number;
  payee?: string;
}

function tlv(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i + 4 <= s.length) {
    const tag = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    if (!Number.isFinite(len)) break;
    out[tag] = s.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return out;
}

export function parseQr(raw: string): QrInfo {
  const text = raw.trim();
  if (!/^\d{4}/.test(text)) return { kind: "unknown", raw: text };
  const top = tlv(text);

  // Slip mini-QR: tag 00 holds a nested block with API id 000001
  if (top["00"] && top["00"].length > 6) {
    const inner = tlv(top["00"]);
    if (inner["00"] === "000001" && inner["02"]) {
      const bankCode = inner["01"];
      return {
        kind: "slip",
        raw: text,
        transRef: inner["02"],
        bankCode,
        bank: bankCode ? BANKS[bankCode] || `ธนาคาร ${bankCode}` : undefined,
      };
    }
  }

  // PromptPay / Thai QR payment
  if (top["00"] === "01" && (top["29"] || top["30"] || top["58"] === "TH")) {
    const amount = top["54"] ? Number(top["54"]) : undefined;
    return { kind: "promptpay", raw: text, amount, payee: top["59"] };
  }

  return { kind: "unknown", raw: text };
}
