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
  category?: string;
  inheritsComponents?: string;
  preview: string[];
  tokens: Record<string, unknown>;
  components?: Record<string, unknown>;
  packageName?: string;
  packageNameNative?: string;
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
  native:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  universal:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

function tokenCount(tokens: Record<string, unknown>): number {
  let n = 0;
  for (const g of Object.values(tokens)) {
    if (g && typeof g === "object" && !Array.isArray(g))
      n += Object.keys(g).length;
  }
  return n;
}

function componentCount(components?: Record<string, unknown>): number {
  return components ? Object.keys(components).length : 0;
}

// ─────────────────────────────────────────────────────────────
// Preview swatch row
// ─────────────────────────────────────────────────────────────

function ColorDots({ colors }: { colors: string[] }) {
  return (
    <div className="flex items-center gap-1.5">
      {colors.slice(0, 3).map((c, i) => (
        <div
          key={i}
          className="w-5 h-5 rounded-full border border-black/10"
          style={{ background: c }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Boilerplate card (larger, richer)
// ─────────────────────────────────────────────────────────────

function BoilerplateCard({
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
  const mismatch = starter.platform !== currentPlatform;
  const isApplying = applying === starter.id;

  // Color token preview — first 5 colors from the color group
  const colorEntries = Object.entries(
    (starter.tokens.color ?? {}) as Record<string, { value: string }>
  ).slice(0, 5);

  return (
    <div
      className={`rounded-xl border flex flex-col transition-all cursor-pointer group ${
        mismatch
          ? "border-border opacity-60"
          : "border-border hover:border-[var(--s-accent)]/60 hover:shadow-md"
      }`}
    >
      {/* Colour bar at top */}
      <div className="h-2 rounded-t-xl overflow-hidden flex">
        {colorEntries.map(([key, entry]) => (
          <div
            key={key}
            className="flex-1 h-full"
            style={{ background: String(entry?.value ?? "#e5e7eb") }}
            title={key}
          />
        ))}
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-[13px] font-semibold truncate">
                {starter.name}
              </h3>
              {mismatch && (
                <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400 shrink-0">
                  ⚠ platform mismatch
                </span>
              )}
            </div>
            <span
              className={`inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                PLATFORM_COLORS[starter.platform]
              }`}
            >
              {PLATFORM_LABELS[starter.platform]}
            </span>
          </div>
          <ColorDots colors={starter.preview} />
        </div>

        {/* Description */}
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2 flex-1">
          {starter.description}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{tokenCount(starter.tokens)} tokens</span>
          {componentCount(starter.components) > 0 && (
            <>
              <span className="text-border">·</span>
              <span>{componentCount(starter.components)} components</span>
            </>
          )}
          {starter.inheritsComponents && (
            <>
              <span className="text-border">·</span>
              <span className="italic">
                components from {starter.inheritsComponents}
              </span>
            </>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={() => onApply(starter)}
          disabled={isApplying}
          className={`w-full py-2 text-[12px] font-medium rounded-lg transition-colors ${
            mismatch
              ? "border border-border hover:bg-accent text-muted-foreground"
              : "bg-[var(--s-accent)] text-white hover:opacity-90"
          } disabled:opacity-50`}
          title={
            mismatch
              ? `This starter is for ${starter.platform}. Apply anyway?`
              : undefined
          }
        >
          {isApplying ? "Applying…" : "Use this theme"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Library card (compact)
// ─────────────────────────────────────────────────────────────

function LibraryCard({
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

  const tokenPreviewGroups = Object.entries(starter.tokens)
    .slice(0, 4)
    .map(([group, entries]) => {
      const groupEntries =
        entries && typeof entries === "object" && !Array.isArray(entries)
          ? Object.entries(
              entries as Record<string, { value: unknown }>
            ).slice(0, 4)
          : [];
      return { group, entries: groupEntries };
    });

  return (
    <div
      className={`rounded-lg border flex flex-col transition-all ${
        mismatch
          ? "border-border opacity-60"
          : "border-border hover:border-[var(--s-accent)]/40 hover:shadow-sm"
      }`}
    >
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <h3 className="text-[12px] font-semibold truncate">
                {starter.name}
              </h3>
              {mismatch && (
                <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400 shrink-0">
                  ⚠
                </span>
              )}
            </div>
            <span
              className={`inline-block text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                PLATFORM_COLORS[starter.platform]
              }`}
            >
              {PLATFORM_LABELS[starter.platform]}
            </span>
          </div>
          <ColorDots colors={starter.preview} />
        </div>

        <p className="text-[11px] text-muted-foreground line-clamp-2">
          {starter.description}
        </p>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowPreview((p) => !p)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform ${showPreview ? "rotate-180" : ""}`}
            >
              <polyline points="2,4 6,8 10,4" />
            </svg>
            {tokenCount(starter.tokens)} tokens
            {componentCount(starter.components) > 0
              ? ` · ${componentCount(starter.components)} components`
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
            title={
              mismatch
                ? `This starter is for ${starter.platform}. Apply anyway?`
                : undefined
            }
          >
            {applying === starter.id ? "Applying…" : "Use this"}
          </button>
        </div>
      </div>

      {showPreview && (
        <div className="border-t px-3 py-2.5 space-y-2 bg-muted/20">
          {tokenPreviewGroups.map(({ group, entries }) => (
            <div key={group}>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                {group}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {entries.map(([key, entry]) => {
                  const val =
                    typeof entry?.value === "object"
                      ? String(
                          (entry.value as { web: string }).web ?? ""
                        )
                      : String(entry?.value ?? "");
                  const isCol =
                    val.startsWith("#") ||
                    val.startsWith("rgb") ||
                    val.startsWith("hsl");
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-1"
                      title={`${key}: ${val}`}
                    >
                      {isCol && (
                        <div
                          className="w-3.5 h-3.5 rounded border border-black/10 shrink-0"
                          style={{ background: val }}
                        />
                      )}
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {key}
                      </span>
                    </div>
                  );
                })}
                {Object.keys(
                  starter.tokens[group] as Record<string, unknown>
                ).length > 4 && (
                  <span className="text-[9px] text-muted-foreground/60">
                    +
                    {Object.keys(
                      starter.tokens[group] as Record<string, unknown>
                    ).length - 4}{" "}
                    more
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Collapsible section wrapper
// ─────────────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        className="w-full flex items-center justify-between gap-2 py-2 text-left group"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <p className="text-[12px] font-semibold text-foreground">{title}</p>
          {subtitle && (
            <p className="text-[10px] text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          <polyline points="2,4 6,8 10,4" />
        </svg>
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main picker
// ─────────────────────────────────────────────────────────────

export function DSStarterPicker({
  dsId,
  currentPlatform,
  onApplied,
}: {
  dsId: string;
  currentPlatform: "web" | "native" | "universal";
  onApplied: (
    tokens: Record<string, unknown>,
    components?: Record<string, unknown>
  ) => void;
}) {
  const [starters, setStarters] = useState<DSStarter[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);

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
        const importPath =
          starter.platform === "native"
            ? (starter.packageNameNative ?? starter.packageName)
            : starter.packageName;
        if (importPath) {
          const componentsWithImport: Record<string, unknown> = {};
          for (const [name, def] of Object.entries(starter.components)) {
            componentsWithImport[name] = {
              ...(def as Record<string, unknown>),
              importPath,
            };
          }
          payload.components = componentsWithImport;
        } else {
          payload.components = starter.components;
        }
      }
      const res = await fetch(`/api/studio/design-systems/${dsId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const compCount = componentCount(starter.components);
        toast.success(
          compCount > 0
            ? `Applied "${starter.name}" — ${tokenCount(starter.tokens)} tokens + ${compCount} components`
            : `Applied "${starter.name}" starter`
        );
        const appliedComponents = (
          payload.components as Record<string, unknown> | undefined
        ) ?? starter.components;
        onApplied(starter.tokens, appliedComponents);
      } else {
        toast.error("Failed to apply starter");
      }
    } catch {
      toast.error("Failed to apply starter");
    } finally {
      setApplying(null);
    }
  };

  // Split into boilerplate vs external libraries
  const boilerplateStarters = starters.filter(
    (s) =>
      s.category === "boilerplate" &&
      (s.platform === currentPlatform || s.platform === "universal")
  );
  const allPlatformBoilerplate = starters.filter(
    (s) =>
      s.category === "boilerplate" &&
      s.platform !== currentPlatform &&
      s.platform !== "universal"
  );
  const libraryStarters = starters.filter((s) => s.category !== "boilerplate");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold">Start from a theme</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Pick a Studio boilerplate to pre-populate your tokens and component
          set. Everything is editable once applied. Your platform is{" "}
          <strong>{PLATFORM_LABELS[currentPlatform]}</strong>.
        </p>
      </div>

      {/* ── Boilerplate section (primary) ─────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-48 rounded-xl border bg-muted/30 animate-pulse"
            />
          ))}
        </div>
      ) : boilerplateStarters.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {boilerplateStarters.map((starter) => (
            <BoilerplateCard
              key={starter.id}
              starter={starter}
              currentPlatform={currentPlatform}
              onApply={handleApply}
              applying={applying}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-6 text-[12px] text-muted-foreground border rounded-xl">
          No Studio themes for {PLATFORM_LABELS[currentPlatform]} yet.
        </div>
      )}

      {/* ── Other platform boilerplates (collapsed) ───────────── */}
      {!loading && allPlatformBoilerplate.length > 0 && (
        <div className="border-t pt-4">
          <CollapsibleSection
            title="Other platforms"
            subtitle="Themes for platforms other than your current selection"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allPlatformBoilerplate.map((starter) => (
                <BoilerplateCard
                  key={starter.id}
                  starter={starter}
                  currentPlatform={currentPlatform}
                  onApply={handleApply}
                  applying={applying}
                />
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── Component Library section (collapsible) ───────────── */}
      {!loading && libraryStarters.length > 0 && (
        <div className="border-t pt-4">
          <CollapsibleSection
            title="From a component library"
            subtitle="Ant Design, Material 3, iOS HIG — imports their token set & component definitions"
          >
            <div className="grid grid-cols-1 gap-2 mt-1">
              {libraryStarters.map((starter) => (
                <LibraryCard
                  key={starter.id}
                  starter={starter}
                  currentPlatform={currentPlatform}
                  onApply={handleApply}
                  applying={applying}
                />
              ))}
            </div>
          </CollapsibleSection>
        </div>
      )}

      {/* ── Manual / skip ─────────────────────────────────────── */}
      <div className="pt-2 border-t">
        <p className="text-[11px] text-muted-foreground text-center">
          Prefer to build from scratch?{" "}
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
