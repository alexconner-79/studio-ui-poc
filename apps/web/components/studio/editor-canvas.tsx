"use client";

import React, { useCallback, useContext, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useEditorStore, generateId } from "@/lib/studio/store";
import type { Node } from "@/lib/studio/types";
import { toast } from "@/lib/studio/toast";
import { RenderNode, EmptyCanvas } from "./renderer";
import {
  CanvasContainerWithControls,
  CanvasControlsContext,
  type CanvasControlsAPI,
} from "./canvas-container";
import { DeviceFrame } from "./device-frame";
import { ZoomControls } from "./zoom-controls";
import { SpacingOverlay } from "./spacing-overlay";
import { NodeChromeOverlay } from "./node-chrome-overlay";
import { InlineTextEditor } from "./inline-text-editor";
import { CanvasRulers } from "./canvas-rulers";
import { CanvasTokenBridge } from "./canvas-token-bridge";

// -------------------------------------------------------------------------
// Breakpoint definitions
// -------------------------------------------------------------------------

export const BREAKPOINT_DEFS = [
  { key: "mobile" as const, label: "Mobile", width: 375 },
  { key: "tablet" as const, label: "Tablet", width: 768 },
  { key: "desktop" as const, label: "Desktop", width: 1280 },
  { key: "full" as const, label: "Full", width: 0 },
] as const;

export type BreakpointKey = (typeof BREAKPOINT_DEFS)[number]["key"];

// -------------------------------------------------------------------------
// Drawing overlay -- intercepts pointer events for shape creation tools
// -------------------------------------------------------------------------

const TOOL_NODE_TYPE: Record<string, string> = {
  frame: "Frame",
  rectangle: "Rectangle",
  ellipse: "Ellipse",
  line: "Line",
  text: "Text",
};

// If user draws less than this many canvas-px, treat it as a click and
// insert a default-sized shape centred on the click point.
const MIN_DRAW_PX = 4;

const DEFAULT_SHAPE_SIZE: Record<string, { w: number; h: number }> = {
  frame: { w: 200, h: 200 },
  rectangle: { w: 100, h: 100 },
  ellipse: { w: 100, h: 100 },
  line: { w: 100, h: 0 },
};

function DrawingLayer() {
  const currentTool = useEditorStore((s) => s.currentTool);
  const spec = useEditorStore((s) => s.spec);
  const addNode = useEditorStore((s) => s.addNode);
  const selectNode = useEditorStore((s) => s.selectNode);
  const setCurrentTool = useEditorStore((s) => s.setCurrentTool);
  const setInlineEditingNodeId = useEditorStore((s) => s.setInlineEditingNodeId);
  const toggleNodeCompile = useEditorStore((s) => s.toggleNodeCompile);
  const { scale } = useContext(CanvasControlsContext);

  const overlayRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<{ startX: number; startY: number; curX: number; curY: number } | null>(null);

  const isActive = currentTool !== "select" && currentTool !== "pan";

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isActive || !overlayRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const rect = overlayRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      if (currentTool === "text") {
        const nodeType = "Text";
        const newId = generateId();
        const rootId = spec?.tree.id;
        if (!rootId) return;
        const newNode: Node = {
          id: newId,
          type: nodeType,
          name: nodeType,
          props: { text: "Type here" },
          style: { position: "absolute", top: `${Math.round(y)}px`, left: `${Math.round(x)}px` },
          compile: false,
        };
        addNode(rootId, newNode);
        selectNode(newId);
        setCurrentTool("select");
        setTimeout(() => setInlineEditingNodeId(newId), 50);
        toast("Text added as Design-only", {
          description: "It won't appear in compiled code until promoted.",
          action: { label: "Promote →", onClick: () => toggleNodeCompile(newId) },
          duration: 6000,
        });
        return;
      }

      setDrawing({ startX: x, startY: y, curX: x, curY: y });
    },
    [isActive, currentTool, spec, scale, addNode, selectNode, setCurrentTool, setInlineEditingNodeId, toggleNodeCompile],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drawing || !overlayRef.current) return;
      const rect = overlayRef.current.getBoundingClientRect();
      let curX = (e.clientX - rect.left) / scale;
      let curY = (e.clientY - rect.top) / scale;

      // Line tool: snap endpoint to nearest 45° when Shift is held
      if (currentTool === "line" && e.shiftKey) {
        const dx = curX - drawing.startX;
        const dy = curY - drawing.startY;
        const angle = Math.atan2(dy, dx);
        const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        const dist = Math.sqrt(dx * dx + dy * dy);
        curX = drawing.startX + dist * Math.cos(snappedAngle);
        curY = drawing.startY + dist * Math.sin(snappedAngle);
      }

      setDrawing((prev) => prev ? { ...prev, curX, curY } : null);
    },
    [drawing, scale, currentTool],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!drawing || !spec) { setDrawing(null); return; }
      e.stopPropagation();

      const rawW = Math.abs(drawing.curX - drawing.startX);
      const rawH = Math.abs(drawing.curY - drawing.startY);
      const isClick = rawW < MIN_DRAW_PX && rawH < MIN_DRAW_PX;

      let x: number, y: number, w: number, h: number;

      if (isClick) {
        // Treat as a click — insert a default-sized shape centred on the point
        const def = DEFAULT_SHAPE_SIZE[currentTool] ?? { w: 100, h: 100 };
        w = def.w;
        h = def.h;
        x = drawing.startX - w / 2;
        y = drawing.startY - h / 2;
      } else {
        x = Math.min(drawing.startX, drawing.curX);
        y = Math.min(drawing.startY, drawing.curY);
        w = Math.max(rawW, 20);
        h = Math.max(rawH, 20);
      }

      const nodeType = TOOL_NODE_TYPE[currentTool] || "Rectangle";
      const newId = generateId();
      const rootId = spec.tree.id;

      const defaultProps: Record<string, unknown> = {};
      if (nodeType === "Rectangle") defaultProps.fill = "#D9D9D9";
      if (nodeType === "Ellipse") defaultProps.fill = "#D9D9D9";
      if (nodeType === "Line") { defaultProps.stroke = "#999999"; defaultProps.strokeWidth = 1; }
      if (nodeType === "Frame") { defaultProps.autoLayout = true; defaultProps.direction = "column"; }

      const isCompile = nodeType === "Frame";

      const newNode: Node = {
        id: newId,
        type: nodeType,
        name: nodeType,
        props: defaultProps,
        style: {
          position: "absolute",
          top: `${Math.round(y)}px`,
          left: `${Math.round(x)}px`,
          width: `${Math.round(w)}px`,
          height: nodeType === "Line" ? undefined : `${Math.round(h)}px`,
        },
        compile: isCompile,
      };

      addNode(rootId, newNode);
      selectNode(newId);
      setCurrentTool("select");
      setDrawing(null);
      if (!isCompile) {
        toast("Shape added as Design-only", {
          description: "It won't appear in compiled code until promoted.",
          action: { label: "Promote →", onClick: () => toggleNodeCompile(newId) },
          duration: 6000,
        });
      }
    },
    [drawing, spec, currentTool, addNode, selectNode, setCurrentTool, toggleNodeCompile],
  );

  if (!isActive) return null;

  const previewRect = drawing
    ? {
        left: Math.min(drawing.startX, drawing.curX),
        top: Math.min(drawing.startY, drawing.curY),
        width: Math.abs(drawing.curX - drawing.startX),
        height: Math.abs(drawing.curY - drawing.startY),
      }
    : null;

  // Live size label — only shown once the user has dragged more than MIN_DRAW_PX
  const showSizeLabel = drawing && previewRect &&
    (previewRect.width >= MIN_DRAW_PX || previewRect.height >= MIN_DRAW_PX);

  const sizeLabel = (() => {
    if (!drawing || !previewRect) return "";
    if (currentTool === "line") {
      const len = Math.round(
        Math.sqrt((drawing.curX - drawing.startX) ** 2 + (drawing.curY - drawing.startY) ** 2)
      );
      return `${len}px`;
    }
    return `${Math.round(previewRect.width)} × ${Math.round(previewRect.height)}`;
  })();

  const cursorMap: Record<string, string> = {
    frame: "crosshair",
    rectangle: "crosshair",
    ellipse: "crosshair",
    line: "crosshair",
    text: "text",
    pan: "grab",
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 z-[60]"
      style={{ cursor: cursorMap[currentTool] || "crosshair" }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {previewRect && previewRect.width > 0 && previewRect.height > 0 && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: previewRect.left,
            top: previewRect.top,
            width: previewRect.width,
            height: previewRect.height,
            border: "1.5px dashed var(--s-accent, #3b82f6)",
            borderRadius: currentTool === "ellipse" ? "50%" : currentTool === "line" ? 0 : 2,
            background: currentTool === "line" ? "none" : "rgba(59,130,246,0.06)",
          }}
        />
      )}
      {/* Live W×H label near the cursor while drawing */}
      {showSizeLabel && drawing && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: drawing.curX + 10,
            top: drawing.curY + 10,
            background: "rgba(0,0,0,0.78)",
            color: "#fff",
            fontSize: 10,
            fontFamily: "monospace",
            padding: "3px 7px",
            borderRadius: 4,
            whiteSpace: "nowrap",
            zIndex: 70,
          }}
        >
          {sizeLabel}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Canvas content -- what goes inside each device frame
// -------------------------------------------------------------------------

function CanvasContent({
  isDragging,
  frameId,
  isPrimary,
  previewMode,
  frameWidth,
  onQuickStart,
}: {
  isDragging?: boolean;
  frameId: string;
  isPrimary: boolean;
  previewMode?: boolean;
  frameWidth?: number;
  onQuickStart?: (action: "stack" | "template") => void;
}) {
  const spec = useEditorStore((s) => s.spec);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectNode = useEditorStore((s) => s.selectNode);

  const { setNodeRef, isOver } = useDroppable({
    id: isPrimary ? "canvas-root" : `canvas-readonly-${frameId}`,
    data: { type: "canvas", nodeId: spec?.tree.id ?? "root" },
    disabled: !isPrimary || !!previewMode,
  });

  if (!spec) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        Loading...
      </div>
    );
  }

  const hasChildren = spec.tree.children && spec.tree.children.length > 0;

  return (
    <div
      ref={setNodeRef}
      data-canvas-root
      {...(previewMode ? { "data-preview": "" } : {})}
      className={`relative min-h-full bg-white dark:bg-gray-950 ${
        isOver && isPrimary && !previewMode ? "ring-2 ring-blue-400 ring-inset" : ""
      }`}
    >
      {/* Emit active DS tokens as CSS variables — scoped to [data-canvas-root] */}
      <CanvasTokenBridge />

      {/* Artboard backdrop — sits behind all content; clicking selects the root artboard */}
      {!previewMode && isPrimary && (
        <div
          className="absolute inset-0 z-0"
          onClick={() => selectNode(spec.tree.id)}
        />
      )}

      {hasChildren ? (
        <div className="relative z-10">
          <RenderNode
            node={spec.tree}
            selectedId={previewMode ? null : selectedNodeId}
            onSelect={previewMode ? undefined : selectNode}
            showDropIndicators={!previewMode && isDragging && isPrimary}
            isRoot
            previewMode={previewMode}
            frameWidth={frameWidth}
          />
        </div>
      ) : isPrimary && !previewMode ? (
        <div className="relative z-10 p-6">
          <EmptyCanvas onQuickStart={onQuickStart} />
        </div>
      ) : (
        <div className="relative z-10 flex items-center justify-center h-32 text-muted-foreground text-sm">
          {previewMode ? "Empty screen" : "No content"}
        </div>
      )}
      {isPrimary && !previewMode && <SpacingOverlay />}
      {isPrimary && !previewMode && <NodeChromeOverlay />}
      {isPrimary && !previewMode && <InlineTextEditor />}
      {isPrimary && !previewMode && <DrawingLayer />}
    </div>
  );
}

// -------------------------------------------------------------------------
// EditorCanvas -- the full canvas with zoom/pan and a single artboard
// -------------------------------------------------------------------------

export function EditorCanvas({
  isDragging,
  previewMode,
  onQuickStart,
}: {
  isDragging?: boolean;
  /** @deprecated use artboardWidth in store instead */
  activeFrames?: BreakpointKey[];
  previewMode?: boolean;
  onQuickStart?: (action: "stack" | "template") => void;
}) {
  // artboardWidth: number → fixed px, null → responsive / full-width
  const artboardWidth = useEditorStore((s) => s.artboardWidth);
  const setArtboardWidth = useEditorStore((s) => s.setArtboardWidth);

  // Derive a human-readable label for the single frame
  const frameLabel = artboardWidth ? `${artboardWidth}px` : "Responsive";
  const isFull = artboardWidth === null;

  // Artboard selection — clicking the frame label selects the root node
  const spec = useEditorStore((s) => s.spec);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectNode = useEditorStore((s) => s.selectNode);
  const rootId = spec?.tree.id;
  const isArtboardSelected = !!rootId && selectedNodeId === rootId;

  return (
    <CanvasContainerWithControls
      controls={(api: CanvasControlsAPI) => (
        <>
          <CanvasRulers />
          <ZoomControls api={api} />
        </>
      )}
    >
      <div
        className="flex p-16"
        style={{ alignItems: "flex-start", justifyContent: isFull ? "stretch" : "flex-start" }}
        onClick={(e) => { if (e.target === e.currentTarget) selectNode(null); }}
      >
        <DeviceFrame
          label={frameLabel}
          width={isFull ? undefined : artboardWidth}
          active
          isSelected={!previewMode && isArtboardSelected}
          onLabelClick={!previewMode && rootId ? () => selectNode(rootId) : undefined}
          onWidthChange={!previewMode && !isFull ? setArtboardWidth : undefined}
        >
          <CanvasContent
            isDragging={isDragging}
            frameId="primary"
            isPrimary
            previewMode={previewMode}
            frameWidth={isFull ? undefined : artboardWidth ?? undefined}
            onQuickStart={onQuickStart}
          />
        </DeviceFrame>
      </div>
    </CanvasContainerWithControls>
  );
}
