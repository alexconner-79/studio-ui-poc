import { NextResponse } from "next/server";

type GoogleFont = {
  family: string;
  variants: string[];
  category: string;
};

type GoogleFontsResponse = {
  items: GoogleFont[];
};

let cachedFonts: GoogleFont[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

async function fetchGoogleFonts(apiKey: string): Promise<GoogleFont[]> {
  if (cachedFonts && Date.now() - cacheTime < CACHE_TTL) {
    return cachedFonts;
  }

  const url = `https://www.googleapis.com/webfonts/v1/webfonts?key=${apiKey}&sort=popularity`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Google Fonts API returned ${res.status}: ${res.statusText}`);
  }

  const data = (await res.json()) as GoogleFontsResponse;
  cachedFonts = data.items ?? [];
  cacheTime = Date.now();
  return cachedFonts;
}

export async function GET(request: Request) {
  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GOOGLE_FONTS_API_KEY not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = (searchParams.get("search") ?? "").toLowerCase().trim();
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "30", 10), 100);

  try {
    let fonts = await fetchGoogleFonts(apiKey);

    if (search) {
      fonts = fonts.filter((f) => f.family.toLowerCase().includes(search));
    }

    const results = fonts.slice(0, limit).map((f) => ({
      family: f.family,
      variants: f.variants,
      category: f.category,
    }));

    return NextResponse.json({ fonts: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
