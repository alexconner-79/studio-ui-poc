/**
 * GET /api/studio/changelog
 *
 * Returns the design change log from the editor's in-memory store.
 * Also reads from .studio/changes.json if it exists (for persistence across
 * page refreshes).
 *
 * The change log is a human-readable record of design actions so AI agents
 * (Cursor, Claude Code) can see what the designer changed recently.
 */

import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { ROOT_DIR } from "@/lib/studio/config-paths";

const CHANGES_FILE = path.join(ROOT_DIR, ".studio", "changes.json");

export async function GET() {
  try {
    if (fs.existsSync(CHANGES_FILE)) {
      const raw = fs.readFileSync(CHANGES_FILE, "utf-8");
      const changes = JSON.parse(raw);
      return NextResponse.json({ changes });
    }
    return NextResponse.json({ changes: [] });
  } catch {
    return NextResponse.json({ changes: [] });
  }
}

/** POST — append changes (called by the editor on save) */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const incoming = Array.isArray(body.changes) ? body.changes : [];
    if (incoming.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Read existing
    let existing: unknown[] = [];
    if (fs.existsSync(CHANGES_FILE)) {
      try {
        const raw = fs.readFileSync(CHANGES_FILE, "utf-8");
        existing = JSON.parse(raw) as unknown[];
      } catch {
        existing = [];
      }
    }

    // Merge (newest first, cap at 100)
    const merged = [...incoming, ...existing].slice(0, 100);

    // Write
    const dir = path.dirname(CHANGES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CHANGES_FILE, JSON.stringify(merged, null, 2));

    return NextResponse.json({ ok: true, count: merged.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
