import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "../..");
const TEMPLATES_DIR = path.resolve(ROOT_DIR, "spec/templates");

/** GET -- list all starter component templates */
export async function GET() {
  try {
    if (!fs.existsSync(TEMPLATES_DIR)) {
      return NextResponse.json({ templates: [] });
    }
    const files = fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith(".component.json"));
    const templates = files.map((f) => {
      const raw = fs.readFileSync(path.join(TEMPLATES_DIR, f), "utf-8");
      return JSON.parse(raw);
    });
    return NextResponse.json({ templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
