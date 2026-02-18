import { NextResponse } from "next/server";
import { isSupabaseConfigured, listProjects, createProject } from "@/lib/supabase/queries";

/** GET /api/studio/projects -- list user's projects */
export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      // Filesystem mode: return a single "local" pseudo-project
      return NextResponse.json({
        projects: [
          {
            id: "local",
            name: "Local Project",
            slug: "local",
            framework: "nextjs",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      });
    }

    const projects = await listProjects();
    return NextResponse.json({ projects });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/studio/projects -- create a new project */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, framework } = body as { name: string; framework?: string };

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        project: {
          id: "local",
          name: name.trim(),
          slug,
          framework: framework ?? "nextjs",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }, { status: 201 });
    }

    const project = await createProject({
      name: name.trim(),
      slug,
      framework: framework ?? "nextjs",
    });

    if (!project) {
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
