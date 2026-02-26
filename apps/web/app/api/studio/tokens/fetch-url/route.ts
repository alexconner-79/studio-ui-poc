import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  // Only allow fetching from known safe origins (raw GitHub, npm CDNs, etc.)
  try {
    const parsed = new URL(url);
    const allowed = [
      "raw.githubusercontent.com",
      "cdn.jsdelivr.net",
      "unpkg.com",
      "esm.sh",
    ];
    if (!allowed.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
      return NextResponse.json(
        { error: `Fetching from ${parsed.hostname} is not allowed. Supported: ${allowed.join(", ")}` },
        { status: 403 }
      );
    }

    const res = await fetch(url, {
      headers: { "Accept": "application/json, text/plain, */*" },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Remote returned ${res.status} ${res.statusText}` },
        { status: 502 }
      );
    }

    const text = await res.text();
    return new NextResponse(text, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
