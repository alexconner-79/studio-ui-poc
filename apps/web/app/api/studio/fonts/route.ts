import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "../..");
const CONFIG_PATH = path.resolve(ROOT_DIR, "studio.config.json");

type FontEntry = {
  family: string;
  source: "google" | "local";
  weights?: string[];
  files?: string[];
};

function readConfig(): Record<string, unknown> {
  const raw = fs.readFileSync(CONFIG_PATH, "utf8");
  return JSON.parse(raw);
}

function writeConfig(config: Record<string, unknown>): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}

/** GET -- list all project fonts */
export async function GET() {
  try {
    const config = readConfig();
    const fonts = Array.isArray(config.fonts) ? config.fonts : [];
    return NextResponse.json({ fonts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST -- add a Google font to the project */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as FontEntry;
    if (!body.family || !body.source) {
      return NextResponse.json(
        { error: "family and source are required" },
        { status: 400 }
      );
    }

    const config = readConfig();
    if (!Array.isArray(config.fonts)) {
      config.fonts = [];
    }

    const fonts = config.fonts as FontEntry[];

    // Prevent duplicates
    if (fonts.some((f) => f.family === body.family)) {
      return NextResponse.json({ fonts }, { status: 200 });
    }

    fonts.push({
      family: body.family,
      source: body.source,
      weights: body.weights,
      files: body.files,
    });

    writeConfig(config);
    return NextResponse.json({ fonts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE -- remove a font from the project */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const family = searchParams.get("family");
    if (!family) {
      return NextResponse.json(
        { error: "family query param is required" },
        { status: 400 }
      );
    }

    const config = readConfig();
    if (!Array.isArray(config.fonts)) {
      config.fonts = [];
    }

    const fonts = config.fonts as FontEntry[];
    const entry = fonts.find((f) => f.family === family);

    // If it's a local font, delete the files too
    if (entry?.source === "local" && entry.files) {
      const fontsDir = path.resolve(ROOT_DIR, "apps/web/public/fonts");
      for (const file of entry.files) {
        const filePath = path.join(fontsDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    }

    config.fonts = fonts.filter((f) => f.family !== family);
    writeConfig(config);
    return NextResponse.json({ fonts: config.fonts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
