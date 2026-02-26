import { NextResponse } from "next/server";
import { isSupabaseConfigured, listProjects, getProject, createProject, deleteProject, updateProject, linkProjectToDesignSystem } from "@/lib/supabase/queries";

/** GET /api/studio/projects -- list all projects, or a single project if ?id= is provided */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    // Single-project fetch
    if (id) {
      if (!isSupabaseConfigured()) {
        return NextResponse.json({ project: { id: "local", name: "Local Project", slug: "local", framework: "nextjs", design_system_id: null } });
      }
      const project = await getProject(id);
      if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ project });
    }

    // List all projects
    if (!isSupabaseConfigured()) {
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
    const { name, framework, description } = body as {
      name: string;
      framework?: string;
      description?: string;
    };

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
          description: description ?? "",
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

/** PATCH /api/studio/projects?id={id} -- update a project (name, design_system_id) */
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Project id is required" }, { status: 400 });
    }

    const body = await request.json();
    const { name, design_system_id, config } = body as {
      name?: string;
      design_system_id?: string | null;
      config?: Record<string, unknown>;
    };

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ project: { id, name: name?.trim() } });
    }

    // Handle DS link separately (it uses a dedicated update to avoid touching RLS-sensitive fields)
    if (design_system_id !== undefined) {
      await linkProjectToDesignSystem(id, design_system_id ?? null);
    }

    // Handle partial config merge
    if (config !== undefined) {
      const existing = await getProject(id);
      const merged = { ...(existing?.config ?? {}), ...config };
      await updateProject(id, { config: merged });
    }

    if (name && name.trim().length > 0) {
      const project = await updateProject(id, { name: name.trim() });
      if (!project) {
        return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
      }
      return NextResponse.json({ project });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/studio/projects -- delete a project */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Project id is required" }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ ok: true });
    }

    const ok = await deleteProject(id);
    if (!ok) {
      return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
