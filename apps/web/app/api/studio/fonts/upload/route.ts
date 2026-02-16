import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "../..");
const CONFIG_PATH = path.resolve(ROOT_DIR, "studio.config.json");
const PUBLIC_FONTS_DIR = path.resolve(ROOT_DIR, "apps/web/public/fonts");

const ALLOWED_EXTENSIONS = [".woff2", ".woff", ".ttf", ".otf"];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const family = formData.get("family") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!family || family.trim().length === 0) {
      return NextResponse.json(
        { error: "Font family name is required" },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` },
        { status: 400 }
      );
    }

    // Ensure public/fonts directory exists
    if (!fs.existsSync(PUBLIC_FONTS_DIR)) {
      fs.mkdirSync(PUBLIC_FONTS_DIR, { recursive: true });
    }

    // Sanitize filename
    const sanitizedFamily = family.trim().replace(/\s+/g, "-");
    const filename = `${sanitizedFamily}${ext}`;
    const destPath = path.join(PUBLIC_FONTS_DIR, filename);

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(destPath, buffer);

    // Update studio.config.json
    const configRaw = fs.readFileSync(CONFIG_PATH, "utf8");
    const config = JSON.parse(configRaw);
    if (!Array.isArray(config.fonts)) {
      config.fonts = [];
    }

    // Check if font family already exists
    const existing = config.fonts.find(
      (f: { family: string }) => f.family === family.trim()
    );
    if (existing) {
      // Add file to existing entry
      if (!existing.files) existing.files = [];
      if (!existing.files.includes(filename)) {
        existing.files.push(filename);
      }
    } else {
      config.fonts.push({
        family: family.trim(),
        source: "local",
        files: [filename],
      });
    }

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");

    return NextResponse.json({
      success: true,
      font: {
        family: family.trim(),
        source: "local",
        files: [filename],
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
