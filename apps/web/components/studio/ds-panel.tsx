"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useEditorStore } from "@/lib/studio/store";
import { ImportCodebaseModal } from "./import-codebase-modal";
import { DSSyncPanel } from "./ds-sync-panel";

// -------------------------------------------------------------------------
// Token value normalisation
// Tokens from a linked DS may carry dual-value objects { web, native }
// -------------------------------------------------------------------------

function extractTokenString(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return String(raw);
  if (raw && typeof raw === "object") {
    const dual = raw as Record<string, unknown>;
    const val = dual.web ?? dual.native ?? dual.value;
    if (typeof val === "string") return val;
    if (typeof val === "number") return String(val);
  }
  return "";
}

// -------------------------------------------------------------------------
// Token swatch helpers
// -------------------------------------------------------------------------

function ColorSwatch({ value, name }: { value: string; name: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent transition-colors" title={`${name}: ${value}`}>
      <div
        className="w-5 h-5 rounded border border-black/10 flex-shrink-0"
        style={{ background: value }}
      />
      <span className="text-[11px] text-foreground truncate">{name}</span>
      <span className="ml-auto text-[10px] text-muted-foreground font-mono truncate">{value}</span>
    </div>
  );
}

function SpacingSwatch({ value, name }: { value: string; name: string }) {
  const px = parseFloat(value) || 0;
  const barWidth = Math.min(px * 0.8, 60);
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent transition-colors">
      <div className="w-5 h-5 flex items-center flex-shrink-0">
        <div className="h-2 rounded-sm bg-teal-400/60 border border-teal-500/40" style={{ width: Math.max(barWidth, 3) }} />
      </div>
      <span className="text-[11px] text-foreground truncate">{name}</span>
      <span className="ml-auto text-[10px] text-muted-foreground font-mono">{value}</span>
    </div>
  );
}

function RadiusSwatch({ value, name }: { value: string; name: string }) {
  const px = Math.min(parseFloat(value) || 0, 10);
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent transition-colors">
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
        <div className="w-4 h-4 border border-muted-foreground/50 bg-muted/30" style={{ borderRadius: Math.max(px, 1) }} />
      </div>
      <span className="text-[11px] text-foreground truncate">{name}</span>
      <span className="ml-auto text-[10px] text-muted-foreground font-mono">{value}</span>
    </div>
  );
}

function ShadowSwatch({ value, name }: { value: string; name: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent transition-colors" title={`${name}: ${value}`}>
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
        <div className="w-3.5 h-3.5 bg-background rounded-sm" style={{ boxShadow: value }} />
      </div>
      <span className="text-[11px] text-foreground truncate">{name}</span>
      <span className="ml-auto text-[10px] text-muted-foreground font-mono truncate max-w-[80px]">{value.split(" ").slice(0, 3).join(" ")}…</span>
    </div>
  );
}

function SizeSwatch({ value, name }: { value: string; name: string }) {
  const px = Math.min(parseFloat(value) || 0, 60);
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent transition-colors">
      <div className="w-5 h-5 flex items-center flex-shrink-0">
        <div className="bg-indigo-400/50 border border-indigo-500/40 rounded-sm" style={{ width: Math.max(px * 0.3, 2), height: Math.max(px * 0.3, 2) }} />
      </div>
      <span className="text-[11px] text-foreground truncate">{name}</span>
      <span className="ml-auto text-[10px] text-muted-foreground font-mono">{value}</span>
    </div>
  );
}

function FontFamilySwatch({ value, name }: { value: string; name: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent transition-colors" title={`${name}: ${value}`}>
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
        <span className="text-[13px] font-bold" style={{ fontFamily: value }}>Aa</span>
      </div>
      <span className="text-[11px] text-foreground truncate">{name}</span>
      <span className="ml-auto text-[10px] text-muted-foreground truncate max-w-[90px]">{value.split(",")[0].trim()}</span>
    </div>
  );
}

function FontSizeSwatch({ value, name }: { value: string; name: string }) {
  const px = parseFloat(value) || 0;
  const previewSize = Math.min(Math.max(px, 10), 18);
  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-accent transition-colors">
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
        <span style={{ fontSize: previewSize }} className="text-foreground leading-none">T</span>
      </div>
      <span className="text-[11px] text-foreground truncate">{name}</span>
      <span className="ml-auto text-[10px] text-muted-foreground font-mono">{value}</span>
    </div>
  );
}

function TextStyleSwatch({ name, style }: { name: string; style: { fontSize?: string; fontWeight?: string; lineHeight?: string; fontFamily?: string } }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent transition-colors">
      <span
        className="text-foreground leading-none truncate flex-1"
        style={{
          fontSize: Math.min(parseFloat(style.fontSize ?? "14") || 14, 20),
          fontWeight: style.fontWeight ?? "400",
          fontFamily: style.fontFamily,
        }}
      >
        {name}
      </span>
      <span className="text-[10px] text-muted-foreground font-mono shrink-0">{style.fontSize ?? "—"}</span>
    </div>
  );
}

// -------------------------------------------------------------------------
// Collapsible section
// -------------------------------------------------------------------------

function TokenSection({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 px-2 hover:text-foreground transition-colors h-7"
      >
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease", flexShrink: 0 }}
        >
          <polyline points="3,2 7,5 3,8"/>
        </svg>
        {title}
      </button>
      {open && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

// -------------------------------------------------------------------------
// DS Panel
// -------------------------------------------------------------------------

type LinkedDS = {
  id: string;
  name: string;
  platform: "web" | "native" | "universal";
};

const PLATFORM_COLORS: Record<string, string> = {
  web: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  native: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  universal: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

export function DSPanel({
  projectId,
  onOpenThemeEditor,
  onOpenFonts,
}: {
  projectId?: string | null;
  onOpenThemeEditor?: () => void;
  onOpenFonts?: () => void;
}) {
  const designTokens = useEditorStore((s) => s.designTokens);
  const loadDesignTokens = useEditorStore((s) => s.loadDesignTokens);
  const [linkedDs, setLinkedDs] = useState<LinkedDS | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSyncPanel, setShowSyncPanel] = useState(false);

  // Load linked DS info — try localStorage first (fast path), then fall back to DB
  useEffect(() => {
    if (!projectId) return;

    // Fast path: localStorage has the DS name/platform cached
    try {
      const raw = localStorage.getItem(`studio-project-settings-${projectId}`);
      if (raw) {
        const settings = JSON.parse(raw) as { linkedDsId?: string; linkedDsName?: string; linkedDsPlatform?: "web" | "native" | "universal" };
        if (settings.linkedDsId && settings.linkedDsName) {
          setLinkedDs({ id: settings.linkedDsId, name: settings.linkedDsName, platform: settings.linkedDsPlatform ?? "web" });
          return;
        }
      }
    } catch { /* ignore */ }

    // Fallback: fetch from DB (handles fresh sessions / new devices)
    fetch(`/api/studio/projects?id=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then(async (d: { project?: { design_system_id?: string | null } }) => {
        const dsId = d.project?.design_system_id;
        if (!dsId) return;
        const dsRes = await fetch(`/api/studio/design-systems/${encodeURIComponent(dsId)}`);
        if (!dsRes.ok) return;
        const dsData = await dsRes.json();
        const ds = dsData.designSystem;
        if (ds?.id && ds?.name) {
          setLinkedDs({ id: ds.id, name: ds.name, platform: ds.platform ?? "web" });
          // Cache in localStorage so next open is instant
          try {
            const key = `studio-project-settings-${projectId}`;
            const existing = JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>;
            localStorage.setItem(key, JSON.stringify({ ...existing, linkedDsId: ds.id, linkedDsName: ds.name, linkedDsPlatform: ds.platform }));
          } catch { /* ignore */ }
        }
      })
      .catch(() => { /* non-critical */ });
  }, [projectId]);

  const colorEntries = designTokens?.color
    ? Object.entries(designTokens.color).map(([k, v]) => ({ name: k, value: extractTokenString(v.value) }))
    : [];
  const spacingEntries = designTokens?.spacing
    ? Object.entries(designTokens.spacing).map(([k, v]) => ({ name: k, value: extractTokenString(v.value) }))
    : [];
  const sizeEntries = designTokens?.size
    ? Object.entries(designTokens.size).map(([k, v]) => ({ name: k, value: extractTokenString(v.value) }))
    : [];
  const radiusEntries = designTokens?.borderRadius
    ? Object.entries(designTokens.borderRadius).map(([k, v]) => ({ name: k, value: extractTokenString(v.value) }))
    : [];
  const shadowEntries = designTokens?.shadow
    ? Object.entries(designTokens.shadow).map(([k, v]) => ({ name: k, value: extractTokenString(v.value) }))
    : [];
  const fontFamilyEntries = designTokens?.typography?.fontFamily
    ? Object.entries(designTokens.typography.fontFamily).map(([k, v]) => ({ name: k, value: extractTokenString(v.value) }))
    : [];
  const fontSizeEntries = designTokens?.typography?.fontSize
    ? Object.entries(designTokens.typography.fontSize).map(([k, v]) => ({ name: k, value: extractTokenString(v.value) }))
    : [];
  const textStyleEntries = designTokens?.textStyles
    ? Object.entries(designTokens.textStyles)
    : [];
  const hasAnyTokens = colorEntries.length + spacingEntries.length + sizeEntries.length + radiusEntries.length + shadowEntries.length + fontFamilyEntries.length + fontSizeEntries.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* DS connection status */}
      <div className="px-3 py-3 border-b">
        {linkedDs ? (
          <div className="rounded-lg border border-[var(--s-accent)]/30 bg-[var(--s-accent)]/5 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-foreground truncate flex-1">{linkedDs.name}</span>
              <span className={`shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full ${PLATFORM_COLORS[linkedDs.platform]}`}>
                {linkedDs.platform}
              </span>
            </div>
            <Link
              href={`/studio/ds/${linkedDs.id}`}
              target="_blank"
              className="flex items-center gap-1 text-[10px] text-[var(--s-accent)] hover:opacity-80 transition-opacity font-medium"
            >
              Open Design System
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 5h8M5 1l4 4-4 4"/>
              </svg>
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3 text-center space-y-2">
            <div className="text-[11px] font-medium text-foreground">No design system linked</div>
            <div className="text-[10px] text-muted-foreground">
              Link a DS via Project Settings, or{" "}
              <Link href="/studio/ds" target="_blank" className="text-[var(--s-accent)] hover:opacity-80">
                create one
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex gap-1.5 px-3 py-2 border-b flex-wrap">
        {onOpenThemeEditor && (
          <button
            onClick={onOpenThemeEditor}
            className="flex-1 text-[11px] py-1.5 rounded border hover:bg-accent transition-colors text-center truncate"
          >
            Theme Editor
          </button>
        )}
        {onOpenFonts && (
          <button
            onClick={onOpenFonts}
            className="flex-1 text-[11px] py-1.5 rounded border hover:bg-accent transition-colors text-center"
          >
            Fonts
          </button>
        )}
        {linkedDs && (
          <Link
            href={`/studio/ds/${linkedDs.id}?tab=export`}
            target="_blank"
            className="w-full text-[11px] py-1.5 rounded border hover:bg-accent transition-colors text-center"
          >
            Export DS
          </Link>
        )}
        {/* Brownfield connect / sync (0.10.5) */}
        {linkedDs && (() => {
          const rawTokens = (designTokens as unknown as Record<string, unknown> | null) ?? {};
          const hasSourceConfig = !!rawTokens._sourceConfig;
          return hasSourceConfig ? (
            <button
              onClick={() => setShowSyncPanel(true)}
              className="w-full text-[11px] py-1.5 rounded border border-dashed hover:bg-accent transition-colors text-center [color:var(--s-accent)]"
              title="Re-scan codebase and review token changes"
            >
              Sync with codebase
            </button>
          ) : (
            <button
              onClick={() => setShowImportModal(true)}
              className="w-full text-[11px] py-1.5 rounded border border-dashed hover:bg-accent transition-colors text-center [color:var(--s-accent)]"
              title="Import components and tokens from your React codebase"
            >
              Connect your codebase →
            </button>
          );
        })()}
      </div>

      {/* Token browser */}
      <div className="flex-1 overflow-y-auto py-2 px-0 space-y-3">
        {designTokens ? (
          <>
            {textStyleEntries.length > 0 && (
              <TokenSection title="Text Styles">
                {textStyleEntries.map(([name, style]) => (
                  <TextStyleSwatch key={name} name={name} style={style} />
                ))}
              </TokenSection>
            )}
            {colorEntries.length > 0 && (
              <TokenSection title="Colors">
                {colorEntries.map(({ name, value }) => (
                  <ColorSwatch key={name} name={name} value={value} />
                ))}
              </TokenSection>
            )}
            {(fontFamilyEntries.length > 0 || fontSizeEntries.length > 0) && (
              <TokenSection title="Typography" defaultOpen={false}>
                {fontFamilyEntries.map(({ name, value }) => (
                  <FontFamilySwatch key={`ff-${name}`} name={name} value={value} />
                ))}
                {fontSizeEntries.map(({ name, value }) => (
                  <FontSizeSwatch key={`fs-${name}`} name={name} value={value} />
                ))}
              </TokenSection>
            )}
            {spacingEntries.length > 0 && (
              <TokenSection title="Spacing">
                {spacingEntries.map(({ name, value }) => (
                  <SpacingSwatch key={name} name={name} value={value} />
                ))}
              </TokenSection>
            )}
            {sizeEntries.length > 0 && (
              <TokenSection title="Size" defaultOpen={false}>
                {sizeEntries.map(({ name, value }) => (
                  <SizeSwatch key={name} name={name} value={value} />
                ))}
              </TokenSection>
            )}
            {radiusEntries.length > 0 && (
              <TokenSection title="Border Radius" defaultOpen={false}>
                {radiusEntries.map(({ name, value }) => (
                  <RadiusSwatch key={name} name={name} value={value} />
                ))}
              </TokenSection>
            )}
            {shadowEntries.length > 0 && (
              <TokenSection title="Shadows" defaultOpen={false}>
                {shadowEntries.map(({ name, value }) => (
                  <ShadowSwatch key={name} name={name} value={value} />
                ))}
              </TokenSection>
            )}
            {!hasAnyTokens && (
              <div className="px-3 py-4 text-[11px] text-muted-foreground text-center">
                No tokens loaded. Add tokens in the Theme Editor.
              </div>
            )}
          </>
        ) : (
          <div className="px-3 py-4 text-[11px] text-muted-foreground text-center">
            No design tokens loaded.
          </div>
        )}
      </div>

      {/* Brownfield import modal (0.10.5) */}
      {showImportModal && linkedDs && (
        <ImportCodebaseModal
          dsId={linkedDs.id}
          projectId={projectId}
          existingTokens={(designTokens as unknown as Record<string, unknown>) ?? {}}
          onImported={() => { loadDesignTokens(); }}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {/* Sync panel (0.10.6) */}
      {showSyncPanel && linkedDs && (
        <DSSyncPanel
          dsId={linkedDs.id}
          projectId={projectId}
          currentTokens={(designTokens as unknown as Record<string, unknown>) ?? {}}
          onSynced={() => { loadDesignTokens(); }}
          onClose={() => setShowSyncPanel(false)}
        />
      )}
    </div>
  );
}
