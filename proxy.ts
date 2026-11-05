import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supaEnv, type CookieItem } from "@/lib/supa";

// Every page/API except the public ones needs a valid Supabase session. The session is refreshed here and the
// fresh cookies are passed on to the route handler as well as the browser.
export async function proxy(req: NextRequest) {
  // weekly e-mail job (Apps Script) fetches the PDF with a shared secret; the route verifies it
  if (req.nextUrl.pathname === "/api/report" && req.headers.get("x-report-secret")) return NextResponse.next();

  const { url, key } = supaEnv();
  let res = NextResponse.next({ request: req });
  let ok = false;
  if (url && key) {
    const sb = createServerClient(url, key, {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list: CookieItem[]) => {
          list.forEach((c) => req.cookies.set(c.name, c.value));
          res = NextResponse.next({ request: req });
          list.forEach((c) => res.cookies.set(c.name, c.value, c.options as never));
        },
      },
    });
    const { data, error } = await sb.auth.getClaims();
    ok = !error && !!data?.claims?.sub;
  }
  if (ok) return res;

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const to = req.nextUrl.clone();
  to.pathname = "/login";
  to.search = "";
  const redirect = NextResponse.redirect(to);
  res.cookies.getAll().forEach((c) => redirect.cookies.set(c)); // keep cookies cleared by a failed refresh
  return redirect;
}

export const config = {
  matcher: [
    // everything except the public auth pages, PWA assets and Next internals
    "/((?!login|signup|forgot|setup|auth/|api/auth/|manifest.webmanifest|sw.js|icons/|icon.png|favicon.ico|_next/).*)",
  ],
};
