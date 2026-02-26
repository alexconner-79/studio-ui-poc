import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  isSupabaseConfigured,
  listAssets,
  deleteAsset,
} from "@/lib/supabase/queries";

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
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    // Supabase path: query assets table
    if (isSupabaseConfigured() && projectId) {
      const rows = await listAssets(projectId);
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
      const assets = rows.map((row) => ({
        id: row.id,
        name: row.file_name,
        url: `${supabaseUrl}/storage/v1/object/public/studio-assets/${row.storage_path}`,
        storagePath: row.storage_path,
        size: row.size_bytes ?? 0,
      }));
      return NextResponse.json({ assets });
    }

    // Filesystem fallback
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
    const assetId = searchParams.get("id");
    const storagePath = searchParams.get("storagePath");

    // Supabase path: delete from storage + DB
    if (isSupabaseConfigured() && assetId && storagePath) {
      const success = await deleteAsset(assetId, storagePath);
      if (!success) {
        return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // Filesystem fallback
    if (!name) {
      return NextResponse.json(
        { error: "name query param is required" },
        { status: 400 },
      );
    }

    const safeName = path.basename(name);
    const filePath = path.join(ASSETS_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "Asset not found" },
        { status: 404 },
      );
    }

    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
