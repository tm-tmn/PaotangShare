"use client";
import jsQR from "jsqr";
import { parseQr, type QrInfo } from "./slipqr";

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through (e.g. HEIC on some browsers) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function draw(src: ImageBitmap | HTMLImageElement, maxSide: number, crop?: [number, number, number, number]) {
  const [sx, sy, sw, sh] = crop || [0, 0, src.width, src.height];
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const c = document.createElement("canvas");
  c.width = Math.round(sw * scale);
  c.height = Math.round(sh * scale);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return { c, ctx };
}

function scan(src: ImageBitmap | HTMLImageElement): string | null {
  const W = src.width, H = src.height;
  // full image at a few sizes, then the lower half / bottom-right where slip QRs usually sit
  const tries: [number, [number, number, number, number]?][] = [
    [1200],
    [800],
    [1600],
    [1000, [0, H / 2, W, H / 2]],
    [900, [W / 2, H / 2, W / 2, H / 2]],
  ];
  for (const [size, crop] of tries) {
    const { c, ctx } = draw(src, size, crop);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const hit = jsQR(data.data, data.width, data.height, { inversionAttempts: "attemptBoth" });
    if (hit?.data) return hit.data;
  }
  return null;
}

export interface Prepared {
  blob: Blob; // kept with the entry (1600 px)
  aiBlob: Blob; // smaller copy sent to the AI (faster upload, plenty for reading text)
  previewUrl: string;
  /** decode the QR code (CPU-heavy, so it is run after the AI request has been started) */
  readQr: () => QrInfo | null;
}

const toJpeg = (c: HTMLCanvasElement, q: number): Promise<Blob> =>
  new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("แปลงรูปไม่สำเร็จ"))), "image/jpeg", q));

/** Shrink the photo to JPEGs that fit comfortably under upload limits; QR decoding is deferred to readQr(). */
export async function prepareSlip(file: Blob): Promise<Prepared> {
  const src = await loadBitmap(file);
  const blob = await toJpeg(draw(src, 1600).c, 0.85);
  const aiBlob = await toJpeg(draw(src, 1280).c, 0.8);
  return {
    blob,
    aiBlob,
    previewUrl: URL.createObjectURL(blob),
    readQr: () => {
      const raw = scan(src);
      return raw ? parseQr(raw) : null;
    },
  };
}
