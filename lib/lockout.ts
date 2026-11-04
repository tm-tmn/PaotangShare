// PIN brute-force protection.
// Primary store: the Apps Script (script properties) — survives across Vercel instances.
// Fallback: per-instance memory, used only if the script is an older version or unreachable,
// so logging in never breaks while the script is being updated.
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

const mem = { fails: 0, level: 0, lockUntil: 0 };

function memOp(op: "status" | "fail" | "ok"): AuthState {
  const now = Date.now();
  const locked = mem.lockUntil > now;
  if (op === "fail" && !locked) {
    mem.fails += 1;
    if (mem.fails >= MAX_FAILS) {
      mem.level += 1;
      mem.lockUntil = now + Math.min(BASE_LOCK_MS * 2 ** (mem.level - 1), MAX_LOCK_MS);
      mem.fails = 0;
    }
  } else if (op === "ok") {
    mem.fails = 0;
    mem.level = 0;
    mem.lockUntil = 0;
  }
  const isLocked = mem.lockUntil > now;
  return { locked: isLocked, lockUntil: isLocked ? mem.lockUntil : 0, remaining: isLocked ? 0 : MAX_FAILS - mem.fails, source: "memory" };
}

export async function lockout(op: "status" | "fail" | "ok"): Promise<AuthState> {
  try {
    const r = await authOp(op);
    // keep the memory copy in step so a later script outage doesn't reset protection
    if (r.locked) mem.lockUntil = Math.max(mem.lockUntil, r.lockUntil);
    if (op === "ok") memOp("ok");
    return { ...r, source: "script" };
  } catch {
    return memOp(op);
  }
}

/** constant-time string compare (no early exit on the first wrong digit) */
export function samePin(a: string, b: string) {
  const len = Math.max(a.length, b.length, 1);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
