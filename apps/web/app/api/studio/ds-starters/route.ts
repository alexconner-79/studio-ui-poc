import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const STARTERS_DIR = path.resolve(process.cwd(), "../../spec/ds-starters");

export interface DSStarter {
  id: string;
  name: string;
  description: string;
  platform: "web" | "native" | "universal";
  preview: string[];
  tokens: Record<string, unknown>;
  components?: Record<string, unknown>;
}

export async function GET() {
  try {
    if (!fs.existsSync(STARTERS_DIR)) {
      return NextResponse.json({ starters: [] });
    }

    const files = fs
      .readdirSync(STARTERS_DIR)
      .filter((f) => f.endsWith(".tokens.json"));

    const starters: DSStarter[] = files
      .map((file) => {
        try {
          const raw = fs.readFileSync(path.join(STARTERS_DIR, file), "utf-8");
          return JSON.parse(raw) as DSStarter;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as DSStarter[];

    // Sort: web first, then native, then universal
    const platformOrder = { web: 0, native: 1, universal: 2 };
    starters.sort((a, b) => platformOrder[a.platform] - platformOrder[b.platform]);

    return NextResponse.json({ starters });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
