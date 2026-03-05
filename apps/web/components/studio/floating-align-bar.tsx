"use client";

/**
 * Floating align & distribute toolbar.
 * Appears at the top of the canvas area whenever 2+ nodes are selected.
 * Uses the same SVG icons and Studio CSS variables as the property panel.
 */

import React, { useCallback } from "react";
import { useEditorStore } from "@/lib/studio/store";
import { computeAlignment, computeDistribution, getNodeBBoxes, type AlignDirection, type DistributeAxis } from "@/lib/studio/geometry";

// ─── Shared icons (same paths as property-panel.tsx ALIGN_ICONS) ─────────────

const ICONS: Record<string, React.ReactNode> = {
  "align-left": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="1" x2="1" y2="13" /><rect x="3" y="3" width="8" height="3" rx="0.5" /><rect x="3" y="8" width="5" height="3" rx="0.5" />
    </svg>
  ),
  "align-center-h": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="7" y1="1" x2="7" y2="13" strokeDasharray="1.5 1.5" /><rect x="2" y="3" width="10" height="3" rx="0.5" /><rect x="3.5" y="8" width="7" height="3" rx="0.5" />
    </svg>
  ),
  "align-right": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="13" y1="1" x2="13" y2="13" /><rect x="3" y="3" width="8" height="3" rx="0.5" /><rect x="6" y="8" width="5" height="3" rx="0.5" />
    </svg>
  ),
  "align-top": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="1" x2="13" y2="1" /><rect x="3" y="3" width="3" height="8" rx="0.5" /><rect x="8" y="3" width="3" height="5" rx="0.5" />
    </svg>
  ),
  "align-center-v": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="7" x2="13" y2="7" strokeDasharray="1.5 1.5" /><rect x="3" y="2" width="3" height="10" rx="0.5" /><rect x="8" y="3.5" width="3" height="7" rx="0.5" />
    </svg>
  ),
  "align-bottom": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="13" x2="13" y2="13" /><rect x="3" y="3" width="3" height="8" rx="0.5" /><rect x="8" y="6" width="3" height="5" rx="0.5" />
    </svg>
  ),
  "distribute-h": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="1" x2="1" y2="13" /><line x1="13" y1="1" x2="13" y2="13" /><rect x="4" y="4" width="2.5" height="6" rx="0.5" /><rect x="7.5" y="4" width="2.5" height="6" rx="0.5" />
    </svg>
  ),
  "distribute-v": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="1" x2="13" y2="1" /><line x1="1" y1="13" x2="13" y2="13" /><rect x="4" y="4" width="6" height="2.5" rx="0.5" /><rect x="4" y="7.5" width="6" height="2.5" rx="0.5" />
    </svg>
  ),
};

function AlignBtn({
  iconKey,
  title,
  onClick,
  disabled,
}: {
  iconKey: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center w-[26px] h-[26px] [border-radius:var(--s-r-md)] [border:1px_solid_transparent] transition-colors ${
        disabled
          ? "[color:var(--s-text-ter)] cursor-not-allowed opacity-40"
          : "[color:var(--s-text-sec)] hover:[background:var(--s-accent-soft)] hover:[color:var(--s-accent)] hover:[border-color:var(--s-accent-soft)] cursor-pointer"
      }`}
    >
      {ICONS[iconKey]}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FloatingAlignBar() {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectedNodeIds = useEditorStore((s) => s.selectedNodeIds);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);

  const allSelectedIds = React.useMemo(() => {
    const ids: string[] = selectedNodeId ? [selectedNodeId] : [];
    selectedNodeIds.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    return ids;
  }, [selectedNodeId, selectedNodeIds]);

  const getBoxes = useCallback(() => {
    const canvasEl = document.querySelector("[data-canvas-root]") as HTMLElement | null;
    if (!canvasEl) return [];
    const t = canvasEl.closest("[data-canvas-transform]") as HTMLElement | null;
    const scaleMatch = t?.style.transform.match(/scale\(([\d.]+)\)/);
    const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
    return getNodeBBoxes(allSelectedIds, canvasEl, scale);
  }, [allSelectedIds]);

  const handleAlign = useCallback(
    (direction: AlignDirection) => {
      const boxes = getBoxes();
      if (boxes.length < 2) return;
      const adjustments = computeAlignment(boxes, direction);
      for (const [nodeId, pos] of adjustments) {
        const style: Record<string, string> = {};
        if (pos.left !== undefined) style.left = `${Math.round(pos.left)}px`;
        if (pos.top !== undefined) style.top = `${Math.round(pos.top)}px`;
        updateNodeStyle(nodeId, style);
      }
    },
    [getBoxes, updateNodeStyle]
  );

  const handleDistribute = useCallback(
    (axis: DistributeAxis) => {
      const boxes = getBoxes();
      if (boxes.length < 3) return;
      const adjustments = computeDistribution(boxes, axis);
      for (const [nodeId, pos] of adjustments) {
        const style: Record<string, string> = {};
        if (pos.left !== undefined) style.left = `${Math.round(pos.left)}px`;
        if (pos.top !== undefined) style.top = `${Math.round(pos.top)}px`;
        updateNodeStyle(nodeId, style);
      }
    },
    [getBoxes, updateNodeStyle]
  );

  const count = allSelectedIds.length;
  if (count < 2) return null;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-0.5 px-2 py-1.5 [background:var(--s-bg-panel)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-lg)] shadow-lg">
      <span className="[font-size:var(--s-text-2xs)] [color:var(--s-text-ter)] [font-weight:var(--s-weight-medium)] pr-1.5 [border-right:1px_solid_var(--s-border)] mr-0.5">
        {count} selected
      </span>

      <AlignBtn iconKey="align-left" title="Align left" onClick={() => handleAlign("left")} />
      <AlignBtn iconKey="align-center-h" title="Align centre horizontally" onClick={() => handleAlign("center-h")} />
      <AlignBtn iconKey="align-right" title="Align right" onClick={() => handleAlign("right")} />

      <div className="w-px h-4 [background:var(--s-border)] mx-0.5" />

      <AlignBtn iconKey="align-top" title="Align top" onClick={() => handleAlign("top")} />
      <AlignBtn iconKey="align-center-v" title="Align centre vertically" onClick={() => handleAlign("center-v")} />
      <AlignBtn iconKey="align-bottom" title="Align bottom" onClick={() => handleAlign("bottom")} />

      <div className="w-px h-4 [background:var(--s-border)] mx-0.5" />

      <AlignBtn iconKey="distribute-h" title="Distribute horizontally (3+ nodes)" onClick={() => handleDistribute("horizontal")} disabled={count < 3} />
      <AlignBtn iconKey="distribute-v" title="Distribute vertically (3+ nodes)" onClick={() => handleDistribute("vertical")} disabled={count < 3} />
    </div>
  );
}
