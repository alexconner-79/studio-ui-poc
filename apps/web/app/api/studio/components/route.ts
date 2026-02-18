import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { isSupabaseConfigured, listComponents, upsertComponent, deleteComponent } from "@/lib/supabase/queries";

const ROOT_DIR = path.resolve(process.cwd(), "../..");
const COMPONENTS_DIR = path.resolve(ROOT_DIR, "spec/components");

/** GET -- list all custom composite components */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    // Supabase mode
    if (isSupabaseConfigured() && projectId) {
      const components = await listComponents(projectId);
      return NextResponse.json({
        components: components.map((c) => c.spec),
      });
    }

    // Filesystem mode
    if (!fs.existsSync(COMPONENTS_DIR)) {
      return NextResponse.json({ components: [] });
    }
    const files = fs.readdirSync(COMPONENTS_DIR).filter((f) => f.endsWith(".component.json"));
    const components = files.map((f) => {
      const raw = fs.readFileSync(path.join(COMPONENTS_DIR, f), "utf-8");
      return JSON.parse(raw);
    });
    return NextResponse.json({ components });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST -- create a new custom component */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, tree, projectId } = body;
    if (!name || !tree) {
      return NextResponse.json({ error: "name and tree are required" }, { status: 400 });
    }
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, "");
    if (!safeName) {
      return NextResponse.json({ error: "Invalid component name" }, { status: 400 });
    }

    const component = { name: safeName, description: description || "", category: "Custom", tree };

    // Supabase mode
    if (isSupabaseConfigured() && projectId) {
      const result = await upsertComponent(projectId, safeName, component);
      if (!result) {
        return NextResponse.json({ error: "Failed to save component" }, { status: 500 });
      }
      return NextResponse.json({ component }, { status: 201 });
    }

    // Filesystem mode
    if (!fs.existsSync(COMPONENTS_DIR)) {
      fs.mkdirSync(COMPONENTS_DIR, { recursive: true });
    }
    const filePath = path.join(COMPONENTS_DIR, `${safeName}.component.json`);
    fs.writeFileSync(filePath, JSON.stringify(component, null, 2));
    return NextResponse.json({ component }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE -- remove a custom component */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    const projectId = searchParams.get("projectId");
    if (!name) {
      return NextResponse.json({ error: "name query param is required" }, { status: 400 });
    }
    const safeName = path.basename(name).replace(/[^a-zA-Z0-9_-]/g, "");

    // Supabase mode
    if (isSupabaseConfigured() && projectId) {
      const ok = await deleteComponent(projectId, safeName);
      if (!ok) {
        return NextResponse.json({ error: "Component not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    // Filesystem mode
    const filePath = path.join(COMPONENTS_DIR, `${safeName}.component.json`);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }
    fs.unlinkSync(filePath);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
