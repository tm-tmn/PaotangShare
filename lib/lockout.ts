// PIN brute-force protection, per account (keyed by e-mail).
// Primary store: the Apps Script (script properties) — survives across Vercel instances.
// Fallback: per-instance memory, used only if the script is unreachable, so logging in never breaks.
import { authOp } from "./store";

export interface AuthState {
  locked: boolean;
  lockUntil: number; // epoch ms, 0 when not locked
  remaining: number; // wrong tries left before the next lock
  source: "script" | "memory";
}

export const MAX_FAILS = 5;
const BASE_LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 24 * 60 * 60 * 1000;

const mem = new Map<string, { fails: number; level: number; lockUntil: number }>();

function memOp(key: string, op: "status" | "fail" | "ok"): AuthState {
  const now = Date.now();
  const st = mem.get(key) || { fails: 0, level: 0, lockUntil: 0 };
  const locked = st.lockUntil > now;
  if (op === "fail" && !locked) {
    st.fails += 1;
    if (st.fails >= MAX_FAILS) {
      st.level += 1;
      st.lockUntil = now + Math.min(BASE_LOCK_MS * 2 ** (st.level - 1), MAX_LOCK_MS);
      st.fails = 0;
    }
  } else if (op === "ok") {
    st.fails = 0;
    st.level = 0;
    st.lockUntil = 0;
  }
  if (mem.size > 5000) mem.clear();
  mem.set(key, st);
  const isLocked = st.lockUntil > now;
  return { locked: isLocked, lockUntil: isLocked ? st.lockUntil : 0, remaining: isLocked ? 0 : MAX_FAILS - st.fails, source: "memory" };
}

export async function lockout(email: string, op: "status" | "fail" | "ok"): Promise<AuthState> {
  const key = email.trim().toLowerCase().slice(0, 120) || "-";
  try {
    const r = await authOp(key, op);
    return { ...r, source: "script" };
  } catch {
    return memOp(key, op);
  }
}
