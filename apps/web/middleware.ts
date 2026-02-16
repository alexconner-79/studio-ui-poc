import { NextResponse, type NextRequest } from "next/server";

/**
 * Studio auth middleware.
 *
 * If STUDIO_SECRET is set, all /studio and /api/studio routes require
 * a valid session cookie. Unauthenticated requests are redirected to
 * the login page at /studio/login.
 *
 * If STUDIO_SECRET is not set, the editor is open (dev mode convenience).
 */
export function middleware(request: NextRequest) {
  const secret = process.env.STUDIO_SECRET;

  // No secret configured -- editor is open
  if (!secret) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Allow the login page and the login API itself
  if (pathname === "/studio/login" || pathname === "/api/studio/auth") {
    return NextResponse.next();
  }

  // Check for the session cookie
  const sessionCookie = request.cookies.get("studio_session")?.value;

  if (!sessionCookie || sessionCookie !== hashSecret(secret)) {
    // API routes return 401
    if (pathname.startsWith("/api/studio")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // UI routes redirect to login
    const loginUrl = new URL("/studio/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

/**
 * Simple hash to avoid storing the raw secret in the cookie.
 * Not cryptographically strong, but sufficient for a dev tool passphrase.
 */
function hashSecret(secret: string): string {
  let hash = 0;
  for (let i = 0; i < secret.length; i++) {
    const char = secret.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `studio_${Math.abs(hash).toString(36)}`;
}

export const config = {
  matcher: ["/studio/:path*", "/api/studio/:path*"],
};
