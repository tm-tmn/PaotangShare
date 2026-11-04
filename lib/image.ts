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
  blob: Blob;
  previewUrl: string;
  qr: QrInfo | null;
}

/** Read the slip QR and shrink the photo to a JPEG that fits comfortably under upload limits. */
export async function prepareSlip(file: Blob): Promise<Prepared> {
  const src = await loadBitmap(file);
  const raw = scan(src);
  const { c } = draw(src, 1600);
  const blob: Blob = await new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("แปลงรูปไม่สำเร็จ"))), "image/jpeg", 0.85),
  );
  return { blob, previewUrl: URL.createObjectURL(blob), qr: raw ? parseQr(raw) : null };
}
