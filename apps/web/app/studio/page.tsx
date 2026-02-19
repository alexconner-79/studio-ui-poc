"use client";

import React, { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ImportScreenModal } from "@/components/studio/import-screen-modal";
import { ExportModal } from "@/components/studio/export-modal";
import { ScreenListSkeleton, InlineError } from "@/components/studio/loading-skeleton";
import { createClient } from "@/lib/supabase/client";

type ScreenEntry = {
  name: string;
  fileName: string;
  spec: { route: string; meta?: { layout?: string; auth?: string } };
};

type PageTemplate = {
  name: string;
  description: string;
  preview?: string;
  spec: Record<string, unknown>;
};

type Project = {
  id: string;
  name: string;
  slug: string;
  framework: string;
  created_at: string;
  updated_at: string;
};

const isSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
      <StudioContent />
    </Suspense>
  );
}

function StudioContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project");

  if (isSupabase && !projectId) {
    return <ProjectListView />;
  }

  return <ScreenListView projectId={projectId} />;
}

// ---------------------------------------------------------------------------
// Project List View (Supabase mode, no project selected)
// ---------------------------------------------------------------------------

function ProjectListView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const loadProjects = useCallback(() => {
    setError(null);
    fetch("/api/studio/projects")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load projects");
        return r.json();
      })
      .then((data) => {
        setProjects(data.projects ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/studio/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/studio?project=${data.project.id}`);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create project");
      }
    } finally {
      setCreating(false);
      setNewName("");
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Studio</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Select a project or create a new one
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Admin
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-8">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New project name (e.g. My App)"
            className="flex-1 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating..." : "Create Project"}
          </button>
        </div>

        {error ? (
          <InlineError message={error} onRetry={loadProjects} />
        ) : loading ? (
          <ScreenListSkeleton />
        ) : projects.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <p className="text-lg mb-2">No projects yet</p>
            <p className="text-sm">Create your first project above to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/studio?project=${project.id}`}
                className="group block p-5 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
              >
                <div className="font-semibold text-lg group-hover:text-blue-600 transition-colors">
                  {project.name}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {project.slug}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs px-2 py-0.5 bg-accent rounded-full">
                    {project.framework}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Updated {new Date(project.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen List View (project selected or filesystem mode)
// ---------------------------------------------------------------------------

function ScreenListView({ projectId }: { projectId: string | null }) {
  const [screens, setScreens] = useState<ScreenEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const screenLink = (name: string) =>
    projectId ? `/studio/${name}?project=${projectId}` : `/studio/${name}`;

  const loadScreens = useCallback(() => {
    setError(null);
    const url = projectId
      ? `/api/studio/screens?projectId=${projectId}`
      : "/api/studio/screens";
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load screens");
        return r.json();
      })
      .then((data) => {
        setScreens(data.screens ?? []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [projectId]);

  useEffect(() => {
    loadScreens();
    fetch("/api/studio/page-templates")
      .then((r) => r.json())
      .then((data) => {
        if (data.templates) setTemplates(data.templates);
      })
      .catch(() => {});

    if (projectId) {
      fetch(`/api/studio/projects`)
        .then((r) => r.json())
        .then((data) => {
          const p = (data.projects ?? []).find((p: Project) => p.id === projectId);
          if (p) setProjectName(p.name);
        })
        .catch(() => {});
    }
  }, [loadScreens, projectId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const safeName = newName
        .trim()
        .toLowerCase()
        .replace(/[_\s]+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/^-+|-+$/g, "");
      if (!safeName) {
        alert("Invalid screen name. Use letters, numbers, and hyphens.");
        return;
      }
      const body: Record<string, unknown> = { name: safeName };
      if (projectId) body.projectId = projectId;
      const res = await fetch("/api/studio/screens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(screenLink(data.name));
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create screen");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleCreateFromTemplate = async (template: PageTemplate) => {
    const name = window.prompt("Screen name:", template.name.toLowerCase().replace(/\s+/g, "-"));
    if (!name || !name.trim()) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = { name: name.trim(), spec: template.spec };
      if (projectId) body.projectId = projectId;
      const res = await fetch("/api/studio/screens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(screenLink(data.name));
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create screen");
      }
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">
              {projectName ? projectName : "Studio"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {projectName ? "Screens in this project" : "Visual editor for screen specs"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            {isSupabase && projectId && (
              <Link
                href="/studio"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                &larr; Projects
              </Link>
            )}
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Admin
            </Link>
            {isSupabase ? (
              <button
                onClick={handleLogout}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            ) : (
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                &larr; Back to app
              </Link>
            )}
          </div>
        </div>

        {/* Create new screen */}
        <div className="flex items-center gap-2 mb-6">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New screen name (e.g. checkout)"
            className="flex-1 px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
            }}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating..." : "Create Screen"}
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
          >
            Import
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="px-4 py-2 text-sm border rounded-md hover:bg-accent transition-colors"
          >
            Export
          </button>
        </div>

        {/* Template gallery toggle */}
        {templates.length > 0 && (
          <div className="mb-8">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              <span className="text-[10px]">{showTemplates ? "▾" : "▸"}</span>
              Start from Template ({templates.length})
            </button>

            {showTemplates && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map((template) => (
                  <button
                    key={template.name}
                    onClick={() => handleCreateFromTemplate(template)}
                    disabled={creating}
                    className="text-left p-4 border-2 border-dashed rounded-lg hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all disabled:opacity-50 group"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-medium group-hover:text-blue-600 transition-colors">
                        {template.name}
                      </div>
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground bg-accent px-1.5 py-0.5 rounded">
                        Template
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {template.description}
                    </div>
                    {template.preview && (
                      <div className="text-xs text-muted-foreground/70 mt-2 italic">
                        {template.preview}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Screen grid */}
        {error ? (
          <InlineError message={error} onRetry={loadScreens} />
        ) : loading ? (
          <ScreenListSkeleton />
        ) : screens.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
            <p className="text-lg mb-2">No screens yet</p>
            <p className="text-sm">
              Create your first screen above or start from a template
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {screens.map((screen) => (
              <Link
                key={screen.name}
                href={screenLink(screen.name)}
                className="group block p-4 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
              >
                <div className="font-medium group-hover:text-blue-600 transition-colors">
                  {screen.name}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {screen.spec.route}
                </div>
                {screen.spec.meta && (
                  <div className="flex gap-2 mt-2">
                    {screen.spec.meta.layout && (
                      <span className="text-xs px-1.5 py-0.5 bg-accent rounded">
                        {screen.spec.meta.layout}
                      </span>
                    )}
                    {screen.spec.meta.auth && (
                      <span className="text-xs px-1.5 py-0.5 bg-accent rounded">
                        {screen.spec.meta.auth}
                      </span>
                    )}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {showImport && (
        <ImportScreenModal
          onClose={() => setShowImport(false)}
          onImported={loadScreens}
          projectId={projectId}
        />
      )}

      {showExport && (
        <ExportModal onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
