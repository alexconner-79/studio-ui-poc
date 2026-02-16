import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "../..");
const ASSETS_DIR = path.resolve(ROOT_DIR, "apps/web/public/assets");

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
]);

/** GET -- list all uploaded image assets */
export async function GET() {
  try {
    if (!fs.existsSync(ASSETS_DIR)) {
      return NextResponse.json({ assets: [] });
    }

    const files = fs.readdirSync(ASSETS_DIR);
    const assets = files
      .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
      .map((f) => {
        const stat = fs.statSync(path.join(ASSETS_DIR, f));
        return {
          name: f,
          url: `/assets/${f}`,
          size: stat.size,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({ assets });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE -- remove an uploaded asset */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    if (!name) {
      return NextResponse.json(
        { error: "name query param is required" },
        { status: 400 }
      );
    }

    // Prevent path traversal
    const safeName = path.basename(name);
    const filePath = path.join(ASSETS_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 }
      );
    }

    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
