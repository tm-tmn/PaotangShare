import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, touchSession, verifySession } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  // weekly e-mail job (Apps Script) fetches the PDF with a shared secret; the route verifies it
  if (req.nextUrl.pathname === "/api/report" && req.headers.get("x-report-secret")) return NextResponse.next();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (await verifySession(token)) {
    // sliding idle timeout: any use keeps the session alive
    const res = NextResponse.next();
    const fresh = await touchSession(token);
    if (fresh) res.cookies.set(SESSION_COOKIE, fresh, sessionCookieOptions());
    return res;
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // everything except login, PWA assets and Next internals
    "/((?!login|api/login|manifest.webmanifest|sw.js|icons/|icon.png|favicon.ico|_next/).*)",
  ],
};
