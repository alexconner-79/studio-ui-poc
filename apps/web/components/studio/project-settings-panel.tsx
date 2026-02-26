"use client";

import React, { useState, useEffect } from "react";
import { toast } from "@/lib/studio/toast";
import { useEditorStore } from "@/lib/studio/store";

interface ProjectSettings {
  githubPat?: string;
  githubRepo?: string;
  githubBranch?: string;
  linkedDsId?: string;
  linkedDsName?: string;
  linkedDsPlatform?: "web" | "native" | "universal";
}

type DSOption = {
  id: string;
  name: string;
  platform: "web" | "native" | "universal";
};

export function ProjectSettingsPanel({
  projectId,
  onClose,
  onSettingsChange,
}: {
  projectId?: string | null;
  onClose: () => void;
  onSettingsChange?: (settings: ProjectSettings) => void;
}) {
  const storageKey = `studio-project-settings-${projectId ?? "default"}`;
  const [settings, setSettings] = useState<ProjectSettings>({});
  const [saving, setSaving] = useState(false);
  const [dsSystems, setDsSystems] = useState<DSOption[]>([]);
  const [dsLoading, setDsLoading] = useState(false);
  const loadDesignTokens = useEditorStore((s) => s.loadDesignTokens);

  // Load from localStorage first (fast), then reconcile with DB truth
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setSettings(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [storageKey]);

  // Fetch current design_system_id from DB and pre-populate if localStorage is stale/missing
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/studio/projects?id=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then((d: { project?: { design_system_id?: string | null } }) => {
        const dbDsId = d.project?.design_system_id;
        if (!dbDsId) return;
        setSettings((s) => {
          // Only update if localStorage didn't already have a value — DB is the source of truth
          if (s.linkedDsId) return s;
          return { ...s, linkedDsId: dbDsId };
        });
      })
      .catch(() => { /* non-critical */ });
  }, [projectId]);

  useEffect(() => {
    setDsLoading(true);
    fetch("/api/studio/design-systems")
      .then((r) => r.json())
      .then((d: { designSystems?: DSOption[] }) => setDsSystems(d.designSystems ?? []))
      .catch(() => { /* no-op: DS link is non-critical */ })
      .finally(() => setDsLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
      onSettingsChange?.(settings);

      // Persist DS link to Supabase if we have a projectId
      if (projectId) {
        await fetch(`/api/studio/projects?id=${encodeURIComponent(projectId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ design_system_id: settings.linkedDsId ?? null }),
        });
      }

      // Reload tokens immediately so the editor reflects the newly linked DS
      await loadDesignTokens();
      toast.success("Project settings saved");
      onClose();
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = () => {
    const next = { ...settings, githubPat: undefined, githubRepo: undefined, githubBranch: undefined };
    setSettings(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    onSettingsChange?.(next);
    toast.success("GitHub disconnected");
  };

  const isConnected = !!settings.githubPat;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-background border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-sm font-semibold">Project Settings</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Configure GitHub and project preferences</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">×</button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-5">
          {/* GitHub section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-foreground">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
              <h3 className="text-[12px] font-semibold">GitHub Connection</h3>
              {isConnected && (
                <span className="ml-auto text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">Connected</span>
              )}
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                  Personal Access Token
                </label>
                <input
                  type="password"
                  value={settings.githubPat ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, githubPat: e.target.value }))}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="w-full px-3 py-2 text-[12px] bg-muted/40 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Requires <code className="bg-muted px-1 rounded">repo</code> scope.
                  Generate at <span className="text-blue-500">github.com/settings/tokens</span>
                </p>
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                  Repository <span className="font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={settings.githubRepo ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, githubRepo: e.target.value }))}
                  placeholder="owner/repo-name"
                  className="w-full px-3 py-2 text-[12px] bg-muted/40 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                  Branch <span className="font-normal">(default: main)</span>
                </label>
                <input
                  type="text"
                  value={settings.githubBranch ?? ""}
                  onChange={(e) => setSettings((s) => ({ ...s, githubBranch: e.target.value }))}
                  placeholder="main"
                  className="w-full px-3 py-2 text-[12px] bg-muted/40 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {isConnected && (
              <button
                onClick={handleDisconnect}
                className="text-[11px] text-red-500 hover:text-red-700 transition-colors"
              >
                Disconnect GitHub
              </button>
            )}
          </div>

          {/* Design System link */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-foreground">
                <circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.42 1.42M11.36 11.36l1.42 1.42M3.22 12.78l1.42-1.42M11.36 4.64l1.42-1.42"/>
              </svg>
              <h3 className="text-[12px] font-semibold">Design System</h3>
              {settings.linkedDsId && (
                <span className="ml-auto text-[10px] bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full font-medium">Linked</span>
              )}
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Linked Design System</label>
              {dsLoading ? (
                <div className="text-[11px] text-muted-foreground">Loading…</div>
              ) : dsSystems.length === 0 ? (
                <div className="text-[11px] text-muted-foreground">
                  No design systems found.{" "}
                  <a href="/studio/ds" target="_blank" className="text-blue-500 hover:underline">Create one</a>
                </div>
              ) : (
                <select
                  value={settings.linkedDsId ?? ""}
                  onChange={(e) => {
                    const selected = dsSystems.find((d) => d.id === e.target.value);
                    setSettings((s) => ({
                      ...s,
                      linkedDsId: selected?.id ?? undefined,
                      linkedDsName: selected?.name ?? undefined,
                      linkedDsPlatform: selected?.platform ?? undefined,
                    }));
                  }}
                  className="w-full px-3 py-2 text-[12px] bg-muted/40 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">— None —</option>
                  {dsSystems.map((ds) => (
                    <option key={ds.id} value={ds.id}>{ds.name} ({ds.platform})</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t bg-muted/20">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[12px] rounded-md hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-[12px] bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
