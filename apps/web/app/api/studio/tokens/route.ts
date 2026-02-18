import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { isSupabaseConfigured, getTokens, upsertTokens } from "@/lib/supabase/queries";

const ROOT_DIR = path.resolve(process.cwd(), "../..");
const TOKENS_PATH = path.resolve(ROOT_DIR, "tokens/design-tokens.json");

/** GET -- read current design tokens */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    // Supabase mode
    if (isSupabaseConfigured() && projectId) {
      const tokens = await getTokens(projectId);
      return NextResponse.json({ tokens: tokens ?? {} });
    }

    // Filesystem mode
    if (!fs.existsSync(TOKENS_PATH)) {
      return NextResponse.json({ tokens: {} });
    }
    const raw = fs.readFileSync(TOKENS_PATH, "utf-8");
    return NextResponse.json({ tokens: JSON.parse(raw) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PUT -- overwrite design tokens */
export async function PUT(request: Request) {
  try {
    const { tokens, projectId } = (await request.json()) as {
      tokens: Record<string, unknown>;
      projectId?: string;
    };

    if (!tokens || typeof tokens !== "object") {
      return NextResponse.json({ error: "tokens object is required" }, { status: 400 });
    }

    // Supabase mode
    if (isSupabaseConfigured() && projectId) {
      const ok = await upsertTokens(projectId, tokens);
      if (!ok) {
        return NextResponse.json({ error: "Failed to save tokens" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // Filesystem mode
    const dir = path.dirname(TOKENS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
