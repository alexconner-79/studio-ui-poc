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
  const renameNodeLabel = useEditorStore((s) => s.renameNodeLabel);
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

  // Option+click expand-all: listen for broadcast event and apply to subtree descendants
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ rootId: string; expanded: boolean }>;
      if (ev.detail.rootId === node.id) return; // the clicked node already updated itself
      // Check if this node is a descendant of ev.detail.rootId by walking the spec tree
      const spec = useEditorStore.getState().spec;
      if (!spec) return;
      function isDescendant(root: Node, targetId: string, searchId: string): boolean {
        if (root.id === targetId) {
          return !!(root.children?.some((c) => collectIds(c).has(searchId)));
        }
        return root.children?.some((c) => isDescendant(c, targetId, searchId)) ?? false;
      }
      function collectIds(n: Node): Set<string> {
        const ids = new Set<string>([n.id]);
        n.children?.forEach((c) => collectIds(c).forEach((id) => ids.add(id)));
        return ids;
      }
      if (isDescendant(spec.tree, ev.detail.rootId, node.id)) {
        setExpanded(ev.detail.expanded);
      }
    };
    document.addEventListener("studio:tree-expand", handler);
    return () => document.removeEventListener("studio:tree-expand", handler);
  }, [node.id]);

  const isSelected = selectedId === node.id;
  const hasChildren = node.children && node.children.length > 0;
  const isContainer = CONTAINER_TYPES.has(node.type);
  const isHidden = hiddenNodeIds.has(node.id);
  const isLocked = lockedNodeIds.has(node.id);
  const isDesignOnly = node.compile === false;
  const hasStyleOverrides = Object.keys(node.style ?? {}).length > 0;

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
    (newName: string) => {
      setIsRenaming(false);
      const current = node.name ?? node.type;
      if (newName.trim() && newName.trim() !== current) {
        renameNodeLabel(node.id, newName.trim());
      }
    },
    [node.id, node.name, node.type, renameNodeLabel]
  );

  // Combine refs for drag + drop
  const combinedRef = useCallback(
    (el: HTMLDivElement | null) => {
      setDragRef(el);
      setDropRef(el);
    },
    [setDragRef, setDropRef]
  );

  // Small node-type icon
  const typeIcon = (() => {
    switch (node.type) {
      case "Frame": return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple-500 flex-shrink-0">
          <rect x="1" y="1" width="9" height="9" rx="1"/>
          <line x1="1" y1="4" x2="10" y2="4"/><line x1="1" y1="7" x2="10" y2="7"/>
        </svg>
      );
      case "Text": case "Heading": return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-500 flex-shrink-0">
          <line x1="2" y1="3" x2="9" y2="3"/><line x1="5.5" y1="3" x2="5.5" y2="9"/><line x1="2" y1="6.5" x2="9" y2="6.5"/>
        </svg>
      );
      case "Image": return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-green-500 flex-shrink-0">
          <rect x="1" y="1" width="9" height="9" rx="1"/><circle cx="3.5" cy="3.5" r="0.8" fill="currentColor" stroke="none"/>
          <polyline points="1,8 4,5 6.5,7.5 8,6 10,8"/>
        </svg>
      );
      case "Button": return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-orange-500 flex-shrink-0">
          <rect x="1" y="3" width="9" height="5" rx="2"/>
        </svg>
      );
      case "Stack": return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple-400 flex-shrink-0">
          <rect x="1" y="1" width="9" height="3.5" rx="1"/><rect x="1" y="6.5" width="9" height="3.5" rx="1"/>
        </svg>
      );
      case "ComponentInstance": return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-violet-500 flex-shrink-0">
          <ellipse cx="5.5" cy="5.5" rx="4.5" ry="1.8"/>
          <ellipse cx="5.5" cy="5.5" rx="4.5" ry="1.8" transform="rotate(60 5.5 5.5)"/>
          <ellipse cx="5.5" cy="5.5" rx="4.5" ry="1.8" transform="rotate(120 5.5 5.5)"/>
          <circle cx="5.5" cy="5.5" r="0.9" fill="currentColor" stroke="none"/>
        </svg>
      );
      case "ComponentRef": return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-orange-400 flex-shrink-0">
          <path d="M4.5 7.5 A2.5 2.5 0 0 1 4.5 3.5 L5.5 2.5"/>
          <path d="M6.5 3.5 A2.5 2.5 0 0 1 6.5 7.5 L5.5 8.5"/>
          <line x1="4" y1="5.5" x2="7" y2="5.5"/>
        </svg>
      );
      default: return (
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/60 flex-shrink-0">
          <rect x="2" y="2" width="7" height="7" rx="1"/>
        </svg>
      );
    }
  })();

  return (
    <div className={isDragging ? "opacity-30" : ""} style={{ position: "relative" }}>
      {/* Indentation guide line */}
      {depth > 0 && (
        <div
          style={{
            position: "absolute",
            left: `${depth * 12 + 8 - 6}px`,
            top: 0,
            bottom: 0,
            width: 1,
            background: "var(--s-border)",
            opacity: 0.5,
            pointerEvents: "none",
          }}
        />
      )}
      <div
        ref={combinedRef}
        {...(isRoot ? {} : listeners)}
        {...(isRoot ? {} : attributes)}
        className={`group flex items-center gap-1.5 px-2 text-xs transition-colors rounded-sm ${
          isRoot ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        } ${
          isSelected
            ? "bg-blue-500/15 text-blue-600 font-medium"
            : "hover:bg-accent"
        } ${isOver && isContainer ? "ring-1 ring-blue-400 bg-blue-500/5" : ""} ${
          isDesignOnly ? "opacity-60 italic" : ""
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px`, minHeight: "28px" }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setIsRenaming(true);
        }}
      >
        {/* Expand/collapse toggle -- rotating SVG chevron; Option+click expands/collapses entire subtree */}
        {hasChildren || isContainer ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const next = !expanded;
              setExpanded(next);
              if (e.altKey) {
                // Broadcast to all descendant rows
                document.dispatchEvent(
                  new CustomEvent("studio:tree-expand", {
                    detail: { rootId: node.id, expanded: next },
                  })
                );
              }
            }}
            className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease",
              }}
            >
              <polyline points="3,2 7,5 3,8" />
            </svg>
          </button>
        ) : (
          <span className="w-4 h-4 flex-shrink-0" />
        )}

        {/* Node-type icon */}
        {!isRoot && typeIcon}

        {/* Design-only badge */}
        {isDesignOnly && (
          <span
            className="flex-shrink-0 flex items-center justify-center rounded-sm [font-size:8px] [font-weight:600] [line-height:1] [padding:1px_3px] [color:white] [background:var(--s-warning)]"
            title="Design only -- not compiled"
          >
            D
          </span>
        )}

        {/* Layer name or rename input */}
        {isRenaming ? (
          <InlineRenameInput
            initialValue={node.name ?? node.type}
            onConfirm={handleRenameConfirm}
            onCancel={() => setIsRenaming(false)}
          />
        ) : (
          <span
            className={`truncate ${
              node.type === "ComponentInstance"
                ? "text-violet-600 dark:text-violet-400"
                : node.type === "ComponentRef"
                ? "text-orange-500 dark:text-orange-400"
                : isContainer
                ? "text-purple-600 dark:text-purple-400"
                : ""
            }`}
          >
            {node.name ?? node.type}
          </span>
        )}

        {/* Style override indicator dot */}
        {hasStyleOverrides && !isRenaming && (
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: "var(--s-accent)" }}
            title="Has style overrides"
          />
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
