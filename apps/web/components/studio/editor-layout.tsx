"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useEditorStore, generateId, cloneWithNewIds } from "@/lib/studio/store";
import { NODE_SCHEMAS } from "@/lib/studio/node-schemas";
import { CONTAINER_TYPES } from "@/lib/studio/types";
import type { Node } from "@/lib/studio/types";
import { ComponentPalette } from "./component-palette";
import { EditorCanvas } from "./editor-canvas";
import { PropertyPanel } from "./property-panel";
import { NodeTree } from "./node-tree";
import { ContextMenu } from "./context-menu";
import { AIGenerateModal } from "./ai-generate-modal";
import { FontPicker } from "./font-picker";
import { AssetBrowser } from "./asset-browser";
import { ScreensPanel } from "./screens-panel";
import { DSPanel } from "./ds-panel";
import { ProjectSettingsPanel } from "./project-settings-panel";
import { CommandPalette } from "./command-palette";
import { ImportTokensModal } from "./import-tokens-modal";
import { DSWizard } from "./ds-wizard";
import { ThemeEditor } from "./theme-editor";
import { A11yPanel } from "./a11y-panel";
import { SToolbarButton, SPanelTab, SPanelTabStrip, SChip } from "./ui";
import { ExportModal } from "./export-modal";
import { CanvasErrorBoundary } from "./error-boundary";
import { WelcomeModal } from "./onboarding/welcome-modal";
import { TooltipGuide } from "./onboarding/tooltip-guide";
import { VersionHistory } from "./version-history";
import { FloatingAlignBar } from "./floating-align-bar";
import { toast } from "@/lib/studio/toast";

// -------------------------------------------------------------------------
// Snap-to-grid modifier (8px grid)
// -------------------------------------------------------------------------

const GRID_SIZE = 8;

const snapToGridModifier: Modifier = ({ transform }) => {
  return {
    ...transform,
    x: Math.round(transform.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(transform.y / GRID_SIZE) * GRID_SIZE,
  };
};

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

/** Check whether `ancestorId` is an ancestor of `descendantId` in the tree. */
function isDescendant(root: Node, ancestorId: string, descendantId: string): boolean {
  const ancestor = findNodeById(root, ancestorId);
  if (!ancestor) return false;
  return !!findNodeById(ancestor, descendantId);
}

function findNodeById(node: Node, id: string): Node | null {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
}

function findParentContainer(root: Node, targetId: string): Node | null {
  function walk(node: Node, parent: Node | null): Node | null {
    if (node.id === targetId) {
      if (parent && (CONTAINER_TYPES.has(parent.type) || parent.id === root.id)) return parent;
      return root;
    }
    if (node.children) {
      for (const child of node.children) {
        const found = walk(child, node);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(root, null);
}

// -------------------------------------------------------------------------
// Artboard size picker — framework-aware presets
// -------------------------------------------------------------------------

type ArtboardPreset = {
  id: string;
  label: string;
  width: number | null; // null = responsive (web only)
  group: string;
};

// Web (Next.js) presets — responsive breakpoints
const WEB_ARTBOARD_GROUPS: { label: string; presets: ArtboardPreset[] }[] = [
  {
    label: "Responsive",
    presets: [
      { id: "responsive", label: "Responsive", width: null, group: "Responsive" },
    ],
  },
  {
    label: "Mobile",
    presets: [
      { id: "web_mobile", label: "Mobile", width: 375, group: "Mobile" },
    ],
  },
  {
    label: "Tablet",
    presets: [
      { id: "web_tablet",  label: "Tablet",     width: 768,  group: "Tablet" },
      { id: "web_tablet_lg", label: "Tablet L", width: 1024, group: "Tablet" },
    ],
  },
  {
    label: "Desktop",
    presets: [
      { id: "desktop_md", label: "Desktop",    width: 1280, group: "Desktop" },
      { id: "desktop_lg", label: "Desktop HD", width: 1440, group: "Desktop" },
      { id: "desktop_xl", label: "Widescreen", width: 1920, group: "Desktop" },
    ],
  },
];

// Mobile (Expo/React Native) presets — specific device sizes
const MOBILE_ARTBOARD_GROUPS: { label: string; presets: ArtboardPreset[] }[] = [
  {
    label: "iPhone",
    presets: [
      { id: "iphone17",  label: "iPhone 17",   width: 402, group: "iPhone" },
      { id: "iphone16",  label: "iPhone 16",   width: 393, group: "iPhone" },
      { id: "iphone_se", label: "iPhone SE",   width: 375, group: "iPhone" },
    ],
  },
  {
    label: "Android",
    presets: [
      { id: "android_compact", label: "Android Compact", width: 412, group: "Android" },
      { id: "android_normal",  label: "Android Normal",  width: 360, group: "Android" },
    ],
  },
  {
    label: "Tablet",
    presets: [
      { id: "ipad",     label: "iPad",          width: 820, group: "Tablet" },
      { id: "ipad_pro", label: "iPad Pro 11\"",  width: 834, group: "Tablet" },
    ],
  },
];

const ALL_WEB_PRESETS = WEB_ARTBOARD_GROUPS.flatMap((g) => g.presets);
const ALL_MOBILE_PRESETS = MOBILE_ARTBOARD_GROUPS.flatMap((g) => g.presets);

function findPresetByWidth(w: number | null, isMobile: boolean): ArtboardPreset | undefined {
  const pool = isMobile ? ALL_MOBILE_PRESETS : ALL_WEB_PRESETS;
  if (w === null) return ALL_WEB_PRESETS.find((p) => p.width === null);
  return pool.find((p) => p.width === w);
}

function ArtboardSizePicker() {
  const artboardWidth = useEditorStore((s) => s.artboardWidth);
  const setArtboardWidth = useEditorStore((s) => s.setArtboardWidth);
  const projectFramework = useEditorStore((s) => s.projectFramework);
  const isMobile = projectFramework === "expo";
  const groups = isMobile ? MOBILE_ARTBOARD_GROUPS : WEB_ARTBOARD_GROUPS;

  const [open, setOpen] = React.useState(false);
  const [customMode, setCustomMode] = React.useState(false);
  const [customVal, setCustomVal] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCustomMode(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const activePreset = findPresetByWidth(artboardWidth, isMobile);
  const buttonLabel = activePreset
    ? activePreset.width === null
      ? "Responsive"
      : `${activePreset.label} · ${activePreset.width}`
    : artboardWidth !== null
    ? `Custom · ${artboardWidth}`
    : isMobile
    ? "Custom"
    : "Responsive";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => { setOpen((o) => !o); setCustomMode(false); }}
        className="flex items-center gap-1.5 [padding:3px_8px] [font-size:var(--s-text-xs)] [border-radius:var(--s-r-md)] [border:1px_solid_var(--s-border)] [background:var(--s-bg-subtle)] [color:var(--s-text-sec)] cursor-pointer hover:[border-color:var(--s-border-hi)] hover:[color:var(--s-text-pri)]"
        title="Artboard size"
      >
        {isMobile ? (
          <svg width="10" height="12" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="1" width="8" height="14" rx="2"/>
            <circle cx="5" cy="13" r="0.8" fill="currentColor" stroke="none"/>
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="12" height="10" rx="1"/>
          </svg>
        )}
        <span>{buttonLabel}</span>
        <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6l4 4 4-4"/>
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            width: 240,
            background: "var(--s-bg-panel)",
            border: "1px solid var(--s-border)",
            borderRadius: 10,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          {groups.map((grp, gi) => (
            <div key={gi}>
              <div style={{
                padding: "8px 12px 4px",
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--s-text-ter)",
                borderTop: gi > 0 ? "1px solid var(--s-border)" : undefined,
              }}>
                {grp.label}
              </div>
              {grp.presets.map((preset) => {
                const isActive = preset.width === artboardWidth;
                return (
                  <button
                    key={preset.id}
                    onClick={() => { setArtboardWidth(preset.width); setOpen(false); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                      padding: "6px 12px",
                      border: "none",
                      background: isActive ? "var(--s-bg-hover)" : "transparent",
                      color: isActive ? "var(--s-text-pri)" : "var(--s-text-sec)",
                      fontSize: 12,
                      fontWeight: isActive ? 500 : 400,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ width: 11, color: "var(--s-text-ter)" }}>
                      {isActive && (
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 8l4 4 6-7"/>
                        </svg>
                      )}
                    </span>
                    <span style={{ flex: 1 }}>{preset.label}</span>
                    {preset.width !== null && (
                      <span style={{ color: "var(--s-text-ter)", fontSize: 11 }}>{preset.width}px</span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Custom width option */}
          <div style={{ borderTop: "1px solid var(--s-border)", padding: "8px 12px" }}>
            {customMode ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="number"
                  min={200}
                  max={3840}
                  value={customVal}
                  placeholder="Width in px"
                  onChange={(e) => setCustomVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const w = parseInt(customVal, 10);
                      if (w >= 200 && w <= 3840) { setArtboardWidth(w); setOpen(false); setCustomMode(false); }
                    }
                    if (e.key === "Escape") { setCustomMode(false); }
                  }}
                  onBlur={() => {
                    const w = parseInt(customVal, 10);
                    if (w >= 200 && w <= 3840) { setArtboardWidth(w); setOpen(false); }
                    setCustomMode(false);
                  }}
                  style={{ flex: 1, padding: "4px 6px", fontSize: 12, border: "1px solid var(--s-border)", borderRadius: 5, background: "var(--s-bg-base)", color: "var(--s-text-pri)", outline: "none" }}
                />
                <span style={{ fontSize: 11, color: "var(--s-text-ter)" }}>px</span>
              </div>
            ) : (
              <button
                onClick={() => { setCustomVal(artboardWidth ? String(artboardWidth) : ""); setCustomMode(true); }}
                style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", border: "none", background: "none", color: "var(--s-text-ter)", fontSize: 12, cursor: "pointer", padding: 0 }}
              >
                <span style={{ width: 11 }} />
                <span>Custom…</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Top bar
// -------------------------------------------------------------------------

function TopBar({
  screenName,
  projectName,
  onSave,
  onBack,
  onAIGenerate,
  onExport,
  onHistory,
  onPreview,
  onSettings,
  onProjectNameChange,
  hasCompiled,
  saving,
  githubConnected,
}: {
  screenName: string;
  projectName?: string;
  onSave: () => void;
  onBack: () => void;
  onAIGenerate: () => void;
  onExport: () => void;
  onHistory: () => void;
  onPreview: () => void;
  onSettings?: () => void;
  onProjectNameChange?: (name: string) => void;
  hasCompiled?: boolean;
  saving?: boolean;
  githubConnected?: boolean;
}) {
  const dirty = useEditorStore((s) => s.dirty);
  const [editingName, setEditingName] = React.useState(false);
  const [nameValue, setNameValue] = React.useState(projectName ?? "");
  React.useEffect(() => {
    if (!editingName) setNameValue(projectName ?? "");
  }, [projectName, editingName]);
  const spec = useEditorStore((s) => s.spec);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const previewMode = useEditorStore((s) => s.previewMode);
  const canvasMode = useEditorStore((s) => s.canvasMode);
  const setCanvasMode = useEditorStore((s) => s.setCanvasMode);
  const currentTool = useEditorStore((s) => s.currentTool);
  const setCurrentTool = useEditorStore((s) => s.setCurrentTool);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const dsThemes = useEditorStore((s) => s.dsThemes);
  const activeThemeId = useEditorStore((s) => s.activeThemeId);
  const setActiveTheme = useEditorStore((s) => s.setActiveTheme);
  const themeNames = Object.keys(dsThemes);

  const handlePreview = () => {
    if (!spec) return;
    window.open(spec.route === "/" ? "/" : spec.route, "_blank");
  };
  const projectFramework = useEditorStore((s) => s.projectFramework);
  const isNativeProject = projectFramework === "expo";

  return (
    <div
      className="flex items-center gap-1 [height:var(--s-topbar-h)] [padding:0_10px] [background:var(--s-bg-panel)] [border-bottom:1px_solid_var(--s-border)]"
      style={previewMode ? { background: "var(--s-accent-soft)", borderColor: "var(--s-accent-mid)" } : undefined}
    >
      {/* Logo — back to dashboard */}
      <div className="relative group flex items-center gap-1.5 mr-1.5 cursor-pointer" onClick={onBack}>
        <div className="flex items-center justify-center [width:22px] [height:22px] [border-radius:var(--s-r-md)] [background:var(--s-accent)] text-white [font-size:12px] [font-weight:800] [letter-spacing:-1px] hover:opacity-80 transition-opacity">
          S
        </div>
        <div className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <div className="[background:#1a1a1a] text-white [font-size:11px] [font-weight:500] whitespace-nowrap [padding:4px_8px] [border-radius:5px] shadow-lg relative">
            Back to dashboard
            <div className="absolute left-[9px] -top-[4px] [width:8px] [height:8px] [background:#1a1a1a] rotate-45" />
          </div>
        </div>
      </div>

      <div className="[width:1px] [height:18px] [background:var(--s-border)] mx-1.5 shrink-0" />

      {/* Tool group */}
      {!previewMode && (
        <div className="flex gap-0.5">
          <SToolbarButton active={currentTool === "select"} onClick={() => setCurrentTool("select")} icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 13.5 L8 2 L10 9.5 L13.5 7 Z"/></svg>} title="Select (V)" />
          {canvasMode === "design" && (
            <>
              <SToolbarButton active={currentTool === "frame"} onClick={() => setCurrentTool("frame")} icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>} title="Frame (F)" />
              <SToolbarButton active={currentTool === "rectangle"} onClick={() => setCurrentTool("rectangle")} icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="12" height="8" rx="1.5"/></svg>} title="Rectangle (R)" />
              <SToolbarButton active={currentTool === "ellipse"} onClick={() => setCurrentTool("ellipse")} icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="8" cy="8" rx="6" ry="5"/></svg>} title="Ellipse (O)" />
              <SToolbarButton active={currentTool === "line"} onClick={() => setCurrentTool("line")} icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><line x1="2" y1="12" x2="14" y2="4"/></svg>} title="Line (L)" />
              <SToolbarButton active={currentTool === "text"} onClick={() => setCurrentTool("text")} icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="4" x2="14" y2="4"/><line x1="8" y1="4" x2="8" y2="13"/></svg>} title="Text (T)" />
            </>
          )}
        </div>
      )}

      {/* Design / Build mode toggle */}
      {!previewMode && (
        <>
          <div className="[width:1px] [height:18px] [background:var(--s-border)] mx-1.5 shrink-0" />
          <div className="flex items-center [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-lg)] [padding:2px] [background:var(--s-bg-subtle)]">
            {(["design", "build"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setCanvasMode(mode)}
                className={`[padding:2px_8px] [font-size:var(--s-text-xs)] [border-radius:var(--s-r-md)] border-none cursor-pointer transition-all [transition-duration:0.1s] [font-weight:var(--s-weight-medium)] ${
                  canvasMode === mode
                    ? mode === "design"
                      ? "[background:var(--s-warning)] [color:white]"
                      : "[background:var(--s-bg-base)] [box-shadow:var(--s-shadow-sm)] [color:var(--s-text-pri)]"
                    : "[background:transparent] [color:var(--s-text-ter)] hover:[color:var(--s-text-sec)]"
                }`}
                title={`${mode === "design" ? "Design" : "Build"} Mode (${mode === "design" ? "D" : "B"})`}
              >
                {mode === "design" ? "Design" : "Build"}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="[width:1px] [height:18px] [background:var(--s-border)] mx-1.5 shrink-0" />

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 ml-1">
        {projectName && onProjectNameChange ? (
          editingName ? (
            <input
              autoFocus
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={() => {
                setEditingName(false);
                const trimmed = nameValue.trim();
                if (trimmed && trimmed !== projectName) onProjectNameChange(trimmed);
                else setNameValue(projectName);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") { setNameValue(projectName); setEditingName(false); }
              }}
              className="[font-size:var(--s-text-md)] [color:var(--s-text-pri)] [font-weight:var(--s-weight-medium)] [background:var(--s-bg-input,var(--s-bg-hover))] [border:1px_solid_var(--s-accent)] [border-radius:var(--s-r-sm)] [padding:2px_6px] outline-none min-w-0"
              style={{ width: `${Math.max(nameValue.length, 6)}ch` }}
            />
          ) : (
            <span
              title="Click to rename project"
              className="[font-size:var(--s-text-md)] [color:var(--s-text-sec)] cursor-text [padding:3px_6px] [border-radius:var(--s-r-sm)] hover:[background:var(--s-bg-hover)] hover:[color:var(--s-text-pri)]"
              onClick={() => setEditingName(true)}
            >
              {projectName}
            </span>
          )
        ) : (
          <span
            className="[font-size:var(--s-text-md)] [color:var(--s-text-sec)] cursor-pointer [padding:3px_6px] [border-radius:var(--s-r-sm)] hover:[background:var(--s-bg-hover)] hover:[color:var(--s-text-pri)]"
            onClick={onBack}
          >
            {projectName || "Projects"}
          </span>
        )}
        {dirty && !previewMode && (
          <span className="[width:6px] [height:6px] rounded-full [background:var(--s-warning)]" title="Unsaved changes" />
        )}
        {previewMode && (
          <span className="[font-size:var(--s-text-xs)] [color:var(--s-accent)] [font-weight:var(--s-weight-medium)] ml-1">Preview</span>
        )}
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-1.5">
        {/* Artboard size picker */}
        <ArtboardSizePicker />

        <div className="[width:1px] [height:18px] [background:var(--s-border)] mx-0.5 shrink-0" />

        {!previewMode && (
          <>
            <SToolbarButton icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,8 5,5 2,2"/><line x1="5" y1="5" x2="14" y2="5"/></svg>} title="Undo (Ctrl+Z)" onClick={undo} />
            <SToolbarButton icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="14,8 11,5 14,2"/><line x1="11" y1="5" x2="2" y2="5"/></svg>} title="Redo (Ctrl+Shift+Z)" onClick={redo} />
            <SToolbarButton icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6"/><polyline points="8,4 8,8 11,10"/></svg>} title="Version History" onClick={onHistory} />
            <SToolbarButton
              active={snapEnabled}
              onClick={toggleSnap}
              title={snapEnabled ? "Snap enabled — click to disable" : "Snap disabled — click to enable"}
              icon={
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v3M8 11v3M2 8h3M11 8h3"/>
                  <circle cx="8" cy="8" r="2"/>
                  <path d="M4.93 4.93l1.41 1.41M9.66 9.66l1.41 1.41M4.93 11.07l1.41-1.41M9.66 6.34l1.41-1.41"/>
                </svg>
              }
            />
          </>
        )}

        <div className="[width:1px] [height:18px] [background:var(--s-border)] mx-0.5 shrink-0" />

        {/* Theme switcher — only visible when the linked DS has themes */}
        {themeNames.length > 0 && !previewMode && (
          <select
            value={activeThemeId ?? ""}
            onChange={(e) => setActiveTheme(e.target.value || null)}
            className="h-[24px] px-2 [font-size:var(--s-text-xs)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [background:var(--s-bg-subtle)] [color:var(--s-text-sec)] cursor-pointer hover:[border-color:var(--s-accent)] focus:outline-none"
            title="Switch active DS theme"
          >
            <option value="">Default</option>
            {themeNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}

        <SChip
          data-guide="preview"
          onClick={onPreview}
          title="Preview (Cmd+P)"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><polygon points="4,2 14,8 4,14"/></svg>
          Preview
        </SChip>

        {!previewMode && (
          <SChip
            data-guide="save"
            variant="accent"
            onClick={onSave}
            disabled={saving}
          >
            {saving && (
              <svg className="animate-spin [width:12px] [height:12px]" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {saving ? "Saving..." : "Save"}
          </SChip>
        )}

        {/* GitHub status chip */}
        {githubConnected && !previewMode && (
          <div className="flex items-center gap-1 [padding:3px_7px] [font-size:var(--s-text-xs)] [color:var(--s-success,#22c55e)] [border:1px_solid_var(--s-success,#22c55e)] [border-radius:var(--s-r-lg)] opacity-80" title="GitHub connected">
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            GitHub
          </div>
        )}

        {/* Project settings gear */}
        {onSettings && !previewMode && (
          <SToolbarButton
            icon={<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.05 3.05l1.06 1.06M11.89 11.89l1.06 1.06M3.05 12.95l1.06-1.06M11.89 4.11l1.06-1.06"/></svg>}
            title="Project Settings"
            onClick={onSettings}
          />
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Left Sidebar -- 5-tab icon rail (Screens, Layers, Insert, DS, Assets)
// -------------------------------------------------------------------------

type LeftTab = "screens" | "layers" | "insert" | "ds" | "assets";

const TAB_ICONS: Record<LeftTab, React.ReactNode> = {
  screens: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="1.5" width="12" height="13" rx="1.5"/>
      <line x1="5" y1="5.5" x2="11" y2="5.5"/>
      <line x1="5" y1="8" x2="11" y2="8"/>
      <line x1="5" y1="10.5" x2="9" y2="10.5"/>
    </svg>
  ),
  layers: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="4" x2="14" y2="4"/>
      <line x1="2" y1="8" x2="14" y2="8"/>
      <line x1="2" y1="12" x2="14" y2="12"/>
    </svg>
  ),
  insert: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="12" height="12" rx="2"/>
      <line x1="8" y1="5" x2="8" y2="11"/>
      <line x1="5" y1="8" x2="11" y2="8"/>
    </svg>
  ),
  ds: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="5.5"/>
      <circle cx="8" cy="8" r="2"/>
      <line x1="8" y1="2.5" x2="8" y2="6"/>
      <line x1="8" y1="10" x2="8" y2="13.5"/>
    </svg>
  ),
  assets: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="13" height="13" rx="2"/>
      <circle cx="5.5" cy="5.5" r="1.5"/>
      <polyline points="1.5,11.5 5,7.5 8,10.5 11,8 14.5,11.5"/>
    </svg>
  ),
};

const TAB_LABELS: Record<LeftTab, string> = {
  screens: "Screens",
  layers: "Layers",
  insert: "Insert",
  ds: "Design System",
  assets: "Assets",
};

const ALL_LEFT_TABS: LeftTab[] = ["screens", "layers", "insert", "ds", "assets"];

// Recursively count build vs design-only nodes in the tree
function countNodesByCompile(node: Node): { build: number; design: number } {
  const isDesign = node.compile === false;
  const self = isDesign ? { build: 0, design: 1 } : { build: 1, design: 0 };
  return (node.children ?? []).reduce(
    (acc, child) => {
      const c = countNodesByCompile(child);
      return { build: acc.build + c.build, design: acc.design + c.design };
    },
    self,
  );
}

function NodeCountStatus() {
  const spec = useEditorStore((s) => s.spec);
  if (!spec) return null;
  const { build, design } = countNodesByCompile(spec.tree);
  if (design === 0) return null;
  return (
    <div className="shrink-0 flex items-center gap-1.5 [padding:5px_10px] [border-top:1px_solid_var(--s-border)] font-mono">
      <span className="[font-size:10px]" style={{ color: "var(--s-accent)" }}>{build} Build</span>
      <span className="[font-size:10px] [color:var(--s-text-ter)]">·</span>
      <span className="[font-size:10px]" style={{ color: "rgba(234,179,8,0.9)" }}>{design} Design-only</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resize handle — the 4px drag strip between a panel and the canvas
// ---------------------------------------------------------------------------

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="shrink-0 w-px cursor-col-resize transition-colors hover:bg-[var(--s-accent)] active:bg-[var(--s-accent)] z-10"
      style={{ background: "var(--s-border)" }}
    />
  );
}

function LeftSidebar({
  projectId,
  screenName,
  width,
  onOpenThemeEditor,
  onOpenFonts,
}: {
  projectId?: string | null;
  screenName?: string;
  width: number;
  onOpenThemeEditor?: () => void;
  onOpenFonts?: () => void;
}) {
  const [activeTab, setActiveTab] = React.useState<LeftTab>("insert");
  const [search, setSearch] = React.useState("");

  const showSearch = activeTab === "insert" || activeTab === "layers" || activeTab === "assets";

  return (
    <div data-guide="palette" className="shrink-0 flex overflow-hidden [background:var(--s-bg-panel)]" style={{ width }}>
      {/* Icon-only tab rail */}
      <div className="flex flex-col [width:50px] [border-right:1px_solid_var(--s-border)] [background:var(--s-bg-base)] shrink-0 py-1 gap-0.5">
        {ALL_LEFT_TABS.map((tab) => (
          <div key={tab} className="relative group">
            <button
              onClick={() => { setActiveTab(tab); setSearch(""); }}
              className={`w-[50px] h-[50px] flex items-center justify-center transition-colors ${
                activeTab === tab
                  ? "[color:var(--s-accent)] [background:var(--s-accent)]/10"
                  : "[color:var(--s-text-ter)] hover:[color:var(--s-text-pri)] hover:[background:var(--s-bg-subtle)]"
              }`}
              title={TAB_LABELS[tab]}
            >
              {TAB_ICONS[tab]}
            </button>
            {/* Tooltip */}
            <div className="absolute left-10 top-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
              <span className="text-[11px] bg-foreground text-background px-2 py-1 rounded shadow-md">{TAB_LABELS[tab]}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Panel content area */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Search bar (only for insert/layers/assets) */}
        {showSearch && (
          <div className="[padding:7px_8px_6px] [border-bottom:1px_solid_var(--s-border)]">
            <div className="relative">
              <svg className="absolute [left:7px] [top:50%] -translate-y-1/2 [width:12px] [height:12px] [stroke:var(--s-text-ter)] fill-none [stroke-width:1.7] [stroke-linecap:round] [stroke-linejoin:round]" viewBox="0 0 16 16">
                <circle cx="6.5" cy="6.5" r="4.5"/>
                <line x1="10" y1="10" x2="14" y2="14"/>
              </svg>
              <input
                type="text"
                placeholder={`Search ${TAB_LABELS[activeTab].toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-lg)] [color:var(--s-text-pri)] [padding:5px_8px_5px_26px] [font-size:var(--s-text-sm)] outline-none transition-[border-color] [transition-duration:0.1s] placeholder:[color:var(--s-text-ter)] focus:[border-color:var(--s-accent)] focus:[background:var(--s-bg-base)]"
              />
            </div>
          </div>
        )}

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "screens" && (
            <ScreensPanel projectId={projectId} currentScreen={screenName} />
          )}
          {activeTab === "layers" && <NodeTree />}
          {activeTab === "insert" && <ComponentPalette filterText={search} />}
          {activeTab === "ds" && (
            <DSPanel projectId={projectId} onOpenThemeEditor={onOpenThemeEditor} onOpenFonts={onOpenFonts} />
          )}
          {activeTab === "assets" && <AssetBrowser />}
        </div>
        <NodeCountStatus />
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Editor layout
// -------------------------------------------------------------------------

function PromoteSuggestionToast() {
  const suggestion = useEditorStore((s) => s.promoteSuggestion);
  const accept = useEditorStore((s) => s.acceptPromoteSuggestion);
  const dismiss = useEditorStore((s) => s.dismissPromoteSuggestion);

  React.useEffect(() => {
    if (!suggestion) return;
    const timer = setTimeout(dismiss, 8000);
    return () => clearTimeout(timer);
  }, [suggestion, dismiss]);

  if (!suggestion) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 [padding:10px_16px] [background:var(--s-bg-panel)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-lg)] [box-shadow:var(--s-shadow-lg)]">
      <span className="[font-size:var(--s-text-sm)] [color:var(--s-text-pri)]">{suggestion.message}</span>
      <button
        onClick={accept}
        className="[padding:4px_10px] [font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [background:var(--s-accent)] text-white border-none [border-radius:var(--s-r-md)] cursor-pointer hover:opacity-90"
      >
        Yes
      </button>
      <button
        onClick={dismiss}
        className="[padding:4px_10px] [font-size:var(--s-text-xs)] [color:var(--s-text-ter)] [background:transparent] border-none [border-radius:var(--s-r-md)] cursor-pointer hover:[color:var(--s-text-pri)]"
      >
        Dismiss
      </button>
    </div>
  );
}

// -------------------------------------------------------------------------

export function EditorLayout({
  screenName,
  projectId,
  onBack,
}: {
  screenName: string;
  projectId?: string | null;
  onBack: () => void;
}) {
  const addNode = useEditorStore((s) => s.addNode);
  const updateNode = useEditorStore((s) => s.updateNode);
  const moveNode = useEditorStore((s) => s.moveNode);
  const selectNode = useEditorStore((s) => s.selectNode);
  const spec = useEditorStore((s) => s.spec);
  const markClean = useEditorStore((s) => s.markClean);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const removeNode = useEditorStore((s) => s.removeNode);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const copyNode = useEditorStore((s) => s.copyNode);
  const pasteNode = useEditorStore((s) => s.pasteNode);
  const cutNode = useEditorStore((s) => s.cutNode);
  const duplicateNode = useEditorStore((s) => s.duplicateNode);
  const groupIntoStack = useEditorStore((s) => s.groupIntoStack);
  const groupSelectedIntoFrame = useEditorStore((s) => s.groupSelectedIntoFrame);
  const ungroupNode = useEditorStore((s) => s.ungroupNode);
  const moveNodeUp = useEditorStore((s) => s.moveNodeUp);
  const moveNodeDown = useEditorStore((s) => s.moveNodeDown);
  const moveNodeToFront = useEditorStore((s) => s.moveNodeToFront);
  const moveNodeToBack = useEditorStore((s) => s.moveNodeToBack);
  const nudgeNode = useEditorStore((s) => s.nudgeNode);
  const setRenamingNodeId = useEditorStore((s) => s.setRenamingNodeId);
  const addCustomComponent = useEditorStore((s) => s.addCustomComponent);
  const previewMode = useEditorStore((s) => s.previewMode);
  const openScreenTabs = useEditorStore((s) => s.openScreenTabs);
  const activeScreenTab = useEditorStore((s) => s.activeScreenTab);
  const closeTab = useEditorStore((s) => s.closeTab);
  const setProjectId = useEditorStore((s) => s.setProjectId);
  const loadDesignTokens = useEditorStore((s) => s.loadDesignTokens);
  const setArtboardWidthStore = useEditorStore((s) => s.setArtboardWidth);
  const setProjectFrameworkStore = useEditorStore((s) => s.setProjectFramework);
  const setDsId = useEditorStore((s) => s.setDsId);
  const setDsName = useEditorStore((s) => s.setDsName);

  const router = useRouter();

  const navigateToTab = useCallback((tabScreenName: string) => {
    const qs = projectId ? `?project=${projectId}` : "";
    router.push(`/studio/${tabScreenName}${qs}`);
  }, [router, projectId]);

  // Project metadata — fetched on mount; drives breadcrumb name, artboard width, framework presets, and DS link
  const [projectName, setProjectName] = React.useState<string>("");
  React.useEffect(() => {
    if (!projectId) return;
    fetch(`/api/studio/projects?id=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then((d: { project?: { name?: string; framework?: string; design_system_id?: string | null } }) => {
        if (d.project?.name) setProjectName(d.project.name);
        const fw = d.project?.framework ?? "nextjs";
        setProjectFrameworkStore(fw);
        // Restore artboard width from project config (Supabase), falling back to framework default
        const configWidth = d.project?.config?.artboardWidth;
        const restoredWidth = typeof configWidth === "number" ? configWidth : (fw === "expo" ? 393 : null);
        setArtboardWidthStore(restoredWidth);
        // Prime the store with the linked DS id so loadDesignTokens fallback never
        // depends on localStorage
        setDsId(d.project?.design_system_id ?? null);
        if (!d.project?.design_system_id) setDsName(null);
      })
      .catch(() => {});
  }, [projectId, setArtboardWidthStore, setProjectFrameworkStore, setDsId, setDsName]);

  const handleProjectNameChange = React.useCallback(async (newName: string) => {
    if (!projectId) return;
    setProjectName(newName);
    await fetch(`/api/studio/projects?id=${encodeURIComponent(projectId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    }).catch(() => {});
  }, [projectId]);

  const [draggedType, setDraggedType] = React.useState<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = React.useState<string | null>(null);
  const [draggedNodeType, setDraggedNodeType] = React.useState<string | null>(null);
  const [draggedAssetUrl, setDraggedAssetUrl] = React.useState<string | null>(null);
  const [draggedComposite, setDraggedComposite] = React.useState<{ name: string; tree: Node } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [hasCompiled, setHasCompiled] = React.useState(false);
  const hasCompiledRef = useRef(false);
  const [ctxMenu, setCtxMenu] = React.useState<{ x: number; y: number } | null>(null);
  const [showAIModal, setShowAIModal] = React.useState(false);
  const [showCommandPalette, setShowCommandPalette] = React.useState(false);
  const [showShortcutRef, setShowShortcutRef] = React.useState(false);
  const [showImportTokens, setShowImportTokens] = React.useState(false);
  const [showDSWizard, setShowDSWizard] = React.useState(false);
  const [showThemeEditor, setShowThemeEditor] = React.useState(false);
  const [showA11y, setShowA11y] = React.useState(false);
  const [showExport, setShowExport] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [githubConnected, setGithubConnected] = React.useState(false);
  const [showVersionHistory, setShowVersionHistory] = React.useState(false);
  const [compileError, setCompileError] = React.useState<string | null>(null);
  const [compileWarnings, setCompileWarnings] = React.useState<string[]>([]);

  // Panel resize state
  const MIN_PANEL_W = 232;
  const [leftPanelWidth, setLeftPanelWidth] = React.useState(MIN_PANEL_W);
  const [rightPanelWidth, setRightPanelWidth] = React.useState(MIN_PANEL_W);

  const startLeftResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = leftPanelWidth;
    const onMove = (me: MouseEvent) => setLeftPanelWidth(Math.max(MIN_PANEL_W, startW + me.clientX - startX));
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [leftPanelWidth]);

  const startRightResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = rightPanelWidth;
    const onMove = (me: MouseEvent) => setRightPanelWidth(Math.max(MIN_PANEL_W, startW - (me.clientX - startX)));
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [rightPanelWidth]);
  const [showWelcome, setShowWelcome] = React.useState(false);
  const [showGuide, setShowGuide] = React.useState(false);

  // Sync projectId into the store and immediately load DS tokens for this project
  React.useEffect(() => {
    setProjectId(projectId ?? null);
    if (projectId) loadDesignTokens();
  }, [projectId, setProjectId, loadDesignTokens]);

  // Load GitHub connection status from project settings
  React.useEffect(() => {
    try {
      const key = `studio-project-settings-${projectId ?? "default"}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        const s = JSON.parse(saved);
        setGithubConnected(!!s.githubPat);
      }
    } catch { /* ignore */ }
  }, [projectId]);

  // Welcome modal is now triggered from the projects list page (project creation wizard).
  // Removed the first-visit localStorage trigger — onboarding happens before entering the editor.

  const handleDismissWelcome = React.useCallback(() => {
    localStorage.setItem("studio-onboarded", "true");
    setShowWelcome(false);
    // Show tooltip guide after welcome modal
    const hasGuided = localStorage.getItem("studio-guided");
    if (!hasGuided) {
      setTimeout(() => setShowGuide(true), 500);
    }
  }, []);

  const handleCompleteGuide = React.useCallback(() => {
    localStorage.setItem("studio-guided", "true");
    setShowGuide(false);
  }, []);

  const setSpec = useEditorStore((s) => s.setSpec);
  const externalSpecChanged = useEditorStore((s) => s.externalSpecChanged);

  // v0.10.11: Watch spec/screens/ for external edits (Cursor, Claude Code)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!screenName) return;

    const es = new EventSource("/api/studio/specs/watch");
    es.addEventListener("spec-changed", (evt) => {
      try {
        const { screenName: changed } = JSON.parse((evt as MessageEvent).data) as { screenName: string };
        if (changed !== screenName) return;
        // Re-fetch the spec from the API and apply it
        const url = projectId
          ? `/api/studio/screens/${screenName}?projectId=${projectId}`
          : `/api/studio/screens/${screenName}`;
        fetch(url)
          .then((r) => r.json())
          .then((data) => {
            if (data.spec) {
              externalSpecChanged(data.spec);
            }
          })
          .catch(() => {});
      } catch {
        // ignore malformed events
      }
    });

    es.onerror = () => {
      es.close();
    };

    return () => {
      es.close();
    };
  }, [screenName, projectId, externalSpecChanged]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Save handler (defined before keyboard shortcuts so it can be referenced)
  const handleSave = useCallback(async () => {
    if (!spec || !screenName) return;
    setSaving(true);
    try {
      await fetch(`/api/studio/screens/${screenName}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec, ...(projectId ? { projectId } : {}) }),
      });
      markClean();
      fetch("/api/studio/versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ screenName, spec }),
      }).catch(() => {});
      // Persist design change log
      const changes = useEditorStore.getState().designChanges;
      if (changes.length > 0) {
        fetch("/api/studio/changelog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changes }),
        }).catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      toast.error(`Failed to save: ${msg}`);
    } finally {
      setSaving(false);
    }
    // Compile in background — does not block saving state
    if (projectId) {
      fetch("/api/studio/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (!d.error) {
            setHasCompiled(true);
            hasCompiledRef.current = true;
          }
        })
        .catch(() => {});
    }
  }, [spec, screenName, projectId, markClean]);

  // Auto-save: debounced 3 seconds after last change
  const dirty = useEditorStore((s) => s.dirty);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset compiled indicator when spec changes
  useEffect(() => {
    if (dirty) { setHasCompiled(false); hasCompiledRef.current = false; }
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [dirty, handleSave]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT";

      // Cmd/Ctrl+S -- save & compile
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }

      // Cmd/Ctrl+P -- open preview page (compiled page with Studio topbar)
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        if (!spec) return;
        const fw = useEditorStore.getState().projectFramework;
        const dsId = useEditorStore.getState().dsId;
        const qs = new URLSearchParams({
          route: spec.route,
          screen: screenName,
          returnTo: `/studio/${screenName}${projectId ? `?project=${projectId}` : ""}`,
          ...(fw ? { framework: fw } : {}),
          ...(projectId ? { projectId } : {}),
          ...(dsId ? { dsId } : {}),
        });
        router.push(`/preview?${qs.toString()}`);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }
      // Cut (Cmd+X)
      if ((e.metaKey || e.ctrlKey) && e.key === "x" && !isInput) {
        e.preventDefault();
        cutNode();
        return;
      }
      // Copy
      if ((e.metaKey || e.ctrlKey) && e.key === "c" && !isInput) {
        e.preventDefault();
        copyNode();
        return;
      }
      // Paste
      if ((e.metaKey || e.ctrlKey) && e.key === "v" && !isInput) {
        e.preventDefault();
        pasteNode();
        return;
      }
      // Duplicate (Cmd+D)
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && !isInput) {
        e.preventDefault();
        duplicateNode();
        return;
      }
      // Group into frame (Cmd+G)
      if ((e.metaKey || e.ctrlKey) && e.key === "g" && !isInput) {
        e.preventDefault();
        if (e.shiftKey) {
          ungroupNode();
        } else {
          groupSelectedIntoFrame();
        }
        return;
      }
      // Layer ordering: Cmd+] forward, Cmd+[ backward, Cmd+Shift+] front, Cmd+Shift+[ back
      if ((e.metaKey || e.ctrlKey) && e.key === "]" && !isInput) {
        e.preventDefault();
        if (e.shiftKey) {
          moveNodeToFront();
        } else {
          moveNodeDown();
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "[" && !isInput) {
        e.preventDefault();
        if (e.shiftKey) {
          moveNodeToBack();
        } else {
          moveNodeUp();
        }
        return;
      }
      // Enter group (Cmd+Enter) — select first child of the currently selected node
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && !isInput) {
        e.preventDefault();
        if (selectedNodeId && spec) {
          function findStudioNode(root: Node, id: string): Node | null {
            if (root.id === id) return root;
            for (const c of root.children ?? []) {
              const found = findStudioNode(c, id);
              if (found) return found;
            }
            return null;
          }
          const target = findStudioNode(spec.tree, selectedNodeId);
          if (target?.children && target.children.length > 0) {
            selectNode(target.children[0].id);
          }
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (isInput) return;
        if (selectedNodeId && spec && selectedNodeId !== spec.tree.id) {
          e.preventDefault();
          removeNode(selectedNodeId);
        }
        return;
      }
      if (e.key === "Escape") {
        setCtxMenu(null);
        setShowCommandPalette(false);
        setShowShortcutRef(false);
        selectNode(null);
        return;
      }
      // Arrow key nudge (only when a node is selected and not in an input)
      if (!isInput && (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        if (selectedNodeId && spec && selectedNodeId !== spec.tree.id) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
          const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
          nudgeNode(dx, dy);
        }
        return;
      }

      // --- Single-key shortcuts (only when not in an input) ---
      if (isInput || e.metaKey || e.ctrlKey || e.altKey) return;

      // F2 -- rename selected node (R is reserved for Rectangle tool)
      if (e.key === "F2") {
        if (selectedNodeId && spec && selectedNodeId !== spec.tree.id) {
          e.preventDefault();
          setRenamingNodeId(selectedNodeId);
        }
        return;
      }
      // G -- group selected node into a Stack (single key, no Cmd)
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        groupIntoStack();
        return;
      }
      // D -- switch to Design mode
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        useEditorStore.getState().setCanvasMode("design");
        return;
      }
      // B -- switch to Build mode
      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        useEditorStore.getState().setCanvasMode("build");
        return;
      }
      // E -- focus first property panel field
      if (e.key === "e" || e.key === "E") {
        if (selectedNodeId) {
          e.preventDefault();
          const panel = document.querySelector("[data-property-panel]") as HTMLElement | null;
          const firstInput = panel?.querySelector<HTMLInputElement | HTMLSelectElement>("input, select");
          firstInput?.focus();
        }
        return;
      }
      // ? -- open shortcut reference overlay
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcutRef(true);
        return;
      }
      // Drawing tool shortcuts (Design Mode only)
      const toolKeys: Record<string, "select" | "frame" | "rectangle" | "ellipse" | "text" | "line" | "pan"> = {
        v: "select", V: "select",
        a: "frame", A: "frame",
        f: "frame", F: "frame",
        r: "rectangle", R: "rectangle",
        o: "ellipse", O: "ellipse",
        t: "text", T: "text",
        l: "line", L: "line",
        h: "pan", H: "pan",
      };
      if (toolKeys[e.key]) {
        const tool = toolKeys[e.key];
        if (tool === "select" || tool === "pan" || useEditorStore.getState().canvasMode === "design") {
          e.preventDefault();
          useEditorStore.getState().setCurrentTool(tool);
          return;
        }
      }
      // Escape resets to select tool
      if (e.key === "Escape" && useEditorStore.getState().currentTool !== "select") {
        e.preventDefault();
        useEditorStore.getState().setCurrentTool("select");
        return;
      }
      // / -- open command palette
      if (e.key === "/") {
        e.preventDefault();
        setShowCommandPalette(true);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo, removeNode, selectNode, selectedNodeId, spec, copyNode, cutNode, pasteNode, duplicateNode, handleSave, groupIntoStack, groupSelectedIntoFrame, ungroupNode, moveNodeUp, moveNodeDown, moveNodeToFront, moveNodeToBack, nudgeNode, setRenamingNodeId, screenName, projectId, router]);

  // Build a new node from a palette type
  const buildNewNode = useCallback(
    (nodeType: string, initialProps?: Record<string, unknown>) => {
      const schema = NODE_SCHEMAS[nodeType];
      const defaultProps: Record<string, unknown> = {};
      if (schema) {
        Object.entries(schema.props).forEach(([key, def]) => {
          if (def.defaultValue !== undefined) {
            defaultProps[key] = def.defaultValue;
          }
        });
      }
      const mergedProps = initialProps ? { ...defaultProps, ...initialProps } : defaultProps;

      // Text-bearing nodes default to hug sizing (like Figma text auto-resize)
      const TEXT_HUG_TYPES = new Set(["Heading", "Text"]);
      const defaultStyle = TEXT_HUG_TYPES.has(nodeType)
        ? { widthMode: "hug" as const, heightMode: "hug" as const }
        : undefined;

      return {
        id: generateId(nodeType.toLowerCase()),
        type: nodeType,
        name: schema?.label ?? nodeType,
        props: Object.keys(mergedProps).length > 0 ? mergedProps : undefined,
        style: defaultStyle,
        children: schema?.acceptsChildren ? [] : undefined,
      };
    },
    []
  );

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "palette") {
      setDraggedType(data.nodeType as string);
    } else if (data?.type === "canvas-node") {
      setDraggedNodeId(data.nodeId as string);
      setDraggedNodeType(data.nodeType as string);
    } else if (data?.type === "asset") {
      setDraggedAssetUrl(data.url as string);
    } else if (data?.type === "custom-component" || data?.type === "template-component") {
      setDraggedComposite({ name: data.name as string, tree: data.tree as Node });
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const wasPaletteDrag = !!draggedType;
      const wasCanvasDrag = !!draggedNodeId;
      const wasAssetDrag = !!draggedAssetUrl;
      const wasCompositeDrag = !!draggedComposite;
      const assetUrl = draggedAssetUrl;
      const compositeTree = draggedComposite?.tree;

      setDraggedType(null);
      setDraggedNodeId(null);
      setDraggedNodeType(null);
      setDraggedAssetUrl(null);
      setDraggedComposite(null);

      const { active, over } = event;
      if (!over || !spec) return;

      const activeData = active.data.current;
      const overData = over.data.current;

      // -------------------------------------------------------------------
      // Palette drag -> create a new node
      // -------------------------------------------------------------------
      if (wasPaletteDrag && activeData?.type === "palette") {
        const nodeType = activeData.nodeType as string;
        const initialProps = activeData.initialProps as Record<string, unknown> | undefined;
        const newNode = buildNewNode(nodeType, initialProps);

        if (overData?.type === "insertion") {
          const parentId = overData.parentId as string;
          const index = overData.index as number;
          addNode(parentId, newNode, index);
          selectNode(newNode.id);
          return;
        }

        if (overData?.type === "canvas") {
          const targetId = overData.nodeId as string;
          const isContainer = CONTAINER_TYPES.has(targetId) || spec.tree.id === targetId;
          if (isContainer) {
            addNode(targetId, newNode);
          } else {
            const parent = findParentContainer(spec.tree, targetId);
            addNode(parent?.id ?? spec.tree.id, newNode);
          }
          selectNode(newNode.id);
        }
        return;
      }

      // -------------------------------------------------------------------
      // Canvas-node drag -> move an existing node
      // -------------------------------------------------------------------
      if (wasCanvasDrag && activeData?.type === "canvas-node") {
        const nodeId = activeData.nodeId as string;

        if (overData?.type === "insertion") {
          const parentId = overData.parentId as string;
          const index = overData.index as number;

          // Prevent dropping a node into itself or its own descendants
          if (nodeId === parentId || isDescendant(spec.tree, nodeId, parentId)) return;

          moveNode(nodeId, parentId, index);
          return;
        }

        if (overData?.type === "canvas") {
          const targetId = overData.nodeId as string;

          // Prevent dropping into self or descendant
          if (nodeId === targetId || isDescendant(spec.tree, nodeId, targetId)) return;

          const isContainer = CONTAINER_TYPES.has(targetId) || spec.tree.id === targetId;
          if (isContainer) {
            const target = findNodeById(spec.tree, targetId);
            const newIndex = target?.children?.length ?? 0;
            moveNode(nodeId, targetId, newIndex);
          } else {
            const parent = findParentContainer(spec.tree, targetId);
            const parentNode = parent ? findNodeById(spec.tree, parent.id) : spec.tree;
            const newIndex = parentNode?.children?.length ?? 0;
            moveNode(nodeId, parent?.id ?? spec.tree.id, newIndex);
          }
        }
      }

      // -------------------------------------------------------------------
      // Asset drag -> create a new Image node with the asset URL
      // -------------------------------------------------------------------
      if (wasAssetDrag && assetUrl) {
        const newNode: Node = {
          id: generateId(),
          type: "Image",
          name: "Image",
          props: { src: assetUrl, alt: assetUrl.split("/").pop() ?? "image" },
        };

        if (overData?.type === "insertion") {
          const parentId = overData.parentId as string;
          const index = overData.index as number;
          addNode(parentId, newNode, index);
          selectNode(newNode.id);
          return;
        }

        if (overData?.type === "canvas") {
          const targetId = overData.nodeId as string;
          const isContainer = CONTAINER_TYPES.has(targetId) || spec.tree.id === targetId;
          if (isContainer) {
            addNode(targetId, newNode);
          } else {
            const parent = findParentContainer(spec.tree, targetId);
            addNode(parent?.id ?? spec.tree.id, newNode);
          }
          selectNode(newNode.id);
        }
      }

      // -------------------------------------------------------------------
      // Composite drag -> deep clone tree and insert
      // -------------------------------------------------------------------
      if (wasCompositeDrag && compositeTree) {
        const cloned = cloneWithNewIds(compositeTree as Node);

        if (overData?.type === "insertion") {
          const parentId = overData.parentId as string;
          const index = overData.index as number;
          addNode(parentId, cloned, index);
          selectNode(cloned.id);
          autoApplyTemplate(cloned);
          return;
        }

        if (overData?.type === "canvas") {
          const targetId = overData.nodeId as string;
          const isContainer = CONTAINER_TYPES.has(targetId) || spec.tree.id === targetId;
          if (isContainer) {
            addNode(targetId, cloned);
          } else {
            const parent = findParentContainer(spec.tree, targetId);
            addNode(parent?.id ?? spec.tree.id, cloned);
          }
          selectNode(cloned.id);
          autoApplyTemplate(cloned);
        }
      }
    },
    [spec, addNode, updateNode, buildNewNode, moveNode, selectNode, draggedType, draggedNodeId, draggedAssetUrl, draggedComposite]
  );

  // Auto-fetch and apply defaultTemplate when a ComponentInstance lands with no children.
  // This handles the case where the stored DS component has no defaultTemplate (applied
  // before v0.10.4 was shipped). Runs asynchronously so the node is on canvas immediately.
  function autoApplyTemplate(node: Node) {
    if (node.type !== "ComponentInstance") return;
    if (node.children && node.children.length > 0) return;
    const componentName = (node.props as Record<string, unknown>)?.componentName as string | undefined;
    if (!componentName) return;

    const importPath = (node.props as Record<string, unknown>)?.importPath as string | undefined;
    const params = new URLSearchParams({ component: componentName });
    if (importPath?.startsWith("studio:")) {
      // studio:* is a virtual path — no starter has a matching packageName.
      // The studio-minimal-web starter owns all studio:shadcn components.
      params.set("starter", "studio-minimal-web");
    } else if (importPath) {
      // Real npm package: let the API scope by packageName.
      params.set("importPath", importPath);
    }
    // No importPath → fall through to "search all starters" (rare, legacy nodes).

    fetch(`/api/studio/ds-starters?${params.toString()}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { defaultTemplate?: { children?: Node[] }; defaultNodeStyle?: Record<string, unknown> } | null) => {
        const children = data?.defaultTemplate?.children;
        const nodeStyle = data?.defaultNodeStyle;
        const updates: Partial<Node> = {};

        if (children && children.length > 0) {
          updates.children = (children as Node[]).map((n) =>
            cloneWithNewIds({ id: n.id ?? generateId(), ...n } as Node)
          );
        }

        if (nodeStyle && typeof nodeStyle === "object") {
          // Merge defaultNodeStyle into the node's existing style (never overwrite user overrides)
          const existing = (node.style as Record<string, unknown> | undefined) ?? {};
          updates.style = { ...nodeStyle, ...existing };
        }

        if (Object.keys(updates).length > 0) {
          updateNode(node.id, updates);
        }
      })
      .catch(() => { /* silently ignore — user can still restore manually */ });
  }

  return (
    <div
      className="studio-shell flex flex-col h-screen"
      onContextMenu={(e) => {
        if (previewMode) return;
        const target = e.target as HTMLElement;
        if (target.closest("[data-studio-node]")) {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }
      }}
    >
      <TopBar
        screenName={screenName}
        projectName={projectName || undefined}
        onProjectNameChange={projectId ? handleProjectNameChange : undefined}
        onSave={handleSave}
        onBack={onBack}
        onAIGenerate={() => setShowAIModal(true)}
        onExport={() => setShowExport(true)}
        onHistory={() => setShowVersionHistory(true)}
        onPreview={() => {
          if (!spec) return;
          const fw = useEditorStore.getState().projectFramework;
          const dsId = useEditorStore.getState().dsId;
          const qs = new URLSearchParams({
            route: spec.route,
            screen: screenName,
            returnTo: `/studio/${screenName}${projectId ? `?project=${projectId}` : ""}`,
            ...(fw ? { framework: fw } : {}),
            ...(projectId ? { projectId } : {}),
            ...(dsId ? { dsId } : {}),
          });
          router.push(`/preview?${qs.toString()}`);
        }}
        onSettings={() => setShowSettings(true)}
        hasCompiled={hasCompiled}
        saving={saving}
        githubConnected={githubConnected}
      />
      <DndContext
        sensors={sensors}
        modifiers={[snapToGridModifier]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar -- Tabbed panels (hidden in preview mode) */}
          {!previewMode && (
            <LeftSidebar
              projectId={projectId}
              screenName={screenName}
              width={leftPanelWidth}
              onOpenThemeEditor={() => setShowThemeEditor(true)}
              onOpenFonts={() => {/* FontPicker is now inside DS panel; no separate state needed */}}
            />
          )}
          {!previewMode && <ResizeHandle onMouseDown={startLeftResize} />}

          {/* Centre -- Canvas */}
          <div data-guide="canvas" className="flex-1 overflow-hidden flex flex-col">
            {/* Artboard tab strip (hidden in preview mode, only shown when multiple tabs open) */}
            {!previewMode && openScreenTabs.length > 1 && (
              <div className="flex items-center [border-bottom:1px_solid_var(--s-border)] [background:var(--s-bg-base)] overflow-x-auto shrink-0 [height:34px]">
                {openScreenTabs.slice(0, 5).map((tabName) => {
                  const isActive = tabName === activeScreenTab;
                  return (
                    <div
                      key={tabName}
                      className={`flex items-center gap-1 [padding:0_10px] h-full shrink-0 border-r [border-color:var(--s-border)] cursor-pointer transition-colors group ${
                        isActive
                          ? "[background:var(--s-bg-panel)] [color:var(--s-text-pri)] [border-bottom:2px_solid_var(--s-accent)]"
                          : "[color:var(--s-text-ter)] hover:[color:var(--s-text-pri)] hover:[background:var(--s-bg-subtle)]"
                      }`}
                      onClick={() => navigateToTab(tabName)}
                    >
                      <span className="text-[11px] font-medium truncate max-w-[100px]">{tabName}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); closeTab(tabName); if (isActive && openScreenTabs.length > 1) { const others = openScreenTabs.filter(t => t !== tabName); navigateToTab(others[others.length - 1]); } }}
                        className="w-4 h-4 flex items-center justify-center rounded-sm text-[10px] opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:[color:var(--s-text-pri)] transition-opacity"
                        title="Close tab"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                {openScreenTabs.length > 5 && (
                  <span className="text-[11px] [color:var(--s-text-ter)] [padding:0_8px]">+{openScreenTabs.length - 5} more</span>
                )}
              </div>
            )}

            {compileError && !previewMode && (
              <div className="px-4 py-2 text-sm bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                <div className="flex items-center gap-2">
                  <span className="font-medium">Compile warning:</span>
                  <span className="flex-1 truncate">{compileError}</span>
                  <button
                    onClick={() => { setCompileError(null); setCompileWarnings([]); }}
                    className="ml-auto text-amber-600 hover:text-amber-900 dark:hover:text-amber-100 font-bold shrink-0"
                  >
                    &times;
                  </button>
                </div>
                {compileWarnings.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {compileWarnings.map((w, i) => (
                      <li key={i} className="text-[11px] font-mono truncate opacity-80">{w}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="relative flex-1 min-h-0">
              {!previewMode && <FloatingAlignBar />}
              <CanvasErrorBoundary>
              <EditorCanvas
                isDragging={!previewMode && (!!draggedType || !!draggedNodeId || !!draggedAssetUrl || !!draggedComposite)}
                previewMode={previewMode}
                onQuickStart={(action) => {
                  const spec = useEditorStore.getState().spec;
                  if (!spec) return;
                  const addNode = useEditorStore.getState().addNode;
                  const selectNode = useEditorStore.getState().selectNode;
                  if (action === "stack") {
                    const newNode: Node = {
                      id: generateId(),
                      type: "Stack",
                      name: "Stack",
                      props: { gap: "md", padding: "lg" },
                      children: [
                        { id: generateId(), type: "Heading", name: "Heading", props: { text: "Hello" } },
                        { id: generateId(), type: "Text", name: "Text", props: { text: "Start building your screen" } },
                      ],
                    };
                    addNode(spec.tree.id, newNode);
                    selectNode(newNode.id);
                  }
                }}
              />
            </CanvasErrorBoundary>
            </div>
          </div>

          {/* Right sidebar -- Property panel (hidden in preview mode) */}
          {!previewMode && <ResizeHandle onMouseDown={startRightResize} />}
          {!previewMode && (
            <div data-guide="properties" data-property-panel className="shrink-0 overflow-hidden [background:var(--s-bg-panel)]" style={{ width: rightPanelWidth }}>
              <PropertyPanel />
            </div>
          )}
        </div>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {draggedType ? (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-[#6c47ff] bg-white dark:bg-zinc-900 shadow-[0_4px_20px_rgba(108,71,255,0.35)] text-sm font-semibold text-[#6c47ff] pointer-events-none"
              style={{ opacity: 0.92 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
              {NODE_SCHEMAS[draggedType]?.label ?? draggedType}
            </div>
          ) : draggedNodeType ? (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-[#6c47ff]/60 bg-[#6c47ff]/10 dark:bg-[#6c47ff]/20 shadow-[0_4px_20px_rgba(108,71,255,0.3)] text-sm font-semibold text-[#6c47ff] pointer-events-none"
              style={{ opacity: 0.92 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 9l7-7 7 7M5 15l7 7 7-7"/></svg>
              {NODE_SCHEMAS[draggedNodeType]?.label ?? draggedNodeType}
            </div>
          ) : draggedAssetUrl ? (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 shadow-[0_4px_20px_rgba(16,185,129,0.3)] text-sm font-semibold text-emerald-700 dark:text-emerald-300 pointer-events-none"
              style={{ opacity: 0.92 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              Image
            </div>
          ) : draggedComposite ? (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-[#6c47ff] bg-[#6c47ff] shadow-[0_4px_20px_rgba(108,71,255,0.45)] text-sm font-semibold text-white pointer-events-none"
              style={{ opacity: 0.92 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M3 9h18"/></svg>
              {draggedComposite.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Right-click context menu */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} />
      )}

      {/* Command palette */}
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          hasSelection={!!selectedNodeId}
          isRoot={!!(selectedNodeId && spec && selectedNodeId === spec.tree.id)}
          actions={{
            undo,
            redo,
            copyNode,
            pasteNode,
            duplicateNode,
            deleteNode: () => {
              if (selectedNodeId && spec && selectedNodeId !== spec.tree.id) {
                removeNode(selectedNodeId);
              }
            },
            groupIntoStack,
            renameNode: () => {
              if (selectedNodeId && spec && selectedNodeId !== spec.tree.id) {
                setRenamingNodeId(selectedNodeId);
              }
            },
            createComponent: () => {
              if (selectedNodeId && spec && selectedNodeId !== spec.tree.id) {
                const name = window.prompt("Component name:");
                if (name && name.trim()) {
                  const tree = findNodeById(spec.tree, selectedNodeId);
                  if (tree) {
                    fetch("/api/studio/components", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ name: name.trim(), description: "", tree }),
                    })
                      .then((res) => res.json())
                      .then((data) => {
                        if (data.component) addCustomComponent(data.component);
                      })
                      .catch(() => { toast.error("Failed to save component"); });
                  }
                }
              }
            },
            importDesignSystem: () => setShowImportTokens(true),
            createDesignSystem: () => setShowDSWizard(true),
            openThemeEditor: () => setShowThemeEditor(true),
            openA11yPanel: () => setShowA11y(true),
            save: handleSave,
            batchSpacing: () => {
              const val = window.prompt("Set spacing (px) for all elements (margin + padding):", "16");
              if (!val) return;
              const px = parseInt(val, 10);
              if (isNaN(px) || px < 0) return;
              const s = useEditorStore.getState();
              if (!s.spec) return;
              const walk = (node: Node) => {
                s.updateNodeStyle(node.id, {
                  marginTop: `${px}px`, marginRight: `${px}px`, marginBottom: `${px}px`, marginLeft: `${px}px`,
                  paddingTop: `${px}px`, paddingRight: `${px}px`, paddingBottom: `${px}px`, paddingLeft: `${px}px`,
                });
                node.children?.forEach(walk);
              };
              walk(s.spec.tree);
            },
            insertNode: (nodeType: string) => {
              const newNode = buildNewNode(nodeType);
              const targetId =
                selectedNodeId && spec
                  ? selectedNodeId
                  : spec?.tree.id;
              if (targetId) addNode(targetId, newNode);
            },
            navigateToScreen: (screen: string) => {
              window.location.href = projectId
                ? `/studio/${screen}?project=${projectId}`
                : `/studio/${screen}`;
            },
          }}
        />
      )}

      {/* Import design system modal */}
      {showImportTokens && (
        <ImportTokensModal onClose={() => setShowImportTokens(false)} />
      )}

      {/* Design system wizard */}
      {showDSWizard && (
        <DSWizard onClose={() => setShowDSWizard(false)} />
      )}

      {/* Theme editor */}
      {showThemeEditor && (
        <ThemeEditor onClose={() => setShowThemeEditor(false)} />
      )}

      {/* Accessibility checker */}
      {showA11y && (
        <A11yPanel onClose={() => setShowA11y(false)} />
      )}

      {/* Export modal */}
      {showExport && (
        <ExportModal onClose={() => setShowExport(false)} />
      )}

      {/* Project Settings panel */}
      {showSettings && (
        <ProjectSettingsPanel
          projectId={projectId}
          onClose={() => setShowSettings(false)}
          onSettingsChange={(s) => setGithubConnected(!!s.githubPat)}
        />
      )}

      {/* Version history panel */}
      {showVersionHistory && (
        <VersionHistory
          screenName={screenName}
          currentSpec={spec as unknown as Record<string, unknown>}
          onRestore={(restoredSpec) => {
            setSpec(restoredSpec as import("@/lib/studio/types").ScreenSpec, screenName);
          }}
          onClose={() => setShowVersionHistory(false)}
        />
      )}

      {/* Onboarding: Welcome modal */}
      {showWelcome && (
        <WelcomeModal onDismiss={handleDismissWelcome} />
      )}

      {/* Onboarding: Tooltip guide */}
      {showGuide && !previewMode && (
        <TooltipGuide onComplete={handleCompleteGuide} />
      )}

      {/* Promote suggestion toast */}
      <PromoteSuggestionToast />

      {/* Shortcut reference overlay (? key) */}
      {showShortcutRef && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setShowShortcutRef(false)}
        >
          <div
            className="bg-popover border rounded-xl shadow-2xl w-[580px] max-h-[80vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Keyboard Shortcuts</h2>
              <button
                className="text-muted-foreground hover:text-foreground text-sm"
                onClick={() => setShowShortcutRef(false)}
              >
                Esc to close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-0.5 text-[12px]">
              {[
                { section: "Tools" },
                { key: "V", label: "Select" },
                { key: "A / F", label: "Frame" },
                { key: "R", label: "Rectangle" },
                { key: "T", label: "Text" },
                { key: "H", label: "Pan" },
                { key: "Esc", label: "Deselect / cancel tool" },
                { section: "Node Operations" },
                { key: "⌘D", label: "Duplicate" },
                { key: "⌘X", label: "Cut" },
                { key: "⌘C / ⌘V", label: "Copy / Paste" },
                { key: "Del / ⌫", label: "Delete" },
                { key: "⌘Z / ⌘⇧Z", label: "Undo / Redo" },
                { section: "Layer Ordering" },
                { key: "⌘]", label: "Bring forward" },
                { key: "⌘[", label: "Send backward" },
                { key: "⌘⇧]", label: "Bring to front" },
                { key: "⌘⇧[", label: "Send to back" },
                { section: "Nudge" },
                { key: "↑ ↓ ← →", label: "Nudge 1px" },
                { key: "⇧ + Arrow", label: "Nudge 10px" },
                { section: "Grouping" },
                { key: "⌘G", label: "Group into frame" },
                { key: "⌘⇧G", label: "Ungroup" },
                { key: "⌘↵", label: "Enter group" },
                { section: "Canvas" },
                { key: "D", label: "Design mode" },
                { key: "B", label: "Build mode" },
                { key: "E", label: "Focus properties" },
                { key: "⌘S", label: "Save" },
                { key: "⌘P", label: "Preview" },
                { key: "/", label: "Command palette" },
                { key: "?", label: "Shortcut reference" },
              ].map((item, i) =>
                item.section ? (
                  <div key={i} className="col-span-2 mt-3 mb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b pb-1">
                    {item.section}
                  </div>
                ) : (
                  <div key={i} className="flex items-center justify-between py-0.5">
                    <span className="text-muted-foreground">{item.label}</span>
                    <kbd className="ml-4 font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded border border-border">
                      {item.key}
                    </kbd>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
