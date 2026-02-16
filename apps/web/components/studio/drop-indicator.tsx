"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";

/**
 * A thin drop zone indicator rendered between nodes in a container.
 * Expands and turns blue when a drag is hovering over it.
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

  return (
    <div
      ref={setNodeRef}
      className={`transition-all ${
        isOver
          ? "h-1.5 bg-blue-500 rounded-full my-1 opacity-100"
          : "h-0.5 bg-transparent hover:bg-blue-200 rounded-full my-0"
      }`}
    />
  );
}
