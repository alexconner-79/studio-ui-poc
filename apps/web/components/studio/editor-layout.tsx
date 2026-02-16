"use client";

import React, { useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useEditorStore, generateId, cloneWithNewIds } from "@/lib/studio/store";
import { NODE_SCHEMAS } from "@/lib/studio/node-schemas";
import { CONTAINER_TYPES } from "@/lib/studio/types";
import type { Node } from "@/lib/studio/types";
import { ComponentPalette } from "./component-palette";
import { EditorCanvas, BREAKPOINT_DEFS, type BreakpointKey } from "./editor-canvas";
import { PropertyPanel } from "./property-panel";
import { NodeTree } from "./node-tree";
import { ContextMenu } from "./context-menu";
import { AIGenerateModal } from "./ai-generate-modal";
import { FontPicker } from "./font-picker";
import { AssetBrowser } from "./asset-browser";
import { CommandPalette } from "./command-palette";
import { ImportTokensModal } from "./import-tokens-modal";
import { DSWizard } from "./ds-wizard";
import { ThemeEditor } from "./theme-editor";
import { A11yPanel } from "./a11y-panel";
import { ExportModal } from "./export-modal";

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

// -------------------------------------------------------------------------
// Top bar
// -------------------------------------------------------------------------

const FRAME_ICONS: Record<string, string> = {
  mobile: "📱",
  tablet: "📋",
  desktop: "🖥",
};

function TopBar({
  screenName,
  onSave,
  onBack,
  onAIGenerate,
  onExport,
}: {
  screenName: string;
  onSave: () => void;
  onBack: () => void;
  onAIGenerate: () => void;
  onExport: () => void;
}) {
  const dirty = useEditorStore((s) => s.dirty);
  const spec = useEditorStore((s) => s.spec);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const activeFrames = useEditorStore((s) => s.activeFrames);
  const toggleFrame = useEditorStore((s) => s.toggleFrame);

  const handlePreview = () => {
    if (!spec) return;
    const route = spec.route === "/" ? "/" : spec.route;
    window.open(route, "_blank");
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; Screens
        </button>
        <span className="text-sm font-semibold">{screenName}</span>
        {dirty && (
          <span className="text-xs text-amber-500">Unsaved changes</span>
        )}
      </div>

      {/* Centre -- Frame visibility toggles (multi-select) */}
      <div className="flex items-center gap-0.5 border rounded-md p-0.5 bg-muted/50">
        {BREAKPOINT_DEFS.map((bp) => {
          const isActive = activeFrames.includes(bp.key);
          return (
            <button
              key={bp.key}
              onClick={() => toggleFrame(bp.key)}
              className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
                isActive
                  ? "bg-background shadow-sm font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={`${bp.label} (${bp.width}px) – click to ${isActive ? "hide" : "show"}`}
            >
              <span className="text-[11px]">{FRAME_ICONS[bp.key] ?? "⬜"}</span>
              <span className="hidden sm:inline">{bp.width}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onAIGenerate}
          className="px-3 py-1 text-xs border border-purple-400/50 text-purple-600 dark:text-purple-400 rounded hover:bg-purple-50 dark:hover:bg-purple-950 transition-colors"
          title="Generate UI with AI"
        >
          AI Generate
        </button>
        <button
          onClick={undo}
          className="px-2 py-1 text-xs border rounded hover:bg-accent transition-colors"
          title="Undo (Ctrl+Z)"
        >
          Undo
        </button>
        <button
          onClick={redo}
          className="px-2 py-1 text-xs border rounded hover:bg-accent transition-colors"
          title="Redo (Ctrl+Shift+Z)"
        >
          Redo
        </button>
        <button
          onClick={handlePreview}
          className="px-3 py-1 text-xs border rounded hover:bg-accent transition-colors"
          title="Open compiled page in new tab"
        >
          Preview
        </button>
        <button
          onClick={onExport}
          className="px-3 py-1 text-xs border rounded hover:bg-accent transition-colors"
          title="Export project"
        >
          Export
        </button>
        <button
          onClick={onSave}
          className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Save &amp; Compile
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Editor layout
// -------------------------------------------------------------------------

export function EditorLayout({
  screenName,
  onBack,
}: {
  screenName: string;
  onBack: () => void;
}) {
  const addNode = useEditorStore((s) => s.addNode);
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
  const duplicateNode = useEditorStore((s) => s.duplicateNode);
  const activeFrames = useEditorStore((s) => s.activeFrames);
  const groupIntoStack = useEditorStore((s) => s.groupIntoStack);
  const setRenamingNodeId = useEditorStore((s) => s.setRenamingNodeId);
  const addCustomComponent = useEditorStore((s) => s.addCustomComponent);

  const [draggedType, setDraggedType] = React.useState<string | null>(null);
  const [draggedNodeId, setDraggedNodeId] = React.useState<string | null>(null);
  const [draggedNodeType, setDraggedNodeType] = React.useState<string | null>(null);
  const [draggedAssetUrl, setDraggedAssetUrl] = React.useState<string | null>(null);
  const [draggedComposite, setDraggedComposite] = React.useState<{ name: string; tree: Node } | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [ctxMenu, setCtxMenu] = React.useState<{ x: number; y: number } | null>(null);
  const [showAIModal, setShowAIModal] = React.useState(false);
  const [showCommandPalette, setShowCommandPalette] = React.useState(false);
  const [showImportTokens, setShowImportTokens] = React.useState(false);
  const [showDSWizard, setShowDSWizard] = React.useState(false);
  const [showThemeEditor, setShowThemeEditor] = React.useState(false);
  const [showA11y, setShowA11y] = React.useState(false);
  const [showExport, setShowExport] = React.useState(false);
  const [compileError, setCompileError] = React.useState<string | null>(null);

  const setSpec = useEditorStore((s) => s.setSpec);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Save handler (defined before keyboard shortcuts so it can be referenced)
  const handleSave = useCallback(async () => {
    if (!spec || !screenName) return;
    setSaving(true);
    setCompileError(null);
    try {
      await fetch(`/api/studio/screens/${screenName}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec }),
      });
      const compileRes = await fetch("/api/studio/compile", { method: "POST" });
      const compileData = await compileRes.json();
      if (compileData.warnings && compileData.warnings.length > 0) {
        setCompileError(compileData.message || "Some screens had compile warnings.");
      } else if (compileData.error) {
        setCompileError(compileData.error);
      }
      markClean();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setCompileError(msg);
    } finally {
      setSaving(false);
    }
  }, [spec, screenName, markClean]);

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

      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
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
      // Duplicate (Ctrl+D)
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && !isInput) {
        e.preventDefault();
        duplicateNode();
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
        selectNode(null);
        return;
      }

      // --- Single-key shortcuts (only when not in an input) ---
      if (isInput || e.metaKey || e.ctrlKey || e.altKey) return;

      // R -- rename selected node
      if (e.key === "r" || e.key === "R") {
        if (selectedNodeId && spec && selectedNodeId !== spec.tree.id) {
          e.preventDefault();
          setRenamingNodeId(selectedNodeId);
        }
        return;
      }
      // G -- group selected node into a Stack
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        groupIntoStack();
        return;
      }
      // D -- duplicate selected node
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        duplicateNode();
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
  }, [undo, redo, removeNode, selectNode, selectedNodeId, spec, copyNode, pasteNode, duplicateNode, handleSave, groupIntoStack, setRenamingNodeId]);

  // Build a new node from a palette type
  const buildNewNode = useCallback(
    (nodeType: string) => {
      const schema = NODE_SCHEMAS[nodeType];
      const defaultProps: Record<string, unknown> = {};
      if (schema) {
        Object.entries(schema.props).forEach(([key, def]) => {
          if (def.defaultValue !== undefined) {
            defaultProps[key] = def.defaultValue;
          }
        });
      }
      return {
        id: generateId(nodeType.toLowerCase()),
        type: nodeType,
        props: Object.keys(defaultProps).length > 0 ? defaultProps : undefined,
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
        const newNode = buildNewNode(nodeType);

        if (overData?.type === "insertion") {
          const parentId = overData.parentId as string;
          const index = overData.index as number;
          addNode(parentId, newNode, index);
          return;
        }

        if (overData?.type === "canvas") {
          const targetId = overData.nodeId as string;
          const isContainer = CONTAINER_TYPES.has(targetId) || spec.tree.id === targetId;
          if (isContainer) {
            addNode(targetId, newNode);
          } else {
            addNode(spec.tree.id, newNode);
          }
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
            // Fallback: move to root
            const rootLen = spec.tree.children?.length ?? 0;
            moveNode(nodeId, spec.tree.id, rootLen);
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
          props: { src: assetUrl, alt: assetUrl.split("/").pop() ?? "image" },
        };

        if (overData?.type === "insertion") {
          const parentId = overData.parentId as string;
          const index = overData.index as number;
          addNode(parentId, newNode, index);
          return;
        }

        if (overData?.type === "canvas") {
          const targetId = overData.nodeId as string;
          const isContainer = CONTAINER_TYPES.has(targetId) || spec.tree.id === targetId;
          if (isContainer) {
            addNode(targetId, newNode);
          } else {
            addNode(spec.tree.id, newNode);
          }
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
          return;
        }

        if (overData?.type === "canvas") {
          const targetId = overData.nodeId as string;
          const isContainer = CONTAINER_TYPES.has(targetId) || spec.tree.id === targetId;
          if (isContainer) {
            addNode(targetId, cloned);
          } else {
            addNode(spec.tree.id, cloned);
          }
        }
      }
    },
    [spec, addNode, buildNewNode, moveNode, draggedType, draggedNodeId, draggedAssetUrl, draggedComposite]
  );

  return (
    <div
      className="flex flex-col h-screen"
      onContextMenu={(e) => {
        // Only show context menu if right-clicking on the canvas area
        const target = e.target as HTMLElement;
        if (target.closest("[data-studio-node]")) {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }
      }}
    >
      <TopBar
        screenName={screenName}
        onSave={handleSave}
        onBack={onBack}
        onAIGenerate={() => setShowAIModal(true)}
        onExport={() => setShowExport(true)}
      />
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar -- Component palette + Layers + Fonts */}
          <div className="w-60 border-r bg-background overflow-hidden flex-shrink-0 flex flex-col">
            <div className="flex-1 overflow-y-auto">
              <ComponentPalette />
              <NodeTree />
              <FontPicker />
              <AssetBrowser />
            </div>
          </div>

          {/* Centre -- Canvas */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {compileError && (
              <div className="flex items-center gap-2 px-4 py-2 text-sm bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                <span className="font-medium">Compile warning:</span>
                <span className="flex-1 truncate">{compileError}</span>
                <button
                  onClick={() => setCompileError(null)}
                  className="ml-auto text-amber-600 hover:text-amber-900 dark:hover:text-amber-100 font-bold"
                >
                  &times;
                </button>
              </div>
            )}
            <EditorCanvas
              isDragging={!!draggedType || !!draggedNodeId || !!draggedAssetUrl || !!draggedComposite}
              activeFrames={activeFrames}
            />
          </div>

          {/* Right sidebar -- Property panel */}
          <div className="w-72 border-l bg-background overflow-hidden flex-shrink-0">
            <PropertyPanel />
          </div>
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {draggedType ? (
            <div className="px-3 py-2 rounded-md border bg-background shadow-lg text-sm font-medium">
              {NODE_SCHEMAS[draggedType]?.label ?? draggedType}
            </div>
          ) : draggedNodeType ? (
            <div className="px-3 py-2 rounded-md border border-blue-400 bg-blue-50 dark:bg-blue-950 shadow-lg text-sm font-medium text-blue-700 dark:text-blue-300">
              Moving: {NODE_SCHEMAS[draggedNodeType]?.label ?? draggedNodeType}
            </div>
          ) : draggedAssetUrl ? (
            <div className="px-3 py-2 rounded-md border border-green-400 bg-green-50 dark:bg-green-950 shadow-lg text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              Image
            </div>
          ) : draggedComposite ? (
            <div className="px-3 py-2 rounded-md border border-purple-400 bg-purple-50 dark:bg-purple-950 shadow-lg text-sm font-medium text-purple-700 dark:text-purple-300">
              {draggedComposite.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Right-click context menu */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} onClose={() => setCtxMenu(null)} />
      )}

      {/* AI Generate modal */}
      {showAIModal && (
        <AIGenerateModal
          screenName={screenName}
          onGenerated={(newSpec) => {
            // Load the AI-generated spec into the editor
            setSpec(newSpec as import("@/lib/studio/types").ScreenSpec, screenName);
          }}
          onClose={() => setShowAIModal(false)}
        />
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
                      .catch(() => {});
                  }
                }
              }
            },
            importDesignSystem: () => setShowImportTokens(true),
            createDesignSystem: () => setShowDSWizard(true),
            openThemeEditor: () => setShowThemeEditor(true),
            openA11yPanel: () => setShowA11y(true),
            save: handleSave,
            insertNode: (nodeType: string) => {
              const newNode = buildNewNode(nodeType);
              const targetId =
                selectedNodeId && spec
                  ? selectedNodeId
                  : spec?.tree.id;
              if (targetId) addNode(targetId, newNode);
            },
            navigateToScreen: (screen: string) => {
              window.location.href = `/studio/${screen}`;
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
    </div>
  );
}
