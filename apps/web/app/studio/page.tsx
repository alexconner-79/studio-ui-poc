"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImportScreenModal } from "@/components/studio/import-screen-modal";
import { ExportModal } from "@/components/studio/export-modal";
import { ScreenListSkeleton, InlineError } from "@/components/studio/loading-skeleton";

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

export default function StudioScreenList() {
  const [screens, setScreens] = useState<ScreenEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState<PageTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);

  const loadScreens = useCallback(() => {
    setError(null);
    fetch("/api/studio/screens")
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
  }, []);

  useEffect(() => {
    loadScreens();
    fetch("/api/studio/page-templates")
      .then((r) => r.json())
      .then((data) => {
        if (data.templates) setTemplates(data.templates);
      })
      .catch(() => {});
  }, [loadScreens]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      // Sanitize: lowercase, replace spaces/underscores with hyphens, strip invalid chars
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
      const res = await fetch("/api/studio/screens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: safeName }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/studio/${data.name}`);
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
      const res = await fetch("/api/studio/screens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), spec: template.spec }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/studio/${data.name}`);
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create screen");
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Studio</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visual editor for screen specs
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Admin
            </Link>
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              &larr; Back to app
            </Link>
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
                href={`/studio/${screen.name}`}
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

      {/* Import modal */}
      {showImport && (
        <ImportScreenModal
          onClose={() => setShowImport(false)}
          onImported={loadScreens}
        />
      )}

      {/* Export modal */}
      {showExport && (
        <ExportModal onClose={() => setShowExport(false)} />
      )}
    </div>
  );
}
