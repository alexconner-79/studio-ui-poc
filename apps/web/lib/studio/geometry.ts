/**
 * Smart guides and snapping utilities for the visual editor.
 *
 * All coordinates are in canvas-space (pre-scale), not screen-space.
 */

import type { Node } from "./types";

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export type BBox = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
  nodeId: string;
};

export type GuideLine = {
  /** "x" = vertical line at x-position; "y" = horizontal line at y-position */
  axis: "x" | "y";
  position: number;
  from: number;
  to: number;
};

export type DistanceIndicator = {
  /** Axis the distance runs along */
  axis: "x" | "y";
  from: number;
  to: number;
  /** Position on the perpendicular axis (for label placement) */
  crossPosition: number;
  value: number;
};

export type SnapResult = {
  deltaX: number;
  deltaY: number;
  guides: GuideLine[];
  distances: DistanceIndicator[];
};

// -------------------------------------------------------------------------
// BBox helpers
// -------------------------------------------------------------------------

export function makeBBox(
  top: number,
  left: number,
  width: number,
  height: number,
  nodeId: string = "",
): BBox {
  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    centerX: left + width / 2,
    centerY: top + height / 2,
    nodeId,
  };
}

export function bboxFromElement(
  el: HTMLElement,
  canvasRect: DOMRect,
  scale: number,
  nodeId: string = "",
): BBox {
  const r = el.getBoundingClientRect();
  return makeBBox(
    (r.top - canvasRect.top) / scale,
    (r.left - canvasRect.left) / scale,
    r.width / scale,
    r.height / scale,
    nodeId,
  );
}

// -------------------------------------------------------------------------
// Tree helpers
// -------------------------------------------------------------------------

type TreeNode = { id: string; children?: TreeNode[] };

export function findParentAndSiblingIds(
  tree: TreeNode,
  nodeId: string,
): { parentId: string; siblingIds: string[] } | null {
  if (!tree.children) return null;
  for (const child of tree.children) {
    if (child.id === nodeId) {
      return {
        parentId: tree.id,
        siblingIds: tree.children.map((c) => c.id),
      };
    }
    const result = findParentAndSiblingIds(child, nodeId);
    if (result) return result;
  }
  return null;
}

// -------------------------------------------------------------------------
// Collect snap targets from the DOM
// -------------------------------------------------------------------------

export function collectSnapTargets(
  nodeId: string,
  tree: TreeNode,
  canvasEl: HTMLElement,
  scale: number,
): BBox[] {
  const info = findParentAndSiblingIds(tree, nodeId);
  if (!info) return [];

  const canvasRect = canvasEl.getBoundingClientRect();
  const targets: BBox[] = [];

  // Siblings (excluding the moving node)
  for (const id of info.siblingIds) {
    if (id === nodeId) continue;
    const el = canvasEl.querySelector(
      `[data-studio-node="${id}"]`,
    ) as HTMLElement | null;
    if (!el) continue;
    targets.push(bboxFromElement(el, canvasRect, scale, id));
  }

  // Parent edges
  const parentEl = canvasEl.querySelector(
    `[data-studio-node="${info.parentId}"]`,
  ) as HTMLElement | null;
  if (parentEl) {
    targets.push(bboxFromElement(parentEl, canvasRect, scale, info.parentId));
  }

  return targets;
}

// -------------------------------------------------------------------------
// Snap for MOVE operations
// -------------------------------------------------------------------------

type SnapCandidate = {
  delta: number;
  position: number;
  targetBox: BBox;
};

const DEFAULT_THRESHOLD = 8;

export function snapMove(
  box: BBox,
  targets: BBox[],
  threshold: number = DEFAULT_THRESHOLD,
): SnapResult {
  const xCandidates: SnapCandidate[] = [];
  const yCandidates: SnapCandidate[] = [];

  const srcX = [box.left, box.right, box.centerX];
  const srcY = [box.top, box.bottom, box.centerY];

  for (const target of targets) {
    const tgtX = [target.left, target.right, target.centerX];
    const tgtY = [target.top, target.bottom, target.centerY];

    for (const s of srcX) {
      for (const t of tgtX) {
        const delta = t - s;
        if (Math.abs(delta) <= threshold) {
          xCandidates.push({ delta, position: t, targetBox: target });
        }
      }
    }
    for (const s of srcY) {
      for (const t of tgtY) {
        const delta = t - s;
        if (Math.abs(delta) <= threshold) {
          yCandidates.push({ delta, position: t, targetBox: target });
        }
      }
    }
  }

  return buildResult(box, xCandidates, yCandidates);
}

// -------------------------------------------------------------------------
// Snap for RESIZE operations
// -------------------------------------------------------------------------

export function snapResize(
  box: BBox,
  activeEdges: ("top" | "bottom" | "left" | "right")[],
  targets: BBox[],
  threshold: number = DEFAULT_THRESHOLD,
): SnapResult {
  const xCandidates: SnapCandidate[] = [];
  const yCandidates: SnapCandidate[] = [];

  const hasLeft = activeEdges.includes("left");
  const hasRight = activeEdges.includes("right");
  const hasTop = activeEdges.includes("top");
  const hasBottom = activeEdges.includes("bottom");

  const srcX: number[] = [];
  if (hasLeft) srcX.push(box.left);
  if (hasRight) srcX.push(box.right);

  const srcY: number[] = [];
  if (hasTop) srcY.push(box.top);
  if (hasBottom) srcY.push(box.bottom);

  for (const target of targets) {
    const tgtX = [target.left, target.right, target.centerX];
    const tgtY = [target.top, target.bottom, target.centerY];

    for (const s of srcX) {
      for (const t of tgtX) {
        const delta = t - s;
        if (Math.abs(delta) <= threshold) {
          xCandidates.push({ delta, position: t, targetBox: target });
        }
      }
    }
    for (const s of srcY) {
      for (const t of tgtY) {
        const delta = t - s;
        if (Math.abs(delta) <= threshold) {
          yCandidates.push({ delta, position: t, targetBox: target });
        }
      }
    }
  }

  return buildResult(box, xCandidates, yCandidates);
}

// -------------------------------------------------------------------------
// Shared result builder
// -------------------------------------------------------------------------

function buildResult(
  box: BBox,
  xCandidates: SnapCandidate[],
  yCandidates: SnapCandidate[],
): SnapResult {
  let bestX: SnapCandidate | null = null;
  let bestY: SnapCandidate | null = null;

  for (const c of xCandidates) {
    if (!bestX || Math.abs(c.delta) < Math.abs(bestX.delta)) bestX = c;
  }
  for (const c of yCandidates) {
    if (!bestY || Math.abs(c.delta) < Math.abs(bestY.delta)) bestY = c;
  }

  const dx = bestX?.delta ?? 0;
  const dy = bestY?.delta ?? 0;
  const snapped = makeBBox(box.top + dy, box.left + dx, box.width, box.height);

  const guides: GuideLine[] = [];
  const distances: DistanceIndicator[] = [];

  if (bestX) {
    const matching = xCandidates
      .filter((c) => c.position === bestX!.position)
      .map((c) => c.targetBox);
    const unique = dedup(matching);
    const allBoxes = [snapped, ...unique];
    const minTop = Math.min(...allBoxes.map((b) => b.top));
    const maxBottom = Math.max(...allBoxes.map((b) => b.bottom));

    guides.push({
      axis: "x",
      position: bestX.position,
      from: minTop - 8,
      to: maxBottom + 8,
    });

    for (const target of unique) {
      addVerticalDistance(snapped, target, bestX.position, distances);
    }
  }

  if (bestY) {
    const matching = yCandidates
      .filter((c) => c.position === bestY!.position)
      .map((c) => c.targetBox);
    const unique = dedup(matching);
    const allBoxes = [snapped, ...unique];
    const minLeft = Math.min(...allBoxes.map((b) => b.left));
    const maxRight = Math.max(...allBoxes.map((b) => b.right));

    guides.push({
      axis: "y",
      position: bestY.position,
      from: minLeft - 8,
      to: maxRight + 8,
    });

    for (const target of unique) {
      addHorizontalDistance(snapped, target, bestY.position, distances);
    }
  }

  return { deltaX: dx, deltaY: dy, guides, distances };
}

// -------------------------------------------------------------------------
// Distance helpers
// -------------------------------------------------------------------------

function addVerticalDistance(
  a: BBox,
  b: BBox,
  crossPos: number,
  out: DistanceIndicator[],
): void {
  if (a.bottom <= b.top) {
    out.push({
      axis: "y",
      from: a.bottom,
      to: b.top,
      crossPosition: crossPos,
      value: Math.round(b.top - a.bottom),
    });
  } else if (a.top >= b.bottom) {
    out.push({
      axis: "y",
      from: b.bottom,
      to: a.top,
      crossPosition: crossPos,
      value: Math.round(a.top - b.bottom),
    });
  }
}

function addHorizontalDistance(
  a: BBox,
  b: BBox,
  crossPos: number,
  out: DistanceIndicator[],
): void {
  if (a.right <= b.left) {
    out.push({
      axis: "x",
      from: a.right,
      to: b.left,
      crossPosition: crossPos,
      value: Math.round(b.left - a.right),
    });
  } else if (a.left >= b.right) {
    out.push({
      axis: "x",
      from: b.right,
      to: a.left,
      crossPosition: crossPos,
      value: Math.round(a.left - b.right),
    });
  }
}

function dedup(boxes: BBox[]): BBox[] {
  const seen = new Set<string>();
  return boxes.filter((b) => {
    if (seen.has(b.nodeId)) return false;
    seen.add(b.nodeId);
    return true;
  });
}

// -------------------------------------------------------------------------
// Alignment (v0.8.7)
// -------------------------------------------------------------------------

export type AlignDirection =
  | "left"
  | "center-h"
  | "right"
  | "top"
  | "center-v"
  | "bottom";

export type DistributeAxis = "horizontal" | "vertical";

/**
 * Returns a map of nodeId -> { top?, left? } pixel adjustments to achieve alignment.
 * Values are absolute canvas-space positions.
 */
export function computeAlignment(
  boxes: BBox[],
  direction: AlignDirection,
): Map<string, { top?: number; left?: number }> {
  if (boxes.length < 2) return new Map();
  const result = new Map<string, { top?: number; left?: number }>();

  switch (direction) {
    case "left": {
      const target = Math.min(...boxes.map((b) => b.left));
      for (const box of boxes) {
        if (Math.abs(box.left - target) > 0.5) {
          result.set(box.nodeId, { left: target });
        }
      }
      break;
    }
    case "center-h": {
      const minL = Math.min(...boxes.map((b) => b.left));
      const maxR = Math.max(...boxes.map((b) => b.right));
      const center = (minL + maxR) / 2;
      for (const box of boxes) {
        const newLeft = center - box.width / 2;
        if (Math.abs(box.left - newLeft) > 0.5) {
          result.set(box.nodeId, { left: newLeft });
        }
      }
      break;
    }
    case "right": {
      const target = Math.max(...boxes.map((b) => b.right));
      for (const box of boxes) {
        const newLeft = target - box.width;
        if (Math.abs(box.left - newLeft) > 0.5) {
          result.set(box.nodeId, { left: newLeft });
        }
      }
      break;
    }
    case "top": {
      const target = Math.min(...boxes.map((b) => b.top));
      for (const box of boxes) {
        if (Math.abs(box.top - target) > 0.5) {
          result.set(box.nodeId, { top: target });
        }
      }
      break;
    }
    case "center-v": {
      const minT = Math.min(...boxes.map((b) => b.top));
      const maxB = Math.max(...boxes.map((b) => b.bottom));
      const center = (minT + maxB) / 2;
      for (const box of boxes) {
        const newTop = center - box.height / 2;
        if (Math.abs(box.top - newTop) > 0.5) {
          result.set(box.nodeId, { top: newTop });
        }
      }
      break;
    }
    case "bottom": {
      const target = Math.max(...boxes.map((b) => b.bottom));
      for (const box of boxes) {
        const newTop = target - box.height;
        if (Math.abs(box.top - newTop) > 0.5) {
          result.set(box.nodeId, { top: newTop });
        }
      }
      break;
    }
  }

  return result;
}

/**
 * Returns a map of nodeId -> { top?, left? } positions for equal distribution.
 * Requires at least 3 boxes; first and last (by position) stay fixed.
 */
export function computeDistribution(
  boxes: BBox[],
  axis: DistributeAxis,
): Map<string, { top?: number; left?: number }> {
  if (boxes.length < 3) return new Map();
  const result = new Map<string, { top?: number; left?: number }>();

  if (axis === "horizontal") {
    const sorted = [...boxes].sort((a, b) => a.left - b.left);
    const totalItemWidth = sorted.reduce((s, b) => s + b.width, 0);
    const spanStart = sorted[0].left;
    const spanEnd = sorted[sorted.length - 1].right;
    const gap = (spanEnd - spanStart - totalItemWidth) / (sorted.length - 1);

    let x = spanStart;
    for (const box of sorted) {
      if (Math.abs(box.left - x) > 0.5) {
        result.set(box.nodeId, { left: x });
      }
      x += box.width + gap;
    }
  } else {
    const sorted = [...boxes].sort((a, b) => a.top - b.top);
    const totalItemHeight = sorted.reduce((s, b) => s + b.height, 0);
    const spanStart = sorted[0].top;
    const spanEnd = sorted[sorted.length - 1].bottom;
    const gap = (spanEnd - spanStart - totalItemHeight) / (sorted.length - 1);

    let y = spanStart;
    for (const box of sorted) {
      if (Math.abs(box.top - y) > 0.5) {
        result.set(box.nodeId, { top: y });
      }
      y += box.height + gap;
    }
  }

  return result;
}

/**
 * Compute the combined bounding box of multiple boxes.
 */
export function combinedBBox(boxes: BBox[]): BBox | null {
  if (boxes.length === 0) return null;
  const top = Math.min(...boxes.map((b) => b.top));
  const left = Math.min(...boxes.map((b) => b.left));
  const right = Math.max(...boxes.map((b) => b.right));
  const bottom = Math.max(...boxes.map((b) => b.bottom));
  return makeBBox(top, left, right - left, bottom - top);
}

/**
 * Get bounding boxes from the DOM for a set of node IDs.
 */
export function getNodeBBoxes(
  nodeIds: string[],
  canvasEl: HTMLElement,
  scale: number,
): BBox[] {
  const canvasRect = canvasEl.getBoundingClientRect();
  const boxes: BBox[] = [];
  for (const id of nodeIds) {
    const el = canvasEl.querySelector(
      `[data-studio-node="${id}"]`,
    ) as HTMLElement | null;
    if (!el) continue;
    boxes.push(bboxFromElement(el, canvasRect, scale, id));
  }
  return boxes;
}

// -------------------------------------------------------------------------
// Auto-layout conversion helpers
// -------------------------------------------------------------------------

/**
 * Detect the primary layout direction of a set of child nodes based on
 * their stored top/left positions.
 *
 * Heuristic: if the average horizontal spread is greater than the average
 * vertical spread across children, they are arranged in a row.
 */
export function detectLayoutDirection(children: Node[]): "row" | "column" {
  if (children.length < 2) return "row";

  const tops = children.map((c) => parseFloat(String(c.style?.top ?? 0)) || 0);
  const lefts = children.map((c) => parseFloat(String(c.style?.left ?? 0)) || 0);

  const vertSpread = Math.max(...tops) - Math.min(...tops);
  const horizSpread = Math.max(...lefts) - Math.min(...lefts);

  return horizSpread >= vertSpread ? "row" : "column";
}

/**
 * Compute the average gap between children laid out in `direction`.
 * Returns a rounded pixel value (minimum 0).
 */
export function computeFlexGap(children: Node[], direction: "row" | "column"): number {
  if (children.length < 2) return 0;

  const sorted = [...children].sort((a, b) => {
    const aVal = parseFloat(String(direction === "row" ? (a.style?.left ?? 0) : (a.style?.top ?? 0))) || 0;
    const bVal = parseFloat(String(direction === "row" ? (b.style?.left ?? 0) : (b.style?.top ?? 0))) || 0;
    return aVal - bVal;
  });

  let totalGap = 0;
  let count = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    if (direction === "row") {
      const prevLeft = parseFloat(String(prev.style?.left ?? 0)) || 0;
      const prevWidth = parseFloat(String(prev.style?.width ?? 0)) || 0;
      const currLeft = parseFloat(String(curr.style?.left ?? 0)) || 0;
      const gap = currLeft - (prevLeft + prevWidth);
      if (gap > 0) { totalGap += gap; count++; }
    } else {
      const prevTop = parseFloat(String(prev.style?.top ?? 0)) || 0;
      const prevHeight = parseFloat(String(prev.style?.height ?? 0)) || 0;
      const currTop = parseFloat(String(curr.style?.top ?? 0)) || 0;
      const gap = currTop - (prevTop + prevHeight);
      if (gap > 0) { totalGap += gap; count++; }
    }
  }

  return count > 0 ? Math.round(totalGap / count) : 0;
}

/**
 * Snapshot the absolute positions of child nodes relative to their parent Frame.
 * Used by `breakAutoLayout` to restore positions when converting back to absolute.
 */
export function snapshotAbsolutePositions(
  children: Node[],
  frame: Node,
): Map<string, { top: number; left: number }> {
  const result = new Map<string, { top: number; left: number }>();
  const frameEl = typeof document !== "undefined"
    ? document.querySelector(`[data-studio-node="${frame.id}"]`) as HTMLElement | null
    : null;
  const canvasEl = frameEl?.closest("[data-canvas-root]") as HTMLElement | null;

  if (frameEl && canvasEl) {
    const scaleMatch = (canvasEl.closest("[data-canvas-transform]") as HTMLElement | null)?.style.transform.match(/scale\(([\d.]+)\)/);
    const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
    const frameRect = frameEl.getBoundingClientRect();

    for (const child of children) {
      const childEl = canvasEl.querySelector(`[data-studio-node="${child.id}"]`) as HTMLElement | null;
      if (!childEl) continue;
      const childRect = childEl.getBoundingClientRect();
      result.set(child.id, {
        top: Math.round((childRect.top - frameRect.top) / scale),
        left: Math.round((childRect.left - frameRect.left) / scale),
      });
    }
  } else {
    // Fallback: use stored style values
    for (const child of children) {
      result.set(child.id, {
        top: parseFloat(String(child.style?.top ?? 0)) || 0,
        left: parseFloat(String(child.style?.left ?? 0)) || 0,
      });
    }
  }

  return result;
}
