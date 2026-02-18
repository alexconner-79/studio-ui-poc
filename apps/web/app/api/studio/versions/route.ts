import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { isSupabaseConfigured, listVersions, createVersion, getVersion } from "@/lib/supabase/queries";

const ROOT_DIR = path.resolve(process.cwd(), "../..");
const VERSIONS_DIR = path.resolve(ROOT_DIR, "spec/.versions");

interface LocalVersion {
  id: string;
  screenName: string;
  spec: Record<string, unknown>;
  label: string | null;
  created_at: string;
}

function getLocalVersionsPath(screenName: string): string {
  return path.join(VERSIONS_DIR, `${screenName}.versions.json`);
}

function loadLocalVersions(screenName: string): LocalVersion[] {
  const filePath = getLocalVersionsPath(screenName);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw) as LocalVersion[];
  } catch {
    return [];
  }
}

function saveLocalVersions(screenName: string, versions: LocalVersion[]): void {
  fs.mkdirSync(VERSIONS_DIR, { recursive: true });
  const filePath = getLocalVersionsPath(screenName);
  fs.writeFileSync(filePath, JSON.stringify(versions, null, 2), "utf8");
}

/** GET /api/studio/versions?screenName=...&screenId=... */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const screenName = searchParams.get("screenName");
    const screenId = searchParams.get("screenId");

    // Supabase mode
    if (isSupabaseConfigured() && screenId) {
      const versions = await listVersions(screenId);
      return NextResponse.json({ versions });
    }

    // Filesystem mode
    if (!screenName) {
      return NextResponse.json({ error: "screenName is required" }, { status: 400 });
    }
    const versions = loadLocalVersions(screenName);
    return NextResponse.json({ versions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/studio/versions -- create a version snapshot */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { screenName, screenId, spec, label } = body as {
      screenName?: string;
      screenId?: string;
      spec: Record<string, unknown>;
      label?: string;
    };

    if (!spec) {
      return NextResponse.json({ error: "spec is required" }, { status: 400 });
    }

    // Supabase mode
    if (isSupabaseConfigured() && screenId) {
      const version = await createVersion(screenId, spec, label);
      return NextResponse.json({ version }, { status: 201 });
    }

    // Filesystem mode
    if (!screenName) {
      return NextResponse.json({ error: "screenName is required" }, { status: 400 });
    }

    const versions = loadLocalVersions(screenName);
    const newVersion: LocalVersion = {
      id: `v_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      screenName,
      spec,
      label: label ?? null,
      created_at: new Date().toISOString(),
    };

    // Prepend (newest first), keep max 50
    versions.unshift(newVersion);
    if (versions.length > 50) versions.length = 50;
    saveLocalVersions(screenName, versions);

    return NextResponse.json({ version: newVersion }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
