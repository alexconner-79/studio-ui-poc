"use client";

import React, { useEffect, useState, useCallback, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ImportScreenModal } from "@/components/studio/import-screen-modal";
import { ExportModal } from "@/components/studio/export-modal";
import { ImportTokensModal } from "@/components/studio/import-tokens-modal";
import { ScreenListSkeleton, InlineError } from "@/components/studio/loading-skeleton";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/lib/studio/toast";
import { WelcomeModal, type ProjectSetupResult } from "@/components/studio/onboarding/welcome-modal";

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

const FRAMEWORKS = [
  { key: "nextjs", label: "Next.js" },
  { key: "vue", label: "Vue" },
  { key: "svelte", label: "Svelte" },
  { key: "html", label: "HTML / CSS" },
  { key: "expo", label: "Expo (React Native)" },
] as const;

const FRAMEWORK_LABELS: Record<string, string> = {
  nextjs: "Next.js",
  vue: "Vue",
  svelte: "Svelte",
  html: "HTML/CSS",
  expo: "Expo (RN)",
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

  if (isSupabase && projectId) {
    return <ProjectEntrypoint projectId={projectId} />;
  }

  return <ScreenListView projectId={projectId} />;
}

// ---------------------------------------------------------------------------
// Project Entrypoint — redirects straight into the editor with the first
// screen, auto-creating a "home" screen if the project is empty.
// ---------------------------------------------------------------------------

function ProjectEntrypoint({ projectId }: { projectId: string }) {
  const router = useRouter();

  React.useEffect(() => {
    let cancelled = false;

    async function enter() {
      try {
        const res = await fetch(`/api/studio/screens?projectId=${encodeURIComponent(projectId)}`);
        const data = await res.json() as { screens?: { name: string }[] };
        const screens = data.screens ?? [];

        if (cancelled) return;

        if (screens.length > 0) {
          router.replace(`/studio/${screens[0].name}?project=${projectId}`);
          return;
        }

        // No screens yet — create a default "home" screen
        const createRes = await fetch("/api/studio/screens", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "home", projectId }),
        });

        if (cancelled) return;

        if (createRes.ok) {
          router.replace(`/studio/home?project=${projectId}`);
        } else {
          // Fallback: open editor without a specific screen
          router.replace(`/studio/home?project=${projectId}`);
        }
      } catch {
        if (!cancelled) router.replace(`/studio/home?project=${projectId}`);
      }
    }

    void enter();
    return () => { cancelled = true; };
  }, [projectId, router]);

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: "repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(0,0,0,0.04) 24px, rgba(0,0,0,0.04) 25px), repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(0,0,0,0.04) 24px, rgba(0,0,0,0.04) 25px), #1a1a2e",
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
        <span className="text-white/40 text-sm">Opening project…</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal Shell
// ---------------------------------------------------------------------------

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-background border rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Project Modal
// ---------------------------------------------------------------------------

function CreateProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [framework, setFramework] = useState("nextjs");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/studio/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), framework, description: description.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        onCreated(data.project);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create project");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold mb-4">Create Project</h2>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Project name</label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My App"
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short description of the project"
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Framework</label>
              <div className="grid grid-cols-4 gap-2">
                {FRAMEWORKS.map((fw) => (
                  <button
                    key={fw.key}
                    type="button"
                    onClick={() => setFramework(fw.key)}
                    className={`px-3 py-2 text-sm border rounded-md transition-all ${
                      framework === fw.key
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-medium"
                        : "hover:border-zinc-400 text-muted-foreground"
                    }`}
                  >
                    {fw.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-zinc-50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating..." : "Create Project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Create Screen Modal
// ---------------------------------------------------------------------------

function CreateScreenModal({
  projectId,
  templates,
  onClose,
  onCreated,
}: {
  projectId: string | null;
  templates: PageTemplate[];
  onClose: () => void;
  onCreated: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<PageTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const safeName = name
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!safeName) return;
    setLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = { name: safeName };
      if (projectId) body.projectId = projectId;
      if (selectedTemplate) body.spec = selectedTemplate.spec;
      const res = await fetch("/api/studio/screens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        onCreated(data.name);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create screen");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold mb-4">Create Screen</h2>

          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Screen name</label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="checkout"
                className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              {safeName && safeName !== name.trim() && (
                <p className="text-xs text-muted-foreground mt-1">
                  Will be created as: <code className="font-mono">{safeName}</code> &rarr; <code className="font-mono">/{safeName}</code>
                </p>
              )}
            </div>

            {templates.length > 0 && (
              <div>
                <label className="block text-sm font-medium mb-2">Start from template <span className="text-muted-foreground font-normal">(optional)</span></label>
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() => setSelectedTemplate(null)}
                    className={`text-left p-3 border rounded-md transition-all text-sm ${
                      !selectedTemplate
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                        : "hover:border-zinc-400"
                    }`}
                  >
                    <div className="font-medium">Blank</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Empty screen with a heading</div>
                  </button>
                  {templates.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => {
                        setSelectedTemplate(t);
                        if (!name.trim()) {
                          setName(t.name.toLowerCase().replace(/\s+/g, "-"));
                        }
                      }}
                      className={`text-left p-3 border rounded-md transition-all text-sm ${
                        selectedTemplate?.name === t.name
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                          : "hover:border-zinc-400"
                      }`}
                    >
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-zinc-50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-md hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !safeName}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-accent transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Screen"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Confirm Delete Modal
// ---------------------------------------------------------------------------

function ConfirmDeleteModal({
  title,
  message,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-lg font-semibold mb-2">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <div className="flex items-center justify-end gap-2 px-6 py-4 border-t bg-zinc-50 dark:bg-zinc-900/50">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-md hover:bg-accent transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Deleting..." : "Delete"}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Context Menu (for project/screen cards)
// ---------------------------------------------------------------------------

function CardContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: { label: string; danger?: boolean; onClick: () => void }[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[140px] bg-background border rounded-lg shadow-xl py-1"
      style={{ left: x, top: y }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`block w-full text-left px-3 py-1.5 text-sm transition-colors ${
            item.danger
              ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              : "hover:bg-accent"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project List View (Supabase mode, no project selected)
// ---------------------------------------------------------------------------

function ProjectListView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; project: Project } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
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

  const handleDelete = async (project: Project) => {
    await fetch(`/api/studio/projects?id=${project.id}`, { method: "DELETE" });
    loadProjects();
  };

  const handleRenameSubmit = useCallback(async (projectId: string, newName: string) => {
    const trimmed = newName.trim();
    setRenaming(null);
    if (!trimmed) return;
    try {
      await fetch(`/api/studio/projects?id=${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      loadProjects();
    } catch {
      // silently fail -- project list will still show old name until refresh
    }
  }, [loadProjects]);

  const handleWizardComplete = useCallback(async (result: ProjectSetupResult) => {
    setCreating(true);
    try {
      // 1. Create the project
      const projectRes = await fetch("/api/studio/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: result.projectName, framework: result.framework }),
      });
      if (!projectRes.ok) throw new Error("Failed to create project");
      const { project } = await projectRes.json() as { project: Project };

      // 2. Optionally create and link a Design System
      if (result.dsChoice === "link" && result.linkedDsId) {
        // Link to an existing DS — no creation needed
        await fetch(`/api/studio/projects?id=${project.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ design_system_id: result.linkedDsId }),
        });
      } else if (result.dsChoice !== "skip" && result.dsChoice !== "link") {
        const platform = result.framework === "expo" ? "native" : "web";
        const dsRes = await fetch("/api/studio/design-systems", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: `${result.projectName} Design System`,
            platform,
            tokens: result.brandTokens ?? {},
          }),
        });
        if (dsRes.ok) {
          const { designSystem } = await dsRes.json() as { designSystem: { id: string } };
          await fetch(`/api/studio/projects?id=${project.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ design_system_id: designSystem.id }),
          });
        }
      }

      // 3. Store GitHub PAT locally if provided
      if (result.githubRepo) {
        try {
          const key = `studio-project-settings-${project.id}`;
          const existing = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>;
          localStorage.setItem(key, JSON.stringify({ ...existing, githubPat: result.githubRepo }));
        } catch { /* ignore */ }
      }

      // 4. Navigate into the project
      router.push(`/studio?project=${project.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setCreating(false);
    }
  }, [router]);

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
              href="/studio/ds"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Design Systems
            </Link>
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

        <div className="flex items-center justify-between mb-6">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Projects</h2>
          <button
            onClick={() => setShowWizard(true)}
            disabled={creating}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-60"
          >
            {creating ? "Creating…" : "+ New Project"}
          </button>
        </div>

        {error ? (
          <InlineError message={error} onRetry={loadProjects} />
        ) : loading ? (
          <ScreenListSkeleton />
        ) : projects.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground border-2 border-dashed rounded-lg">
            <div className="text-4xl mb-3 opacity-30">📁</div>
            <p className="text-lg mb-2">No projects yet</p>
            <p className="text-sm mb-4">Create your first project to get started</p>
            <button
              onClick={() => setShowWizard(true)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative block p-5 border rounded-lg hover:border-blue-500 hover:shadow-md transition-all cursor-pointer"
                onClick={() => router.push(`/studio?project=${project.id}`)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, project });
                }}
              >
                {renaming === project.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRenameSubmit(project.id, renameValue)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") handleRenameSubmit(project.id, renameValue);
                      if (e.key === "Escape") setRenaming(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="font-semibold text-lg w-full px-1 py-0.5 -mx-1 border rounded bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ) : (
                  <div className="font-semibold text-lg group-hover:text-blue-600 transition-colors">
                    {project.name}
                  </div>
                )}
                <div className="text-sm text-muted-foreground mt-1">
                  {project.slug}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs px-2 py-0.5 bg-accent rounded-full">
                    {FRAMEWORK_LABELS[project.framework] ?? project.framework}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Updated {new Date(project.updated_at).toLocaleDateString()}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setContextMenu({ x: e.clientX, y: e.clientY, project });
                  }}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent transition-all text-muted-foreground"
                  title="Actions"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="8" cy="3" r="1.5" />
                    <circle cx="8" cy="8" r="1.5" />
                    <circle cx="8" cy="13" r="1.5" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showWizard && (
        <WelcomeModal
          onDismiss={() => setShowWizard(false)}
          onComplete={handleWizardComplete}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title={`Delete "${deleteTarget.name}"?`}
          message="This will permanently delete the project and all its screens. This action cannot be undone."
          onConfirm={() => handleDelete(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {contextMenu && (
        <CardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: "Rename",
              onClick: () => {
                setRenaming(contextMenu.project.id);
                setRenameValue(contextMenu.project.name);
              },
            },
            {
              label: "Delete",
              danger: true,
              onClick: () => setDeleteTarget(contextMenu.project),
            },
          ]}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Screen List View (project selected or filesystem mode)
// ---------------------------------------------------------------------------

type SortKey = "name" | "route" | "updated";
type ViewMode = "grid" | "list";

function ScreenListView({ projectId }: { projectId: string | null }) {
  const [screens, setScreens] = useState<ScreenEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [showCreateScreen, setShowCreateScreen] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showDesignSystem, setShowDesignSystem] = useState(false);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScreenEntry | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; screen: ScreenEntry } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [groupByLayout, setGroupByLayout] = useState(false);
  const router = useRouter();

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
      .catch(() => { toast.error("Failed to load page templates"); });

    if (projectId) {
      fetch(`/api/studio/projects`)
        .then((r) => r.json())
        .then((data) => {
          const p = (data.projects ?? []).find((p: Project) => p.id === projectId);
          if (p) setProjectName(p.name);
        })
        .catch(() => { toast.error("Failed to load project"); });
    }
  }, [loadScreens, projectId]);

  const handleDeleteScreen = async (screen: ScreenEntry) => {
    const url = projectId
      ? `/api/studio/screens/${screen.name}?projectId=${projectId}`
      : `/api/studio/screens/${screen.name}`;
    await fetch(url, { method: "DELETE" });
    loadScreens();
  };

  const handleDuplicateScreen = async (screen: ScreenEntry) => {
    const newName = `${screen.name}-copy`;
    const body: Record<string, unknown> = {
      name: newName,
      spec: screen.spec,
    };
    if (projectId) body.projectId = projectId;
      const res = await fetch("/api/studio/screens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      });
      if (res.ok) {
      loadScreens();
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  // Filtered + sorted screens
  const filteredScreens = screens
    .filter((s) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.spec.route.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      switch (sortKey) {
        case "route": return a.spec.route.localeCompare(b.spec.route);
        case "name": default: return a.name.localeCompare(b.name);
      }
    });

  // Group by layout if enabled
  const grouped = groupByLayout
    ? filteredScreens.reduce<Record<string, ScreenEntry[]>>((acc, s) => {
        const key = s.spec.meta?.layout || "Ungrouped";
        (acc[key] ??= []).push(s);
        return acc;
      }, {})
    : { "": filteredScreens };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {isSupabase && projectId && (
            <Link href="/studio" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polyline points="10,3 5,8 10,13"/></svg>
              Projects
            </Link>
          )}
          {isSupabase && projectId && <span className="text-muted-foreground/40 text-sm">/</span>}
          <h1 className="text-sm font-semibold">{projectName ?? "Studio"}</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search…"
              className="pl-7 pr-3 py-1.5 text-[12px] border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-blue-500 w-40"
            />
          </div>
          <button onClick={() => setShowImport(true)} className="px-3 py-1.5 text-[12px] border rounded-md hover:bg-accent transition-colors text-muted-foreground">Import</button>
          <button onClick={() => setShowExport(true)} className="px-3 py-1.5 text-[12px] border rounded-md hover:bg-accent transition-colors text-muted-foreground">Export</button>
          <button
            onClick={() => setShowCreateScreen(true)}
            className="px-3 py-1.5 text-[12px] bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            + New Screen
          </button>
          {isSupabase ? (
            <button onClick={handleLogout} className="text-[12px] text-muted-foreground hover:text-foreground ml-2">Sign out</button>
          ) : (
            <Link href="/" className="text-[12px] text-muted-foreground hover:text-foreground ml-2">← Back</Link>
          )}
        </div>
      </div>

      {/* Artboard canvas */}
      <div
        className="flex-1 overflow-auto"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 24px, rgba(0,0,0,0.04) 24px, rgba(0,0,0,0.04) 25px), repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(0,0,0,0.04) 24px, rgba(0,0,0,0.04) 25px), #1a1a2e",
        }}
      >
        {error ? (
          <div className="flex items-center justify-center h-full">
            <InlineError message={error} onRetry={loadScreens} />
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-pulse text-white/40 text-sm">Loading screens…</div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-10 p-16 items-start">
            {filteredScreens.map((screen) => (
              <div
                key={screen.name}
                className="group flex flex-col items-center cursor-default"
                onClick={() => router.push(screenLink(screen.name))}
                onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, screen }); }}
              >
                {/* Artboard frame */}
                <div
                  className="relative bg-white shadow-2xl transition-all duration-150 group-hover:shadow-[0_0_0_2px_#3b82f6,0_20px_40px_rgba(0,0,0,0.5)] cursor-pointer"
                  style={{ width: 220, height: 154, borderRadius: 2 }}
                >
                  {/* Route hint inside frame */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 opacity-30 select-none">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
                    <span className="text-[9px] font-mono text-slate-400">{screen.spec.route}</span>
                  </div>
                  {/* Meta badges */}
                  {(screen.spec.meta?.layout || screen.spec.meta?.auth) && (
                    <div className="absolute bottom-2 left-2 flex gap-1">
                      {screen.spec.meta.layout && <span className="text-[8px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">{screen.spec.meta.layout}</span>}
                      {screen.spec.meta.auth && <span className="text-[8px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded font-medium">{screen.spec.meta.auth}</span>}
                    </div>
                  )}
                  {/* Context menu trigger */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, screen }); }}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded bg-white/80 hover:bg-white shadow-sm transition-all"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="#64748b"><circle cx="8" cy="3" r="1.5"/><circle cx="8" cy="8" r="1.5"/><circle cx="8" cy="13" r="1.5"/></svg>
                  </button>
                </div>
                {/* Artboard label */}
                <div className="mt-2.5 text-center">
                  <div className="text-[11px] font-medium text-white/80 group-hover:text-blue-400 transition-colors">{screen.name}</div>
                </div>
              </div>
            ))}

            {/* New screen artboard */}
            <div
              className="flex flex-col items-center cursor-pointer group"
              onClick={() => setShowCreateScreen(true)}
            >
              <div
                className="flex items-center justify-center transition-all duration-150 group-hover:border-blue-500 group-hover:bg-blue-500/5"
                style={{
                  width: 220,
                  height: 154,
                  borderRadius: 2,
                  border: "1.5px dashed rgba(255,255,255,0.2)",
                }}
              >
                <div className="flex flex-col items-center gap-2 text-white/30 group-hover:text-blue-400 transition-colors">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span className="text-[10px] font-medium">New Screen</span>
                </div>
              </div>
              <div className="mt-2.5">
                <div className="text-[11px] font-medium text-white/30 group-hover:text-blue-400 transition-colors">Add screen</div>
              </div>
            </div>

            {filteredScreens.length === 0 && !loading && searchQuery && (
              <div className="text-white/40 text-sm self-center mx-auto">
                No screens match &ldquo;{searchQuery}&rdquo;
              </div>
            )}
          </div>
        )}
      </div>

      {showCreateScreen && (
        <CreateScreenModal
          projectId={projectId}
          templates={templates}
          onClose={() => setShowCreateScreen(false)}
          onCreated={(name) => {
            setShowCreateScreen(false);
            router.push(screenLink(name));
          }}
        />
      )}

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

      {showDesignSystem && (
        <ImportTokensModal onClose={() => setShowDesignSystem(false)} />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          title={`Delete "${deleteTarget.name}"?`}
          message="This will permanently delete the screen and all its version history. This action cannot be undone."
          onConfirm={() => handleDeleteScreen(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {contextMenu && (
        <CardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: "Duplicate",
              onClick: () => handleDuplicateScreen(contextMenu.screen),
            },
            {
              label: "Delete",
              danger: true,
              onClick: () => setDeleteTarget(contextMenu.screen),
            },
          ]}
        />
      )}
    </div>
  );
}
