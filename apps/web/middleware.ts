import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Studio auth middleware.
 *
 * If Supabase env vars are configured, uses Supabase Auth to protect
 * /studio and /api/studio routes. Unauthenticated requests are
 * redirected to /login.
 *
 * If Supabase is NOT configured (no NEXT_PUBLIC_SUPABASE_URL), the
 * editor is open -- convenience for local development.
 */
export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // No Supabase configured -- editor is open (dev mode)
  if (!supabaseUrl) {
    return NextResponse.next();
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/studio/:path*",
    "/api/studio/:path*",
    "/login",
    "/signup",
    "/auth/:path*",
    "/admin/:path*",
  ],
};
