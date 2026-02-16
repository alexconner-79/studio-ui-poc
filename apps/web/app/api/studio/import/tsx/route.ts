import { NextResponse } from "next/server";
import { parseTSX } from "@/lib/studio/tsx-parser";

export async function POST(request: Request) {
  try {
    const { code } = await request.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "code string is required" }, { status: 400 });
    }
    const result = parseTSX(code);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ spec: result.spec });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
