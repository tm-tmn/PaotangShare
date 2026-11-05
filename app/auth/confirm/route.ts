import { NextResponse, type NextRequest } from "next/server";
import { appOrigin, safeNext } from "@/lib/authutil";
import { supaForRequest } from "@/lib/supa";

export const dynamic = "force-dynamic";

// Target of the links in Supabase's e-mails (set the templates as described in the README):
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup   (confirm e-mail)
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset   (forgot password)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const origin = appOrigin(req);
  const type = q.get("type");
  const tokenHash = q.get("token_hash");
  const types = ["signup", "recovery", "email", "invite", "magiclink", "email_change"];
  if (!tokenHash || !type || !types.includes(type)) return NextResponse.redirect(`${origin}/login?e=link`);
  const { sb, apply } = supaForRequest(req);
  const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: type as "signup" });
  if (error) return NextResponse.redirect(`${origin}/${type === "recovery" ? "forgot" : "login"}?e=expired`);
  const next = type === "recovery" ? "/reset" : safeNext(q.get("next"));
  return apply(NextResponse.redirect(`${origin}${next === "/" && type === "signup" ? "/?welcome=1" : next}`));
}
