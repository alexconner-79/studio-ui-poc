"use client";

import React, { useEffect, useState, use, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "@/lib/studio/toast";
import { DSBrandTab } from "@/components/studio/ds-workspace/ds-brand-tab";
import { DSTokensTab } from "@/components/studio/ds-workspace/ds-tokens-tab";
import { DSThemesTab } from "@/components/studio/ds-workspace/ds-themes-tab";
import { DSComponentsTab } from "@/components/studio/ds-workspace/ds-components-tab";
import { DSExportTab } from "@/components/studio/ds-workspace/ds-export-tab";
import { DSAccessibilityTab } from "@/components/studio/ds-workspace/ds-accessibility-tab";

type DesignSystem = {
  id: string;
  name: string;
  description: string | null;
  platform: "web" | "native" | "universal";
  tokens: Record<string, unknown>;
  themes: Record<string, unknown>;
  components: Record<string, unknown>;
  updated_at: string;
};

type Tab = "brand" | "tokens" | "themes" | "components" | "accessibility" | "export";

const TABS: { id: Tab; label: string }[] = [
  { id: "brand",         label: "Brand" },
  { id: "tokens",        label: "Tokens" },
  { id: "components",    label: "Components" },
  { id: "themes",        label: "Themes" },
  { id: "accessibility", label: "Accessibility" },
  { id: "export",        label: "Export" },
];

const PLATFORM_LABELS: Record<string, string> = {
  web: "Web",
  native: "Mobile (RN)",
  universal: "Universal",
};

function DSWorkspaceContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") ?? "brand") as Tab;
  const [ds, setDs] = useState<DesignSystem | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(
    TABS.some((t) => t.id === initialTab) ? initialTab : "brand"
  );
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/studio/design-systems/${id}`)
      .then((r) => r.json())
      .then((d: { designSystem?: DesignSystem; error?: string }) => {
        if (d.error || !d.designSystem) {
          toast.error(d.error ?? "Design system not found");
          router.push("/studio/ds");
          return;
        }
        setDs(d.designSystem);
        setNameValue(d.designSystem.name);
      })
      .catch(() => toast.error("Failed to load design system"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleSaveName = async () => {
    if (!ds || !nameValue.trim() || nameValue.trim() === ds.name) {
      setEditingName(false);
      setNameValue(ds?.name ?? "");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/studio/design-systems/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameValue.trim() }),
      });
      if (res.ok) {
        const data = await res.json() as { designSystem: DesignSystem };
        setDs(data.designSystem);
        setNameValue(data.designSystem.name);
        toast.success("Name updated");
      } else {
        toast.error("Failed to save name");
        setNameValue(ds.name);
      }
    } catch {
      toast.error("Failed to save name");
      setNameValue(ds?.name ?? "");
    } finally {
      setSaving(false);
      setEditingName(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${ds?.name}"? This cannot be undone.`)) return;
    await fetch(`/api/studio/design-systems/${id}`, { method: "DELETE" });
    toast.success("Design system deleted");
    router.push("/studio/ds");
  };

  const handleTokensSaved = (tokens: Record<string, unknown>) => {
    setDs((prev) => prev ? { ...prev, tokens } : prev);
  };

  const handleThemesSaved = (themes: Record<string, unknown>) => {
    setDs((prev) => prev ? { ...prev, themes } : prev);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-sm">Loading…</div>
      </div>
    );
  }

  if (!ds) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-3">
          {/* Back */}
          <Link href="/studio/ds" className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="10,3 5,8 10,13"/>
            </svg>
          </Link>
          <span className="text-muted-foreground shrink-0">/</span>
          <Link href="/studio/ds" className="text-[12px] text-muted-foreground hover:text-foreground transition-colors shrink-0">Design Systems</Link>
          <span className="text-muted-foreground shrink-0">/</span>

          {/* Editable name */}
          {editingName ? (
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") { setEditingName(false); setNameValue(ds.name); } }}
              className="text-sm font-semibold bg-transparent border-b border-[var(--s-accent)] outline-none min-w-0 w-48"
              disabled={saving}
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-sm font-semibold hover:text-[var(--s-accent)] transition-colors truncate"
              title="Click to rename"
            >
              {ds.name}
            </button>
          )}

          {/* Platform badge */}
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
            {PLATFORM_LABELS[ds.platform]}
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="text-[11px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded"
          >
            Delete
          </button>

          {/* Back to Projects link */}
          <Link
            href="/studio"
            className="text-[11px] px-3 py-1.5 rounded-md border hover:bg-accent transition-colors"
          >
            ← Projects
          </Link>
        </div>

        {/* Tab strip */}
        <div className="max-w-6xl mx-auto px-6 flex gap-0 border-t">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-[12px] font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-[var(--s-accent)] text-[var(--s-accent)]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-6 py-6">
        {activeTab === "brand" && (
          <DSBrandTab dsId={id} tokens={ds.tokens} onSaved={handleTokensSaved} />
        )}
        {activeTab === "tokens" && (
          <DSTokensTab dsId={id} platform={ds.platform} tokens={ds.tokens} onSaved={handleTokensSaved} />
        )}
        {activeTab === "themes" && (
          <DSThemesTab dsId={id} themes={ds.themes} tokens={ds.tokens} onSaved={handleThemesSaved} />
        )}
        {activeTab === "components" && (
          <DSComponentsTab dsId={id} components={ds.components} tokens={ds.tokens} />
        )}
        {activeTab === "accessibility" && (
          <DSAccessibilityTab tokens={ds.tokens} />
        )}
        {activeTab === "export" && (
          <DSExportTab dsId={id} ds={ds} />
        )}
      </div>
    </div>
  );
}

export default function DSWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-muted-foreground text-sm">Loading…</div></div>}>
      <DSWorkspaceContent params={params} />
    </Suspense>
  );
}
