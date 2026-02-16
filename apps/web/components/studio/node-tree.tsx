"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useEditorStore } from "@/lib/studio/store";
import { CONTAINER_TYPES } from "@/lib/studio/types";
import type { Node } from "@/lib/studio/types";

// -------------------------------------------------------------------------
// Inline rename input
// -------------------------------------------------------------------------

function InlineRenameInput({
  initialValue,
  onConfirm,
  onCancel,
}: {
  initialValue: string;
  onConfirm: (newId: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      onConfirm(value);
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={() => onConfirm(value)}
      className="text-[10px] bg-background border border-blue-400 rounded px-1 py-0 outline-none w-20 ml-auto"
      autoFocus
    />
  );
}

// -------------------------------------------------------------------------
// Tree drop zone (thin line between items)
// -------------------------------------------------------------------------

function TreeDropZone({
  parentId,
  index,
}: {
  parentId: string;
  index: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `tree-drop-${parentId}-${index}`,
    data: { type: "tree-insertion", parentId, index },
  });

  return (
    <div
      ref={setNodeRef}
      className={`transition-all ${
        isOver
          ? "h-1 bg-blue-500 rounded-full mx-4 my-0.5 opacity-100"
          : "h-0 opacity-0"
      }`}
    />
  );
}

// -------------------------------------------------------------------------
// Tree node item
// -------------------------------------------------------------------------

function TreeItem({
  node,
  depth,
  selectedId,
  onSelect,
  isRoot,
}: {
  node: Node;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  isRoot?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const [isRenaming, setIsRenaming] = useState(false);

  const renameNode = useEditorStore((s) => s.renameNode);
  const hiddenNodeIds = useEditorStore((s) => s.hiddenNodeIds);
  const lockedNodeIds = useEditorStore((s) => s.lockedNodeIds);
  const toggleNodeVisibility = useEditorStore((s) => s.toggleNodeVisibility);
  const toggleNodeLock = useEditorStore((s) => s.toggleNodeLock);
  const renamingNodeId = useEditorStore((s) => s.renamingNodeId);
  const setRenamingNodeId = useEditorStore((s) => s.setRenamingNodeId);

  // Auto-enter rename mode when triggered via R shortcut
  useEffect(() => {
    if (renamingNodeId === node.id && !isRenaming) {
      setIsRenaming(true);
      setRenamingNodeId(null);
    }
  }, [renamingNodeId, node.id, isRenaming, setRenamingNodeId]);

  const isSelected = selectedId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const isContainer = CONTAINER_TYPES.has(node.type);
  const isHidden = hiddenNodeIds.has(node.id);
  const isLocked = lockedNodeIds.has(node.id);

  // Draggable (root is not draggable)
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `tree-node-${node.id}`,
    data: { type: "tree-node", nodeId: node.id, nodeType: node.type },
    disabled: !!isRoot,
  });

  // Droppable (containers can receive drops)
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `tree-container-${node.id}`,
    data: { type: "tree-container", nodeId: node.id },
    disabled: !isContainer,
  });

  const handleRenameConfirm = useCallback(
    (newId: string) => {
      setIsRenaming(false);
      if (newId !== node.id) {
        renameNode(node.id, newId);
      }
    },
    [node.id, renameNode]
  );

  // Combine refs for drag + drop
  const combinedRef = useCallback(
    (el: HTMLDivElement | null) => {
      setDragRef(el);
      setDropRef(el);
    },
    [setDragRef, setDropRef]
  );

  return (
    <div className={isDragging ? "opacity-30" : ""}>
      <div
        ref={combinedRef}
        {...(isRoot ? {} : listeners)}
        {...(isRoot ? {} : attributes)}
        className={`group flex items-center gap-1 px-2 py-0.5 text-xs transition-colors rounded-sm ${
          isRoot ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        } ${
          isSelected
            ? "bg-blue-500/15 text-blue-600 font-medium"
            : "hover:bg-accent"
        } ${isOver && isContainer ? "ring-1 ring-blue-400 bg-blue-500/5" : ""}`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setIsRenaming(true);
        }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren || isContainer ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-4 h-4 flex-shrink-0" />
        )}

        {/* Type badge */}
        <span
          className={`font-mono truncate ${
            isContainer ? "text-purple-600 dark:text-purple-400" : ""
          }`}
        >
          {node.type}
        </span>

        {/* ID label or rename input */}
        {isRenaming ? (
          <InlineRenameInput
            initialValue={node.id}
            onConfirm={handleRenameConfirm}
            onCancel={() => setIsRenaming(false)}
          />
        ) : (
          <span className="text-muted-foreground truncate ml-auto text-[10px]">
            {node.id}
          </span>
        )}

        {/* Visibility toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleNodeVisibility(node.id);
          }}
          className={`w-4 h-4 flex items-center justify-center flex-shrink-0 transition-opacity ${
            isHidden
              ? "text-muted-foreground opacity-100"
              : "text-muted-foreground opacity-0 group-hover:opacity-100"
          }`}
          title={isHidden ? "Show node" : "Hide node"}
        >
          {isHidden ? (
            /* Eye-off icon (simplified) */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            /* Eye icon (simplified) */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>

        {/* Lock toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleNodeLock(node.id);
          }}
          className={`w-4 h-4 flex items-center justify-center flex-shrink-0 transition-opacity ${
            isLocked
              ? "text-orange-500 opacity-100"
              : "text-muted-foreground opacity-0 group-hover:opacity-100"
          }`}
          title={isLocked ? "Unlock node" : "Lock node"}
        >
          {isLocked ? (
            /* Lock closed icon */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          ) : (
            /* Lock open icon */
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
          )}
        </button>
      </div>

      {/* Children with drop zones */}
      {expanded && (hasChildren || isContainer) && (
        <div>
          {(node.children ?? []).map((child, idx) => (
            <React.Fragment key={child.id}>
              <TreeDropZone parentId={node.id} index={idx} />
              <TreeItem
                node={child}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            </React.Fragment>
          ))}
          {/* Final drop zone at end of children */}
          <TreeDropZone
            parentId={node.id}
            index={(node.children ?? []).length}
          />
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Layers panel (replaces NodeTree)
// -------------------------------------------------------------------------

export function NodeTree() {
  const spec = useEditorStore((s) => s.spec);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectNode = useEditorStore((s) => s.selectNode);
  const moveNode = useEditorStore((s) => s.moveNode);

  const [draggedNodeType, setDraggedNodeType] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === "tree-node") {
      setDraggedNodeType(data.nodeType as string);
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggedNodeType(null);
      const { active, over } = event;
      if (!over || !active.data.current) return;

      const activeData = active.data.current;
      const overData = over.data.current;
      if (!activeData || !overData) return;

      if (activeData.type !== "tree-node") return;
      const nodeId = activeData.nodeId as string;

      if (overData.type === "tree-insertion") {
        const parentId = overData.parentId as string;
        const index = overData.index as number;
        moveNode(nodeId, parentId, index);
      } else if (overData.type === "tree-container") {
        const containerId = overData.nodeId as string;
        if (containerId !== nodeId) {
          moveNode(nodeId, containerId, 0);
        }
      }
    },
    [moveNode]
  );

  const [panelOpen, setPanelOpen] = useState(true);

  if (!spec) return null;

  return (
    <div className="flex flex-col border-t">
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="flex items-center gap-1.5 px-4 py-2 border-b font-semibold text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors w-full text-left"
      >
        <span className="w-3 h-3 flex items-center justify-center text-[10px]">
          {panelOpen ? "▾" : "▸"}
        </span>
        Layers
      </button>
      {panelOpen && (
        <div className="flex-1 overflow-y-auto py-1">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <TreeItem
              node={spec.tree}
              depth={0}
              selectedId={selectedNodeId}
              onSelect={selectNode}
              isRoot
            />
            <DragOverlay dropAnimation={null}>
              {draggedNodeType ? (
                <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-lg">
                  {draggedNodeType}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </div>
  );
}
