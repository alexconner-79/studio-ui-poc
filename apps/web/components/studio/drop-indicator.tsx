"use client";

import React from "react";
import { useDroppable, useDndContext } from "@dnd-kit/core";

/**
 * A drop zone indicator rendered between nodes in a container.
 * Shows a translucent ghost placeholder with the component label when hovered.
 */
export function DropIndicator({
  parentId,
  index,
}: {
  parentId: string;
  index: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${parentId}-${index}`,
    data: {
      type: "insertion",
      parentId,
      index,
    },
  });

  const { active } = useDndContext();
  const activeData = active?.data.current;
  const label =
    activeData?.type === "palette"
      ? String(activeData.nodeType ?? "")
      : activeData?.type === "canvas-node"
      ? `Move: ${activeData.nodeType ?? ""}`
      : activeData?.type === "custom-component" || activeData?.type === "template-component"
      ? String(activeData.name ?? "Component")
      : activeData?.type === "asset"
      ? "Image"
      : null;

  return (
    <div
      ref={setNodeRef}
      className={`transition-all ${
        isOver
          ? "my-1 opacity-100"
          : "h-0.5 bg-transparent hover:bg-blue-200 rounded-full my-0"
      }`}
    >
      {isOver && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border-2 border-dashed border-blue-400 bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 text-xs font-medium">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="8" y1="2" x2="8" y2="14" />
            <line x1="2" y1="8" x2="14" y2="8" />
          </svg>
          {label ? `Drop ${label} here` : "Drop here"}
        </div>
      )}
    </div>
  );
}
