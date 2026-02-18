import { NextResponse } from "next/server";

/**
 * HTML import is handled client-side using DOMParser.
 * This endpoint exists for potential future server-side usage
 * (e.g., fetching and parsing a URL).
 */
export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Provide a 'url' to fetch and parse, or use client-side parsing" },
        { status: 400 }
      );
    }

    const res = await fetch(url, { headers: { "User-Agent": "Studio-UI/1.0" } });
    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch URL: ${res.status}` }, { status: 400 });
    }
    const html = await res.text();
    return NextResponse.json({ html });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
