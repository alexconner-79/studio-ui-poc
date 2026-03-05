"use client";

import React, { useEffect, useState, useCallback, useRef, useContext } from "react";
import { useEditorStore } from "@/lib/studio/store";
import type { Node } from "@/lib/studio/types";
import { useA11yIssues, type A11yIssue } from "./a11y-panel";
import { CanvasControlsContext } from "./canvas-container";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Rect = { top: number; left: number; width: number; height: number };

type BadgeData = {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  isSelected: boolean;
  isDesignOnly: boolean;
  isLocked: boolean;
  hasA11yError: boolean;
  hasA11yWarning: boolean;
  a11yTitle: string;
  hasInteractions: boolean;
  interactionTitle: string;
  hasDataSource: boolean;
  dataSourceTitle: string;
  isTinyNode: boolean;
};

// ---------------------------------------------------------------------------
// Walk the spec tree and collect nodes that need at least one badge
// ---------------------------------------------------------------------------

function collectBadgeNodes(
  node: Node,
  selectedIds: Set<string>,
  hiddenIds: Set<string>,
  lockedIds: Set<string>,
  a11yMap: Map<string, { hasError: boolean; hasWarning: boolean; title: string }>,
  out: BadgeData[],
) {
  if (hiddenIds.has(node.id)) return;

  const isSelected = selectedIds.has(node.id);
  const isDesignOnly = node.compile === false;
  const isLocked = lockedIds.has(node.id);
  const a11y = a11yMap.get(node.id);
  const hasA11yWarning = !!a11y?.hasWarning;
  const hasInteractions = !!(node.interactions?.onClick || node.interactions?.onChange || node.interactions?.visibleWhen);
  const hasDataSource = !!node.dataSource;

  const needsBadge =
    isSelected ||
    isDesignOnly ||
    (isLocked && !isSelected) ||
    hasA11yWarning ||
    hasInteractions ||
    hasDataSource;

  if (needsBadge) {
    const parseStylePx = (v: unknown) => {
      if (typeof v !== "string") return null;
      const m = v.match(/^([\d.]+)px$/);
      return m ? parseFloat(m[1]) : null;
    };
    const w = parseStylePx(node.style?.width);
    const h = parseStylePx(node.style?.height);
    const isTinyNode = (w !== null && w < 40) || (h !== null && h < 40);

    const interactionTitle = hasInteractions
      ? [
          node.interactions?.onClick ? `onClick: ${node.interactions.onClick.action}` : "",
          node.interactions?.onChange ? `onChange: ${node.interactions.onChange.action}` : "",
          node.interactions?.visibleWhen ? `visible when: ${node.interactions.visibleWhen.state}` : "",
        ].filter(Boolean).join(", ")
      : "";

    const dataSourceTitle = hasDataSource
      ? `Data: ${node.dataSource?.type}${node.dataSource?.url ? ` (${node.dataSource.url})` : ""}`
      : "";

    out.push({
      nodeId: node.id,
      nodeName: node.name ?? node.type,
      nodeType: node.type,
      isSelected,
      isDesignOnly,
      isLocked,
      hasA11yError: !!a11y?.hasError,
      hasA11yWarning,
      a11yTitle: a11y?.title ?? "",
      hasInteractions,
      interactionTitle,
      hasDataSource,
      dataSourceTitle,
      isTinyNode,
    });
  }

  if (node.children) {
    for (const child of node.children) {
      collectBadgeNodes(child, selectedIds, hiddenIds, lockedIds, a11yMap, out);
    }
  }
}

// ---------------------------------------------------------------------------
// Measure DOM elements for badge positioning
// ---------------------------------------------------------------------------

function measureNodes(
  nodeIds: string[],
  canvasEl: HTMLElement,
  scale: number,
): Map<string, Rect> {
  const rects = new Map<string, Rect>();
  const canvasRect = canvasEl.getBoundingClientRect();
  for (const id of nodeIds) {
    const el = canvasEl.querySelector(`[data-studio-node="${id}"]`) as HTMLElement | null;
    if (!el) continue;
    const r = el.getBoundingClientRect();
    rects.set(id, {
      top: (r.top - canvasRect.top) / scale,
      left: (r.left - canvasRect.left) / scale,
      width: r.width / scale,
      height: r.height / scale,
    });
  }
  return rects;
}

function getScale(el: HTMLElement): number {
  const t = el.closest("[data-canvas-transform]") as HTMLElement | null;
  if (!t) return 1;
  const m = t.style.transform.match(/scale\(([\d.]+)\)/);
  return m ? parseFloat(m[1]) : 1;
}

// ---------------------------------------------------------------------------
// Badge components
// ---------------------------------------------------------------------------

function NameLabel({
  rect,
  name,
  isDesignOnly,
  isLocked,
  inv,
}: {
  rect: Rect;
  name: string;
  isDesignOnly: boolean;
  isLocked: boolean;
  inv: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: rect.top,
        left: rect.left,
        transform: "translateY(-100%)",
        background: isDesignOnly ? "var(--s-warning)" : "var(--s-accent)",
        color: "#fff",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: `${11 * inv}px`,
        padding: `${2.5 * inv}px ${5 * inv}px`,
        borderRadius: `${3 * inv}px ${3 * inv}px 0 0`,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        display: "flex",
        alignItems: "center",
        gap: `${4 * inv}px`,
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      {isDesignOnly && <span style={{ fontSize: `${9 * inv}px`, opacity: 0.85 }}>Design</span>}
      {name}
      {isLocked && (
        <svg xmlns="http://www.w3.org/2000/svg" width={`${10 * inv}`} height={`${10 * inv}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )}
    </div>
  );
}

function DesignOnlyStripe({ rect }: { rect: Rect }) {
  return (
    <div
      style={{
        position: "absolute",
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        borderRadius: 2,
        background: "repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(234,179,8,0.1) 5px, rgba(234,179,8,0.1) 6px)",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}

function DesignOnlyBadge({ rect, isTiny }: { rect: Rect; isTiny: boolean }) {
  if (isTiny) {
    return (
      <div
        style={{
          position: "absolute",
          top: rect.top,
          left: rect.left + rect.width - 6,
          width: 6,
          height: 6,
          background: "rgba(234,179,8,0.9)",
          borderRadius: "0 2px 0 2px",
          pointerEvents: "none",
          zIndex: 9,
        }}
      />
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        top: rect.top - 18,
        left: rect.left + rect.width,
        transform: "translateX(-100%)",
        background: "rgba(234,179,8,0.92)",
        color: "#78350f",
        fontSize: 9,
        fontWeight: 600,
        padding: "2px 5px",
        borderRadius: "3px 3px 0 3px",
        whiteSpace: "nowrap",
        lineHeight: 1.2,
        display: "flex",
        alignItems: "center",
        gap: 2,
        pointerEvents: "none",
        zIndex: 9,
      }}
    >
      <svg width="8" height="8" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2L2 12h12Z"/><line x1="8" y1="7" x2="8" y2="9"/><circle cx="8" cy="11.5" r="0.5" fill="currentColor"/></svg>
      Design only
    </div>
  );
}

function LockBadge({ rect }: { rect: Rect }) {
  return (
    <div
      style={{
        position: "absolute",
        top: rect.top,
        left: rect.left + rect.width,
        transform: "translateX(-100%)",
        background: "#f97316",
        color: "#fff",
        fontSize: 8,
        padding: "2px 4px",
        borderRadius: "0 0 0 4px",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </div>
  );
}

function A11yBadge({ rect, hasError, title }: { rect: Rect; hasError: boolean; title: string }) {
  return (
    <div
      title={title}
      style={{
        position: "absolute",
        top: rect.top - 4,
        left: rect.left + rect.width - 4,
        width: 16,
        height: 16,
        borderRadius: "50%",
        background: hasError ? "#ef4444" : "#f59e0b",
        color: "#fff",
        fontSize: 8,
        fontWeight: 700,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      !
    </div>
  );
}

function InteractionBadge({ rect, title }: { rect: Rect; title: string }) {
  return (
    <div
      title={title}
      style={{
        position: "absolute",
        top: rect.top,
        left: rect.left + rect.width,
        transform: "translateX(-100%)",
        background: "#a855f7",
        color: "#fff",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 8,
        padding: "2px 4px",
        borderRadius: "0 0 0 4px",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      ⚡
    </div>
  );
}

function DataSourceBadge({ rect, title }: { rect: Rect; title: string }) {
  return (
    <div
      title={title}
      style={{
        position: "absolute",
        top: rect.top + rect.height,
        left: rect.left + rect.width,
        transform: "translate(-100%, -100%)",
        background: "#16a34a",
        color: "#fff",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 8,
        padding: "2px 4px",
        borderRadius: "4px 0 0 0",
        pointerEvents: "none",
        zIndex: 10,
      }}
    >
      📊
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main overlay component
// ---------------------------------------------------------------------------

export function NodeChromeOverlay() {
  const overlayRef = useRef<HTMLDivElement>(null);
  const spec = useEditorStore((s) => s.spec);
  const selectedNodeIds = useEditorStore((s) => s.selectedNodeIds);
  const hiddenNodeIds = useEditorStore((s) => s.hiddenNodeIds);
  const lockedNodeIds = useEditorStore((s) => s.lockedNodeIds);
  const canvasMode = useEditorStore((s) => s.canvasMode);
  const { scale } = useContext(CanvasControlsContext);
  const inv = 1 / (scale || 1);

  const a11yIssues = useA11yIssues();

  const a11yMap = React.useMemo(() => {
    const map = new Map<string, { hasError: boolean; hasWarning: boolean; title: string }>();
    for (const issue of a11yIssues) {
      const existing = map.get(issue.nodeId);
      if (existing) {
        existing.hasError = existing.hasError || issue.severity === "error";
        existing.hasWarning = true;
        existing.title += "; " + issue.message;
      } else {
        map.set(issue.nodeId, {
          hasError: issue.severity === "error",
          hasWarning: true,
          title: issue.message,
        });
      }
    }
    return map;
  }, [a11yIssues]);

  const badgeNodes = React.useMemo(() => {
    if (!spec) return [];
    const out: BadgeData[] = [];
    collectBadgeNodes(spec.tree, selectedNodeIds, hiddenNodeIds, lockedNodeIds, a11yMap, out);
    return out;
  }, [spec, selectedNodeIds, hiddenNodeIds, lockedNodeIds, a11yMap]);

  const [rects, setRects] = useState<Map<string, Rect>>(new Map());

  const measure = useCallback(() => {
    if (!overlayRef.current || badgeNodes.length === 0) {
      if (rects.size > 0) setRects(new Map());
      return;
    }
    const canvasEl = overlayRef.current.closest("[data-canvas-root]") as HTMLElement | null;
    if (!canvasEl) return;
    const s = getScale(canvasEl);
    const newRects = measureNodes(
      badgeNodes.map((b) => b.nodeId),
      canvasEl,
      s,
    );
    setRects(newRects);
  }, [badgeNodes, rects.size]);

  useEffect(() => {
    measure();
    const id = setInterval(measure, 300);
    return () => clearInterval(id);
  }, [measure]);

  if (badgeNodes.length === 0) return null;

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 45 }}
      data-node-chrome-overlay
    >
      {badgeNodes.map((badge) => {
        const rect = rects.get(badge.nodeId);
        if (!rect) return null;

        return (
          <React.Fragment key={badge.nodeId}>
            {/* Design-only stripe */}
            {badge.isDesignOnly && <DesignOnlyStripe rect={rect} />}

            {/* Design-only badge (when not selected) */}
            {badge.isDesignOnly && !badge.isSelected && (
              <DesignOnlyBadge rect={rect} isTiny={badge.isTinyNode} />
            )}

            {/* Name label (when selected) */}
            {badge.isSelected && (
              <NameLabel
                rect={rect}
                name={badge.nodeName}
                isDesignOnly={badge.isDesignOnly}
                isLocked={badge.isLocked}
                inv={inv}
              />
            )}

            {/* Lock badge (when locked and not selected) */}
            {badge.isLocked && !badge.isSelected && <LockBadge rect={rect} />}

            {/* A11y warning badge */}
            {badge.hasA11yWarning && (
              <A11yBadge rect={rect} hasError={badge.hasA11yError} title={badge.a11yTitle} />
            )}

            {/* Interaction badge */}
            {badge.hasInteractions && (
              <InteractionBadge rect={rect} title={badge.interactionTitle} />
            )}

            {/* Data source badge */}
            {badge.hasDataSource && (
              <DataSourceBadge rect={rect} title={badge.dataSourceTitle} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
