import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { isSupabaseConfigured, listScreens, upsertScreen, getProjectBySlug } from "@/lib/supabase/queries";

const SCREENS_DIR = path.resolve(process.cwd(), "../../spec/screens");

/** GET /api/studio/screens -- list all screen specs */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    // Supabase mode
    if (isSupabaseConfigured() && projectId) {
      const screens = await listScreens(projectId);
      return NextResponse.json({
        screens: screens.map((s) => ({
          name: s.name,
          fileName: `${s.name}.screen.json`,
          spec: s.spec,
        })),
      });
    }

    // Filesystem mode (local dev)
    if (!fs.existsSync(SCREENS_DIR)) {
      return NextResponse.json({ screens: [] });
    }

    const entries = fs
      .readdirSync(SCREENS_DIR)
      .filter((name) => name.endsWith(".screen.json"));

    const screens = entries.map((entry) => {
      const filePath = path.join(SCREENS_DIR, entry);
      const raw = fs.readFileSync(filePath, "utf8");
      const spec = JSON.parse(raw);
      const name = entry.replace(".screen.json", "");
      return { name, fileName: entry, spec };
    });

    screens.sort((a, b) => a.spec.route.localeCompare(b.spec.route));

    return NextResponse.json({ screens });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/studio/screens -- create a new screen spec */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, spec: templateSpec, projectId } = body as {
      name: string;
      spec?: Record<string, unknown>;
      projectId?: string;
    };

    if (!name || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
      return NextResponse.json(
        { error: "Invalid screen name. Use letters, numbers, and hyphens (must start with a letter or number)." },
        { status: 400 }
      );
    }

    const route =
      "/" +
      name
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/[_\s]+/g, "-")
        .toLowerCase();

    const title = name
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());

    const spec = templateSpec
      ? { ...templateSpec, route }
      : {
          version: 1,
          route,
          meta: { layout: "default", auth: "public" },
          tree: {
            id: "root",
            type: "Stack",
            props: { gap: "md", padding: "lg" },
            children: [
              { id: "heading_1", type: "Heading", props: { text: title } },
            ],
          },
        };

    // Supabase mode
    if (isSupabaseConfigured() && projectId) {
      const screen = await upsertScreen(projectId, name, spec);
      if (!screen) {
        return NextResponse.json({ error: "Failed to create screen" }, { status: 500 });
      }
      return NextResponse.json({ name, fileName: `${name}.screen.json`, spec }, { status: 201 });
    }

    // Filesystem mode
    const fileName = `${name}.screen.json`;
    const filePath = path.join(SCREENS_DIR, fileName);

    if (fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `${fileName} already exists` },
        { status: 409 }
      );
    }

    fs.mkdirSync(SCREENS_DIR, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(spec, null, 2) + "\n", "utf8");

    return NextResponse.json({ name, fileName, spec }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
