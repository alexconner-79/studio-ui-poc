"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { useEditorStore } from "@/lib/studio/store";
import { RenderNode, EmptyCanvas } from "./renderer";
import {
  CanvasContainerWithControls,
  type CanvasControlsAPI,
} from "./canvas-container";
import { DeviceFrame } from "./device-frame";
import { ZoomControls } from "./zoom-controls";

// -------------------------------------------------------------------------
// Breakpoint definitions
// -------------------------------------------------------------------------

export const BREAKPOINT_DEFS = [
  { key: "mobile" as const, label: "Mobile", width: 375 },
  { key: "tablet" as const, label: "Tablet", width: 768 },
  { key: "desktop" as const, label: "Desktop", width: 1280 },
] as const;

export type BreakpointKey = (typeof BREAKPOINT_DEFS)[number]["key"];

// -------------------------------------------------------------------------
// Canvas content -- what goes inside each device frame
// -------------------------------------------------------------------------

function CanvasContent({
  isDragging,
  frameId,
  isPrimary,
  previewMode,
  frameWidth,
}: {
  isDragging?: boolean;
  frameId: string;
  isPrimary: boolean;
  previewMode?: boolean;
  frameWidth?: number;
}) {
  const spec = useEditorStore((s) => s.spec);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectNode = useEditorStore((s) => s.selectNode);

  // Only the primary frame registers as a droppable target (and not in preview mode)
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
      className={`min-h-full p-6 bg-white dark:bg-gray-950 ${
        isOver && isPrimary && !previewMode ? "ring-2 ring-blue-400 ring-inset" : ""
      }`}
      onClick={() => !previewMode && selectNode(null)}
    >
      {hasChildren ? (
        <RenderNode
          node={spec.tree}
          selectedId={previewMode ? null : selectedNodeId}
          onSelect={previewMode ? undefined : selectNode}
          showDropIndicators={!previewMode && isDragging && isPrimary}
          isRoot
          previewMode={previewMode}
          frameWidth={frameWidth}
        />
      ) : isPrimary && !previewMode ? (
        <EmptyCanvas />
      ) : (
        <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
          {previewMode ? "Empty screen" : "No content"}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// EditorCanvas -- the full canvas with zoom/pan and device frames
// -------------------------------------------------------------------------

export function EditorCanvas({
  isDragging,
  activeFrames,
  previewMode,
}: {
  isDragging?: boolean;
  activeFrames: BreakpointKey[];
  previewMode?: boolean;
}) {
  // Determine frames to show
  const frames =
    activeFrames.length > 0
      ? BREAKPOINT_DEFS.filter((bp) => activeFrames.includes(bp.key))
      : [{ key: "desktop" as const, label: "Desktop", width: 1280 }];

  return (
    <CanvasContainerWithControls
      controls={(api: CanvasControlsAPI) => <ZoomControls api={api} />}
    >
      <div
        className="flex gap-12 p-16"
        style={{ alignItems: "flex-start" }}
      >
        {frames.map((bp, idx) => (
          <DeviceFrame
            key={bp.key}
            label={bp.label}
            width={bp.width}
            active={idx === 0}
          >
            <CanvasContent
              isDragging={isDragging}
              frameId={bp.key}
              isPrimary={idx === 0}
              previewMode={previewMode}
              frameWidth={bp.width}
            />
          </DeviceFrame>
        ))}
      </div>
    </CanvasContainerWithControls>
  );
}
