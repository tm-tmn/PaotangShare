import { getSlip } from "@/lib/store";

// Streams a slip image from Drive (via Apps Script) so it shows in the app without a Google login.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { mime, bytes } = await getSlip(id);
    return new Response(new Uint8Array(bytes), {
      headers: { "Content-Type": mime || "image/jpeg", "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
