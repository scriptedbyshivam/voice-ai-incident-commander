import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Server-side route protection (optimistic, JWT-cookie based). Auth.js's
// `auth(handler)` middleware wrapper exposes the decoded session as `req.auth`.
// Protected traffic is gated before the route renders; the NextAuth handler at
// /api/auth/* and all static assets are excluded via the matcher.
export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isProtected =
    pathname === "/incidents" ||
    pathname.startsWith("/incidents/") ||
    pathname.startsWith("/api/incidents/");

  if (isProtected && !isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.nextUrl);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/incidents/:path*", "/api/incidents/:path*"],
};
