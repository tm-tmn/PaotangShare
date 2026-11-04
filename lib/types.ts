export type TxType = "income" | "expense";

export interface Tx {
  id: string;
  createdAt: string;
  date: string; // YYYY-MM-DD
  type: TxType;
  amount: number;
  category: string;
  note: string;
  bank: string;
  transRef: string;
  slipFileId: string;
  account: string;
}

export interface Recurring {
  id: string;
  day: number; // 1-28
  type: TxType;
  amount: number;
  category: string;
  note: string;
  account: string;
}

export interface Settings {
  expenseCategories: string[];
  incomeCategories: string[];
  accounts: string[];
  budgets: Record<string, number>;
  recurring: Recurring[];
  weeklyEmail: boolean;
  monthlyLimit: number; // 0 = off
}

export const DEFAULT_SETTINGS: Settings = {
  expenseCategories: ["อาหาร", "เดินทาง", "ช้อปปิ้ง", "บิล/ค่าน้ำไฟ", "ที่พัก", "สุขภาพ", "บันเทิง", "โอนให้คนอื่น", "อื่น ๆ"],
  incomeCategories: ["เงินเดือน", "โบนัส", "ขายของ", "รับโอน", "ดอกเบี้ย/ปันผล", "อื่น ๆ"],
  accounts: ["เงินสด"],
  budgets: {},
  recurring: [],
  weeklyEmail: false,
  monthlyLimit: 0,
};

/** What the AI slip reader returns (all optional). */
export interface ScanResult {
  isSlip?: boolean;
  amount?: number;
  date?: string;
  time?: string;
  fromName?: string;
  fromBank?: string;
  toName?: string;
  toBank?: string;
  transRef?: string;
  memo?: string;
  suggestedCategory?: string;
}
