import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import JSZip from "jszip";

const ROOT_DIR = path.resolve(process.cwd(), "../..");
const SCREENS_DIR = path.resolve(ROOT_DIR, "spec/screens");

type ImportResult = {
  name: string;
  status: "imported" | "error" | "skipped";
  error?: string;
};

function basicValidate(spec: unknown): string | null {
  if (!spec || typeof spec !== "object") return "Not a valid JSON object";
  const s = spec as Record<string, unknown>;
  if (s.version !== 1) return "version must be 1";
  if (typeof s.route !== "string" || !s.route) return "route is required";
  if (!s.tree || typeof s.tree !== "object") return "tree is required";
  const tree = s.tree as Record<string, unknown>;
  if (typeof tree.id !== "string") return "tree.id is required";
  if (typeof tree.type !== "string") return "tree.type is required";
  return null;
}

async function processFile(
  fileName: string,
  content: string,
  overwrite: boolean
): Promise<ImportResult> {
  const name = fileName.replace(/\.screen\.json$/, "").replace(/\.json$/, "");
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeName) {
    return { name: fileName, status: "error", error: "Invalid file name" };
  }

  let spec: unknown;
  try {
    spec = JSON.parse(content);
  } catch {
    return { name: safeName, status: "error", error: "Invalid JSON" };
  }

  const validationError = basicValidate(spec);
  if (validationError) {
    return { name: safeName, status: "error", error: validationError };
  }

  const destPath = path.join(SCREENS_DIR, `${safeName}.screen.json`);
  if (fs.existsSync(destPath) && !overwrite) {
    return { name: safeName, status: "skipped", error: "Already exists" };
  }

  if (!fs.existsSync(SCREENS_DIR)) {
    fs.mkdirSync(SCREENS_DIR, { recursive: true });
  }

  fs.writeFileSync(destPath, JSON.stringify(spec, null, 2));
  return { name: safeName, status: "imported" };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const overwrite = formData.get("overwrite") === "true";
    const results: ImportResult[] = [];

    const entries = formData.getAll("files");

    for (const entry of entries) {
      if (!(entry instanceof File)) continue;

      const ext = path.extname(entry.name).toLowerCase();

      if (ext === ".zip") {
        const buffer = Buffer.from(await entry.arrayBuffer());
        const zip = await JSZip.loadAsync(buffer);

        const filePromises: Promise<ImportResult>[] = [];
        zip.forEach((relativePath, file) => {
          if (file.dir) return;
          if (!relativePath.endsWith(".json")) return;
          filePromises.push(
            file.async("string").then((content) =>
              processFile(path.basename(relativePath), content, overwrite)
            )
          );
        });

        const zipResults = await Promise.all(filePromises);
        results.push(...zipResults);
      } else if (ext === ".json") {
        const content = await entry.text();
        const result = await processFile(entry.name, content, overwrite);
        results.push(result);
      } else {
        results.push({
          name: entry.name,
          status: "error",
          error: `Unsupported file type: ${ext}`,
        });
      }
    }

    const imported = results.filter((r) => r.status === "imported").length;
    const errors = results.filter((r) => r.status === "error").length;
    const skipped = results.filter((r) => r.status === "skipped").length;

    return NextResponse.json({
      results,
      summary: { imported, errors, skipped, total: results.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
