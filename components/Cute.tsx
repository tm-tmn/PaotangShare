"use client";
import { useEffect, useState } from "react";

/** น้องหมูเป๋าตังค์ — the app mascot */
export function Piggy({ size = 96, mood = "happy", className = "" }: { size?: number; mood?: "happy" | "wink" | "sleepy" | "wow"; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={`piggy ${className}`} aria-hidden="true">
      <defs>
        <radialGradient id="pg-body" cx="45%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#ffe3ef" />
          <stop offset="70%" stopColor="#ffb3d1" />
          <stop offset="100%" stopColor="#ff94bd" />
        </radialGradient>
      </defs>
      {/* coin */}
      <g className="piggy-coin">
        <circle cx="60" cy="14" r="10" fill="#ffd56b" stroke="#f2b632" strokeWidth="2" />
        <text x="60" y="19" textAnchor="middle" fontSize="13" fontWeight="700" fill="#d48f10">฿</text>
      </g>
      {/* ears */}
      <path d="M30 40 L24 18 L46 30 Z" fill="#ff9cc4" stroke="#f47fae" strokeWidth="2" strokeLinejoin="round" />
      <path d="M90 40 L96 18 L74 30 Z" fill="#ff9cc4" stroke="#f47fae" strokeWidth="2" strokeLinejoin="round" />
      {/* legs */}
      <rect x="34" y="88" width="14" height="18" rx="6" fill="#ff9cc4" />
      <rect x="72" y="88" width="14" height="18" rx="6" fill="#ff9cc4" />
      {/* body */}
      <ellipse cx="60" cy="64" rx="42" ry="36" fill="url(#pg-body)" stroke="#f47fae" strokeWidth="2" />
      {/* coin slot */}
      <rect x="50" y="30" width="20" height="4" rx="2" fill="#e76aa0" opacity=".7" />
      {/* eyes */}
      {mood === "sleepy" ? (
        <>
          <path d="M38 56 q5 4 10 0" stroke="#5b2f4d" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M72 56 q5 4 10 0" stroke="#5b2f4d" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : mood === "wink" ? (
        <>
          <circle cx="43" cy="55" r="4.5" fill="#5b2f4d" />
          <circle cx="44.5" cy="53.5" r="1.4" fill="#fff" />
          <path d="M72 56 q5 -4 10 0" stroke="#5b2f4d" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <g className="piggy-eyes">
          <circle cx="43" cy="55" r={mood === "wow" ? 5.5 : 4.5} fill="#5b2f4d" />
          <circle cx="77" cy="55" r={mood === "wow" ? 5.5 : 4.5} fill="#5b2f4d" />
          <circle cx="44.5" cy="53.5" r="1.5" fill="#fff" />
          <circle cx="78.5" cy="53.5" r="1.5" fill="#fff" />
        </g>
      )}
      {/* blush */}
      <ellipse cx="34" cy="67" rx="7" ry="4" fill="#ff7aa8" opacity=".45" />
      <ellipse cx="86" cy="67" rx="7" ry="4" fill="#ff7aa8" opacity=".45" />
      {/* snout */}
      <ellipse cx="60" cy="70" rx="14" ry="10" fill="#ff8fbb" stroke="#f47fae" strokeWidth="2" />
      <ellipse cx="55" cy="70" rx="2.6" ry="3.6" fill="#d9558f" />
      <ellipse cx="65" cy="70" rx="2.6" ry="3.6" fill="#d9558f" />
      {mood === "wow" ? (
        <ellipse cx="60" cy="86" rx="4" ry="4.5" fill="#d9558f" />
      ) : (
        <path d="M54 84 q6 5 12 0" stroke="#d9558f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      )}
      {/* tiny heart */}
      <path className="piggy-heart" d="M98 74 c0-4 6-5 6 0 c0-5 6-4 6 0 c0 4-6 7-6 9 c0-2-6-5-6-9z" fill="#ff5c93" />
    </svg>
  );
}

/** floating pastel blobs + twinkles behind everything */
export function BgDeco() {
  return (
    <div className="bg-deco" aria-hidden="true">
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
      {["✦", "♡", "✧", "✦", "♡", "✧", "✦"].map((c, i) => (
        <i key={i} className={`twinkle t${i}`}>{c}</i>
      ))}
    </div>
  );
}

/** heart + sparkle burst; render with a changing `fire` key */
export function Celebrate({ fire }: { fire: number }) {
  const [bits, setBits] = useState<{ id: number; x: number; d: number; r: number; c: string; delay: number }[]>([]);
  useEffect(() => {
    if (!fire) return;
    const chars = ["💖", "✨", "🌸", "💗", "⭐", "🎀", "💕"];
    const next = Array.from({ length: 18 }, (_, i) => ({
      id: fire * 100 + i,
      x: (Math.random() - 0.5) * 300,
      d: 140 + Math.random() * 220,
      r: (Math.random() - 0.5) * 120,
      c: chars[i % chars.length],
      delay: Math.random() * 120,
    }));
    setBits(next);
    const t = setTimeout(() => setBits([]), 1400);
    return () => clearTimeout(t);
  }, [fire]);
  if (!bits.length) return null;
  return (
    <div className="celebrate" aria-hidden="true">
      {bits.map((b) => (
        <span
          key={b.id}
          style={{ "--x": `${b.x}px`, "--d": `${-b.d}px`, "--r": `${b.r}deg`, animationDelay: `${b.delay}ms` } as React.CSSProperties}
        >
          {b.c}
        </span>
      ))}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="glass list skel" aria-label="กำลังโหลด">
      {Array.from({ length: rows }, (_, i) => (
        <div className="row" key={i}>
          <span className="dot shimmer" />
          <span className="mid">
            <b className="shimmer" style={{ width: `${50 + ((i * 17) % 35)}%` }} />
            <small className="shimmer" style={{ width: `${30 + ((i * 11) % 20)}%` }} />
          </span>
          <span className="amt shimmer" style={{ width: 54 }} />
        </div>
      ))}
    </div>
  );
}
