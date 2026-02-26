import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  isSupabaseConfigured,
  uploadAssetToStorage,
  insertAsset,
} from "@/lib/supabase/queries";

const ROOT_DIR = path.resolve(process.cwd(), "../..");
const ASSETS_DIR = path.resolve(ROOT_DIR, "apps/web/public/assets");

const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_.]/g, "");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const baseName = sanitizeFilename(path.basename(file.name, ext));
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = MIME_MAP[ext] || "application/octet-stream";

    // Supabase path: upload to storage bucket + insert DB row
    if (isSupabaseConfigured() && projectId) {
      const filename = `${baseName}-${Date.now()}${ext}`;
      const result = await uploadAssetToStorage(projectId, buffer, filename, mimeType);
      if (!result) {
        return NextResponse.json({ error: "Storage upload failed" }, { status: 500 });
      }
      const asset = await insertAsset(projectId, filename, result.storagePath, mimeType, buffer.length);
      return NextResponse.json({
        id: asset?.id,
        name: filename,
        url: result.publicUrl,
        storagePath: result.storagePath,
        size: buffer.length,
      });
    }

    // Filesystem fallback
    if (!fs.existsSync(ASSETS_DIR)) {
      fs.mkdirSync(ASSETS_DIR, { recursive: true });
    }

    let filename = `${baseName}${ext}`;
    let destPath = path.join(ASSETS_DIR, filename);
    let counter = 1;
    while (fs.existsSync(destPath)) {
      filename = `${baseName}-${counter}${ext}`;
      destPath = path.join(ASSETS_DIR, filename);
      counter++;
    }

    fs.writeFileSync(destPath, buffer);

    return NextResponse.json({
      name: filename,
      url: `/assets/${filename}`,
      size: buffer.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
