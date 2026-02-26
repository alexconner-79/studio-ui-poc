"use client";

import React, { useEffect, useState } from "react";
import { toast } from "@/lib/studio/toast";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface DSStarter {
  id: string;
  name: string;
  description: string;
  platform: "web" | "native" | "universal";
  preview: string[];
  tokens: Record<string, unknown>;
  components?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Record<string, string> = {
  web: "Web",
  native: "Mobile (RN)",
  universal: "Universal",
};

const PLATFORM_COLORS: Record<string, string> = {
  web: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  native: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  universal: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

function tokenCount(tokens: Record<string, unknown>): number {
  let n = 0;
  for (const g of Object.values(tokens)) {
    if (g && typeof g === "object" && !Array.isArray(g)) n += Object.keys(g).length;
  }
  return n;
}

// ─────────────────────────────────────────────────────────────
// Preview dots
// ─────────────────────────────────────────────────────────────

function ColorDots({ colors }: { colors: string[] }) {
  return (
    <div className="flex items-center gap-1">
      {colors.slice(0, 3).map((c, i) => (
        <div
          key={i}
          className="w-4 h-4 rounded-full border border-black/10"
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Starter card
// ─────────────────────────────────────────────────────────────

function StarterCard({
  starter,
  currentPlatform,
  onApply,
  applying,
}: {
  starter: DSStarter;
  currentPlatform: "web" | "native" | "universal";
  onApply: (starter: DSStarter) => void;
  applying: string | null;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const mismatch = starter.platform !== currentPlatform;

  // Build a flat preview of token groups + first few tokens each
  const tokenPreviewGroups = Object.entries(starter.tokens).slice(0, 5).map(([group, entries]) => {
    const groupEntries = entries && typeof entries === "object" && !Array.isArray(entries)
      ? Object.entries(entries as Record<string, { value: unknown }>).slice(0, 4)
      : [];
    return { group, entries: groupEntries };
  });

  return (
    <div
      className={`rounded-xl border flex flex-col transition-all ${
        mismatch
          ? "border-border opacity-60"
          : "border-border hover:border-[var(--s-accent)]/50 hover:shadow-sm"
      }`}
    >
      <div className="p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-[12px] font-semibold truncate">{starter.name}</h3>
              {mismatch && (
                <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400 shrink-0">
                  ⚠ platform mismatch
                </span>
              )}
            </div>
            <span className={`inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full ${PLATFORM_COLORS[starter.platform]}`}>
              {PLATFORM_LABELS[starter.platform]}
            </span>
          </div>
          <ColorDots colors={starter.preview} />
        </div>

        {/* Description */}
        <p className="text-[11px] text-muted-foreground line-clamp-2 flex-1">{starter.description}</p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowPreview((p) => !p)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showPreview ? "rotate-180" : ""}`}>
              <polyline points="2,4 6,8 10,4"/>
            </svg>
            {tokenCount(starter.tokens)} tokens
            {starter.components && Object.keys(starter.components).length > 0
              ? ` · ${Object.keys(starter.components).length} components`
              : ""}
          </button>
          <button
            onClick={() => onApply(starter)}
            disabled={applying === starter.id}
            className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${
              mismatch
                ? "border border-border hover:bg-accent text-muted-foreground"
                : "bg-[var(--s-accent)] text-white hover:opacity-90"
            } disabled:opacity-50`}
            title={mismatch ? `This starter is for ${starter.platform}. Apply anyway?` : undefined}
          >
            {applying === starter.id ? "Applying…" : "Use this starter"}
          </button>
        </div>
      </div>

      {/* Expandable token preview */}
      {showPreview && (
        <div className="border-t px-4 py-3 space-y-2 bg-muted/20">
          {tokenPreviewGroups.map(({ group, entries }) => (
            <div key={group}>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{group}</p>
              <div className="flex flex-wrap gap-1.5">
                {entries.map(([key, entry]) => {
                  const val = typeof entry?.value === "object" ? String((entry.value as { web: string }).web ?? "") : String(entry?.value ?? "");
                  const isCol = val.startsWith("#") || val.startsWith("rgb") || val.startsWith("hsl");
                  return (
                    <div key={key} className="flex items-center gap-1" title={`${key}: ${val}`}>
                      {isCol && <div className="w-3.5 h-3.5 rounded border border-black/10 shrink-0" style={{ background: val }} />}
                      <span className="text-[9px] font-mono text-muted-foreground">{key}</span>
                    </div>
                  );
                })}
                {Object.keys(starter.tokens[group] as Record<string, unknown>).length > 4 && (
                  <span className="text-[9px] text-muted-foreground/60">+{Object.keys(starter.tokens[group] as Record<string, unknown>).length - 4} more</span>
                )}
              </div>
            </div>
          ))}
          {Object.keys(starter.tokens).length > 5 && (
            <p className="text-[9px] text-muted-foreground/60">…and {Object.keys(starter.tokens).length - 5} more groups</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export function DSStarterPicker({
  dsId,
  currentPlatform,
  onApplied,
}: {
  dsId: string;
  currentPlatform: "web" | "native" | "universal";
  onApplied: (tokens: Record<string, unknown>, components?: Record<string, unknown>) => void;
}) {
  const [starters, setStarters] = useState<DSStarter[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "web" | "native" | "universal">("all");

  useEffect(() => {
    fetch("/api/studio/ds-starters")
      .then((r) => r.json())
      .then((d: { starters?: DSStarter[] }) => setStarters(d.starters ?? []))
      .catch(() => toast.error("Failed to load starters"))
      .finally(() => setLoading(false));
  }, []);

  const handleApply = async (starter: DSStarter) => {
    setApplying(starter.id);
    try {
      const payload: Record<string, unknown> = { tokens: starter.tokens };
      if (starter.components && Object.keys(starter.components).length > 0) {
        payload.components = starter.components;
      }
      const res = await fetch(`/api/studio/design-systems/${dsId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const componentCount = starter.components ? Object.keys(starter.components).length : 0;
        toast.success(
          componentCount > 0
            ? `Applied "${starter.name}" — ${tokenCount(starter.tokens)} tokens + ${componentCount} components`
            : `Applied "${starter.name}" starter`
        );
        onApplied(starter.tokens, starter.components);
      } else {
        toast.error("Failed to apply starter");
      }
    } catch {
      toast.error("Failed to apply starter");
    } finally {
      setApplying(null);
    }
  };

  const visibleStarters =
    filter === "all" ? starters : starters.filter((s) => s.platform === filter);

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-sm font-semibold">Start from a boilerplate</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Pick a starter to pre-populate your token set. You can edit every token after applying.
          Your DS platform is <strong>{PLATFORM_LABELS[currentPlatform]}</strong> — starters matching your platform are highlighted.
        </p>
      </div>

      {/* Platform filter */}
      <div className="flex items-center gap-1 mb-4">
        {(["all", "web", "native", "universal"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`px-3 py-1 text-[11px] rounded-full border transition-colors ${
              filter === p
                ? "border-[var(--s-accent)] bg-[var(--s-accent)]/10 text-[var(--s-accent)]"
                : "border-border hover:bg-accent text-muted-foreground"
            }`}
          >
            {p === "all" ? "All" : PLATFORM_LABELS[p]}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {visibleStarters.length} starter{visibleStarters.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 rounded-xl border bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : visibleStarters.length === 0 ? (
        <div className="text-center py-8 text-[12px] text-muted-foreground">
          No starters for this platform.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {visibleStarters.map((starter) => (
            <StarterCard
              key={starter.id}
              starter={starter}
              currentPlatform={currentPlatform}
              onApply={handleApply}
              applying={applying}
            />
          ))}
        </div>
      )}

      {/* Skip */}
      <div className="mt-5 pt-4 border-t">
        <p className="text-[11px] text-muted-foreground text-center">
          Want to start from scratch instead?{" "}
          <button
            onClick={() => onApplied({})}
            className="text-[var(--s-accent)] hover:opacity-80 font-medium"
          >
            Add tokens manually
          </button>
        </p>
      </div>
    </div>
  );
}
