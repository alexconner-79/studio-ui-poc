import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { isSupabaseConfigured, getScreen, upsertScreen, createVersion, deleteScreen } from "@/lib/supabase/queries";
import { SCREENS_DIR } from "@/lib/studio/config-paths";

type Params = { params: Promise<{ name: string }> };

/** GET /api/studio/screens/[name] -- get a single screen spec */
export async function GET(request: Request, context: Params) {
  try {
    const { name } = await context.params;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    // Supabase mode
    if (isSupabaseConfigured() && projectId) {
      const screen = await getScreen(projectId, name);
      if (!screen) {
        return NextResponse.json({ error: `Screen "${name}" not found` }, { status: 404 });
      }
      return NextResponse.json({ name: screen.name, spec: screen.spec });
    }

    // Filesystem mode
    const filePath = path.join(SCREENS_DIR, `${name}.screen.json`);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `Screen "${name}" not found` },
        { status: 404 }
      );
    }

    const raw = fs.readFileSync(filePath, "utf8");
    const spec = JSON.parse(raw);

    return NextResponse.json({ name, spec });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PUT /api/studio/screens/[name] -- save updated spec */
export async function PUT(request: Request, context: Params) {
  try {
    const { name } = await context.params;
    const body = await request.json();
    const { spec, projectId } = body as { spec: unknown; projectId?: string };

    if (!spec || typeof spec !== "object") {
      return NextResponse.json(
        { error: "Request body must include a spec object" },
        { status: 400 }
      );
    }

    // Supabase mode
    if (isSupabaseConfigured() && projectId) {
      const screen = await upsertScreen(projectId, name, spec as Record<string, unknown>);
      if (!screen) {
        return NextResponse.json({ error: "Failed to save screen" }, { status: 500 });
      }
      // Auto-snapshot version on save
      await createVersion(screen.id, spec as Record<string, unknown>);
      return NextResponse.json({ name, spec });
    }

    // Filesystem mode
    const filePath = path.join(SCREENS_DIR, `${name}.screen.json`);
    fs.mkdirSync(SCREENS_DIR, { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify(spec, null, 2) + "\n",
      "utf8"
    );

    return NextResponse.json({ name, spec });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/studio/screens/[name] -- delete a screen */
export async function DELETE(request: Request, context: Params) {
  try {
    const { name } = await context.params;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (isSupabaseConfigured() && projectId) {
      const ok = await deleteScreen(projectId, name);
      if (!ok) {
        return NextResponse.json({ error: "Failed to delete screen" }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    const filePath = path.join(SCREENS_DIR, `${name}.screen.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
