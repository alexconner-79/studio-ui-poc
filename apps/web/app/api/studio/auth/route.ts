import { NextResponse } from "next/server";

/**
 * Simple hash matching the middleware's hashSecret function.
 */
function hashSecret(secret: string): string {
  let hash = 0;
  for (let i = 0; i < secret.length; i++) {
    const char = secret.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `studio_${Math.abs(hash).toString(36)}`;
}

export async function POST(request: Request) {
  const secret = process.env.STUDIO_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "Auth is not enabled" }, { status: 400 });
  }

  const body = await request.json();
  const passphrase = body.passphrase as string;

  if (!passphrase || passphrase !== secret) {
    return NextResponse.json({ error: "Invalid passphrase" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("studio_session", hashSecret(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
  });

  return response;
}
