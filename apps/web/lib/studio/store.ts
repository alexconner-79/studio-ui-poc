"use client";

import { create } from "zustand";
import { produce, enableMapSet } from "immer";
import type { Node, NodeStyle, ScreenSpec, DesignTokens, ResponsiveOverrides } from "./types";
import type { ComponentDef } from "./component-system";
import { resolveAllRefs, isComponentRef, resetToComponent } from "./component-system";

// Enable Immer support for Set/Map (needed for hiddenNodeIds, lockedNodeIds)
enableMapSet();

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function findNode(root: Node, id: string): Node | null {
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

function findParent(
  root: Node,
  childId: string
): { parent: Node; index: number } | null {
  if (root.children) {
    for (let i = 0; i < root.children.length; i++) {
      if (root.children[i].id === childId) {
        return { parent: root, index: i };
      }
      const found = findParent(root.children[i], childId);
      if (found) return found;
    }
  }
  return null;
}

function removeNodeFromTree(root: Node, nodeId: string): void {
  if (!root.children) return;
  const index = root.children.findIndex((c) => c.id === nodeId);
  if (index !== -1) {
    root.children.splice(index, 1);
    return;
  }
  for (const child of root.children) {
    removeNodeFromTree(child, nodeId);
  }
}

let idCounter = 0;
export function generateId(prefix: string = "node"): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/** Deep-clone a node subtree and assign fresh IDs to every node. */
export function cloneWithNewIds(node: Node): Node {
  const clone: Node = {
    id: generateId(node.type.toLowerCase()),
    type: node.type,
    props: node.props ? JSON.parse(JSON.stringify(node.props)) : undefined,
    children: node.children
      ? node.children.map(cloneWithNewIds)
      : undefined,
    style: node.style ? JSON.parse(JSON.stringify(node.style)) : undefined,
  };
  if (node.interactions) clone.interactions = JSON.parse(JSON.stringify(node.interactions));
  if (node.dataSource) clone.dataSource = JSON.parse(JSON.stringify(node.dataSource));
  if (node.responsive) clone.responsive = JSON.parse(JSON.stringify(node.responsive));
  return clone;
}

// -------------------------------------------------------------------------
// Store
// -------------------------------------------------------------------------

const MAX_HISTORY = 50;

/** Collect all node IDs in a tree. */
function collectAllIds(node: Node): Set<string> {
  const ids = new Set<string>();
  ids.add(node.id);
  if (node.children) {
    for (const child of node.children) {
      collectAllIds(child).forEach((id) => ids.add(id));
    }
  }
  return ids;
}

type EditorState = {
  // Current spec
  spec: ScreenSpec | null;
  screenName: string | null;
  dirty: boolean;

  // Selection
  selectedNodeId: string | null;
  /** Additional selected nodes for multi-select (Shift+click) */
  selectedNodeIds: Set<string>;

  // Clipboard
  clipboard: Node | null;

  // Layers panel state (editor-only, not persisted)
  hiddenNodeIds: Set<string>;
  lockedNodeIds: Set<string>;

  // Project fonts (synced with studio.config.json)
  projectFonts: Array<{ family: string; source: "google" | "local"; weights?: string[]; files?: string[] }>;

  // Image assets (from public/assets/)
  assets: Array<{ name: string; url: string }>;

  // Custom composite components
  customComponents: Array<{ name: string; description: string; category: string; tree: Node }>;

  // Responsive preview (legacy single breakpoint)
  viewportBreakpoint: "full" | "desktop" | "tablet" | "mobile";

  // Canvas frames (new multi-frame mode)
  activeFrames: Array<"mobile" | "tablet" | "desktop">;

  // Design tokens (loaded from /api/studio/tokens)
  designTokens: DesignTokens | null;

  // Rename trigger (set by R shortcut, consumed by Layers panel)
  renamingNodeId: string | null;

  // Preview mode (A1 -- interactive canvas)
  previewMode: boolean;
  /** Runtime state for interactions (tabs active index, modal open/close, visibility toggles, custom state) */
  interactionState: Record<string, unknown>;

  // Responsive editing (A2)
  /** Which breakpoint the property panel is currently editing styles for */
  editingBreakpoint: "base" | "tablet" | "mobile";

  // Component definitions (ref/override system)
  componentDefs: Map<string, ComponentDef>;

  // History (undo/redo)
  history: ScreenSpec[];
  historyIndex: number;

  // Actions
  setSpec: (spec: ScreenSpec, screenName: string) => void;
  selectNode: (id: string | null) => void;
  toggleSelectNode: (id: string) => void;
  clearSelection: () => void;

  updateNode: (nodeId: string, updates: Partial<Node>) => void;
  updateNodeProps: (nodeId: string, props: Record<string, unknown>) => void;
  addNode: (parentId: string, node: Node, index?: number) => void;
  removeNode: (nodeId: string) => void;
  moveNode: (
    nodeId: string,
    newParentId: string,
    newIndex: number
  ) => void;

  renameNode: (oldId: string, newId: string) => void;
  toggleNodeVisibility: (nodeId: string) => void;
  toggleNodeLock: (nodeId: string) => void;
  isNodeLocked: (nodeId: string) => boolean;
  isNodeHidden: (nodeId: string) => boolean;

  setProjectFonts: (fonts: EditorState["projectFonts"]) => void;
  addProjectFont: (font: EditorState["projectFonts"][number]) => void;
  removeProjectFont: (family: string) => void;

  setAssets: (assets: EditorState["assets"]) => void;
  addAsset: (asset: EditorState["assets"][number]) => void;
  removeAsset: (name: string) => void;

  setCustomComponents: (c: EditorState["customComponents"]) => void;
  addCustomComponent: (c: EditorState["customComponents"][number]) => void;
  removeCustomComponent: (name: string) => void;

  setViewportBreakpoint: (bp: EditorState["viewportBreakpoint"]) => void;
  setActiveFrames: (frames: EditorState["activeFrames"]) => void;
  toggleFrame: (frame: "mobile" | "tablet" | "desktop") => void;

  setRenamingNodeId: (id: string | null) => void;
  groupIntoStack: () => void;

  // Style
  updateNodeStyle: (nodeId: string, style: Partial<NodeStyle>) => void;

  // Responsive overrides
  setEditingBreakpoint: (bp: "base" | "tablet" | "mobile") => void;
  updateNodeResponsiveStyle: (nodeId: string, breakpoint: "tablet" | "mobile", style: Partial<NodeStyle>) => void;

  // Design tokens
  loadDesignTokens: () => Promise<void>;

  // Preview mode
  setPreviewMode: (mode: boolean) => void;
  togglePreviewMode: () => void;
  setInteractionStateValue: (key: string, value: unknown) => void;
  getInteractionStateValue: (key: string) => unknown;
  resetInteractionState: () => void;

  copyNode: () => void;
  pasteNode: () => void;
  duplicateNode: () => void;
  moveNodeUp: () => void;
  moveNodeDown: () => void;

  undo: () => void;
  redo: () => void;
  markClean: () => void;

  // Component system (ref/override)
  addComponentDef: (def: ComponentDef) => void;
  removeComponentDef: (id: string) => void;
  updateComponentDef: (id: string, tree: Node) => void;
  createComponentFromNode: (nodeId: string) => string | null;
  createInstanceOfComponent: (defId: string, parentId: string, index?: number) => void;
  resetInstanceToComponent: (nodeId: string) => void;
  resolvedTree: () => Node | null;
};

function pushHistory(state: EditorState): void {
  if (!state.spec) return;
  // Truncate any redo history
  const newHistory = state.history.slice(0, state.historyIndex + 1);
  newHistory.push(JSON.parse(JSON.stringify(state.spec)));
  if (newHistory.length > MAX_HISTORY) {
    newHistory.shift();
  }
  state.history = newHistory;
  state.historyIndex = newHistory.length - 1;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  spec: null,
  screenName: null,
  dirty: false,
  selectedNodeId: null,
  selectedNodeIds: new Set<string>(),
  clipboard: null,
  hiddenNodeIds: new Set<string>(),
  lockedNodeIds: new Set<string>(),
  projectFonts: [],
  assets: [],
  customComponents: [],
  viewportBreakpoint: "full",
  activeFrames: ["desktop"],
  designTokens: null,
  renamingNodeId: null,
  previewMode: false,
  interactionState: {},
  editingBreakpoint: "base",
  componentDefs: new Map<string, ComponentDef>(),
  history: [],
  historyIndex: -1,

  setSpec: (spec, screenName) =>
    set({
      spec: JSON.parse(JSON.stringify(spec)),
      screenName,
      dirty: false,
      selectedNodeId: null,
      selectedNodeIds: new Set<string>(),
      hiddenNodeIds: new Set<string>(),
      lockedNodeIds: new Set<string>(),
      history: [JSON.parse(JSON.stringify(spec))],
      historyIndex: 0,
    }),

  selectNode: (id) => set({ selectedNodeId: id, selectedNodeIds: new Set<string>() }),

  toggleSelectNode: (id) =>
    set((state) => {
      const next = new Set(state.selectedNodeIds);
      if (next.has(id)) {
        next.delete(id);
        // If primary selection is cleared, set to first remaining
        const primary = state.selectedNodeId === id
          ? (next.size > 0 ? [...next][0] : null)
          : state.selectedNodeId;
        return { selectedNodeIds: next, selectedNodeId: primary };
      }
      next.add(id);
      // If no primary, set this one
      const primary = state.selectedNodeId ?? id;
      if (state.selectedNodeId) next.add(state.selectedNodeId);
      return { selectedNodeIds: next, selectedNodeId: primary };
    }),

  clearSelection: () => set({ selectedNodeId: null, selectedNodeIds: new Set<string>() }),

  updateNode: (nodeId, updates) =>
    set(
      produce((state: EditorState) => {
        if (!state.spec) return;
        pushHistory(state);
        const node = findNode(state.spec.tree, nodeId);
        if (!node) return;
        Object.assign(node, updates);
        state.dirty = true;
      })
    ),

  updateNodeProps: (nodeId, newProps) =>
    set(
      produce((state: EditorState) => {
        if (!state.spec) return;
        // Lock guard
        if (state.lockedNodeIds.has(nodeId)) return;
        pushHistory(state);
        const node = findNode(state.spec.tree, nodeId);
        if (!node) return;
        node.props = { ...(node.props ?? {}), ...newProps };
        // Remove undefined/null values
        Object.keys(node.props).forEach((key) => {
          if (
            node.props![key] === undefined ||
            node.props![key] === null ||
            node.props![key] === ""
          ) {
            delete node.props![key];
          }
        });
        state.dirty = true;
      })
    ),

  addNode: (parentId, node, index) =>
    set(
      produce((state: EditorState) => {
        if (!state.spec) return;
        pushHistory(state);
        const parent = findNode(state.spec.tree, parentId);
        if (!parent) return;
        if (!parent.children) parent.children = [];
        if (index !== undefined && index >= 0) {
          parent.children.splice(index, 0, node);
        } else {
          parent.children.push(node);
        }
        state.dirty = true;
        state.selectedNodeId = node.id;
      })
    ),

  removeNode: (nodeId) =>
    set(
      produce((state: EditorState) => {
        if (!state.spec) return;
        // Don't allow removing the root node
        if (state.spec.tree.id === nodeId) return;
        // Lock guard
        if (state.lockedNodeIds.has(nodeId)) return;
        pushHistory(state);
        removeNodeFromTree(state.spec.tree, nodeId);
        if (state.selectedNodeId === nodeId) {
          state.selectedNodeId = null;
        }
        state.dirty = true;
      })
    ),

  moveNode: (nodeId, newParentId, newIndex) =>
    set(
      produce((state: EditorState) => {
        if (!state.spec) return;
        const node = findNode(state.spec.tree, nodeId);
        if (!node) return;
        pushHistory(state);
        // Clone the node before removing
        const clone = JSON.parse(JSON.stringify(node));
        removeNodeFromTree(state.spec.tree, nodeId);
        const newParent = findNode(state.spec.tree, newParentId);
        if (!newParent) return;
        if (!newParent.children) newParent.children = [];
        newParent.children.splice(newIndex, 0, clone);
        state.dirty = true;
      })
    ),

  renameNode: (oldId, newId) =>
    set(
      produce((state: EditorState) => {
        if (!state.spec) return;
        // Validate: no empty, no spaces, no duplicates
        const sanitized = newId.trim().replace(/\s+/g, "_");
        if (!sanitized || sanitized === oldId) return;
        // Check for duplicate IDs
        const allIds = collectAllIds(state.spec.tree);
        if (allIds.has(sanitized)) return;
        pushHistory(state);
        const node = findNode(state.spec.tree, oldId);
        if (!node) return;
        node.id = sanitized;
        // Update selected node if it was renamed
        if (state.selectedNodeId === oldId) {
          state.selectedNodeId = sanitized;
        }
        // Update hidden/locked sets if the old ID was present
        if (state.hiddenNodeIds.has(oldId)) {
          state.hiddenNodeIds = new Set(state.hiddenNodeIds);
          state.hiddenNodeIds.delete(oldId);
          state.hiddenNodeIds.add(sanitized);
        }
        if (state.lockedNodeIds.has(oldId)) {
          state.lockedNodeIds = new Set(state.lockedNodeIds);
          state.lockedNodeIds.delete(oldId);
          state.lockedNodeIds.add(sanitized);
        }
        state.dirty = true;
      })
    ),

  toggleNodeVisibility: (nodeId) =>
    set((state) => {
      const next = new Set(state.hiddenNodeIds);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return { hiddenNodeIds: next };
    }),

  toggleNodeLock: (nodeId) =>
    set((state) => {
      const next = new Set(state.lockedNodeIds);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return { lockedNodeIds: next };
    }),

  isNodeLocked: (nodeId) => get().lockedNodeIds.has(nodeId),

  isNodeHidden: (nodeId) => get().hiddenNodeIds.has(nodeId),

  setProjectFonts: (fonts) => set({ projectFonts: fonts }),

  addProjectFont: (font) =>
    set((state) => {
      if (state.projectFonts.some((f) => f.family === font.family)) {
        return state; // Already exists
      }
      return { projectFonts: [...state.projectFonts, font] };
    }),

  removeProjectFont: (family) =>
    set((state) => ({
      projectFonts: state.projectFonts.filter((f) => f.family !== family),
    })),

  setAssets: (assets) => set({ assets }),

  addAsset: (asset) =>
    set((state) => {
      if (state.assets.some((a) => a.name === asset.name)) {
        return state;
      }
      return { assets: [...state.assets, asset] };
    }),

  removeAsset: (name) =>
    set((state) => ({
      assets: state.assets.filter((a) => a.name !== name),
    })),

  setCustomComponents: (c) => set({ customComponents: c }),

  addCustomComponent: (c) =>
    set((state) => {
      if (state.customComponents.some((x) => x.name === c.name)) return state;
      return { customComponents: [...state.customComponents, c] };
    }),

  removeCustomComponent: (name) =>
    set((state) => ({
      customComponents: state.customComponents.filter((c) => c.name !== name),
    })),

  setViewportBreakpoint: (bp) => set({ viewportBreakpoint: bp }),

  setActiveFrames: (frames) => set({ activeFrames: frames }),

  toggleFrame: (frame) =>
    set((state) => {
      const current = state.activeFrames;
      if (current.includes(frame)) {
        // Don't allow removing the last frame
        if (current.length <= 1) return state;
        return { activeFrames: current.filter((f) => f !== frame) };
      }
      return { activeFrames: [...current, frame] };
    }),

  setRenamingNodeId: (id) => set({ renamingNodeId: id }),

  groupIntoStack: () =>
    set(
      produce((state: EditorState) => {
        if (!state.spec || !state.selectedNodeId) return;
        // Can't wrap root
        if (state.selectedNodeId === state.spec.tree.id) return;
        const parentInfo = findParent(state.spec.tree, state.selectedNodeId);
        if (!parentInfo) return;
        const node = parentInfo.parent.children![parentInfo.index];
        if (!node) return;
        pushHistory(state);
        // Create a Stack wrapper
        const stackId = `stack_${Date.now().toString(36)}_${++idCounter}`;
        const wrapper: Node = {
          id: stackId,
          type: "Stack",
          props: { direction: "column", gap: "4" },
          children: [JSON.parse(JSON.stringify(node))],
        };
        // Replace the node in the parent with the wrapper
        parentInfo.parent.children![parentInfo.index] = wrapper;
        state.selectedNodeId = stackId;
        state.dirty = true;
      })
    ),

  updateNodeStyle: (nodeId, style) =>
    set(
      produce((state: EditorState) => {
        if (!state.spec) return;
        if (state.lockedNodeIds.has(nodeId)) return;
        pushHistory(state);
        const node = findNode(state.spec.tree, nodeId);
        if (!node) return;
        node.style = { ...(node.style ?? {}), ...style };
        // Remove undefined/null values
        const s = node.style as Record<string, unknown>;
        for (const key of Object.keys(s)) {
          if (s[key] === undefined || s[key] === null || s[key] === "") {
            delete s[key];
          }
        }
        if (Object.keys(node.style).length === 0) {
          delete node.style;
        }
        state.dirty = true;
      })
    ),

  setEditingBreakpoint: (bp) => set({ editingBreakpoint: bp }),

  updateNodeResponsiveStyle: (nodeId, breakpoint, style) =>
    set(
      produce((state: EditorState) => {
        if (!state.spec) return;
        if (state.lockedNodeIds.has(nodeId)) return;
        pushHistory(state);
        const node = findNode(state.spec.tree, nodeId);
        if (!node) return;
        if (!node.responsive) node.responsive = {};
        node.responsive[breakpoint] = { ...(node.responsive[breakpoint] ?? {}), ...style };
        // Clean up empty values
        const s = node.responsive[breakpoint] as Record<string, unknown>;
        for (const key of Object.keys(s)) {
          if (s[key] === undefined || s[key] === null || s[key] === "") {
            delete s[key];
          }
        }
        if (Object.keys(node.responsive[breakpoint]!).length === 0) {
          delete node.responsive[breakpoint];
        }
        if (Object.keys(node.responsive).length === 0) {
          delete node.responsive;
        }
        state.dirty = true;
      })
    ),

  loadDesignTokens: async () => {
    try {
      const res = await fetch("/api/studio/tokens");
      if (res.ok) {
        const data = await res.json();
        const tokens = data.tokens ?? data;
        set({ designTokens: { ...tokens, raw: tokens } });
      }
    } catch {
      // silently fail - tokens are optional
    }
  },

  setPreviewMode: (mode) =>
    set({ previewMode: mode, selectedNodeId: mode ? null : get().selectedNodeId }),

  togglePreviewMode: () => {
    const current = get().previewMode;
    set({ previewMode: !current, selectedNodeId: !current ? null : get().selectedNodeId });
  },

  setInteractionStateValue: (key, value) =>
    set((state) => ({
      interactionState: { ...state.interactionState, [key]: value },
    })),

  getInteractionStateValue: (key) => get().interactionState[key],

  resetInteractionState: () => set({ interactionState: {} }),

  copyNode: () => {
    const { spec, selectedNodeId } = get();
    if (!spec || !selectedNodeId) return;
    const node = findNode(spec.tree, selectedNodeId);
    if (!node) return;
    set({ clipboard: JSON.parse(JSON.stringify(node)) });
  },

  pasteNode: () => {
    const { spec, selectedNodeId, clipboard } = get();
    if (!spec || !clipboard) return;
    const clone = cloneWithNewIds(clipboard);
    if (selectedNodeId) {
      const parentInfo = findParent(spec.tree, selectedNodeId);
      if (parentInfo) {
        get().addNode(parentInfo.parent.id, clone, parentInfo.index + 1);
        return;
      }
    }
    // Fallback: add to root
    get().addNode(spec.tree.id, clone);
  },

  duplicateNode: () => {
    const { spec, selectedNodeId } = get();
    if (!spec || !selectedNodeId || selectedNodeId === spec.tree.id) return;
    const node = findNode(spec.tree, selectedNodeId);
    if (!node) return;
    const clone = cloneWithNewIds(node);
    const parentInfo = findParent(spec.tree, selectedNodeId);
    if (parentInfo) {
      get().addNode(parentInfo.parent.id, clone, parentInfo.index + 1);
    }
  },

  moveNodeUp: () =>
    set(
      produce((state: EditorState) => {
        if (!state.spec || !state.selectedNodeId) return;
        if (state.selectedNodeId === state.spec.tree.id) return;
        const info = findParent(state.spec.tree, state.selectedNodeId);
        if (!info || info.index === 0) return;
        pushHistory(state);
        const [node] = info.parent.children!.splice(info.index, 1);
        info.parent.children!.splice(info.index - 1, 0, node);
        state.dirty = true;
      })
    ),

  moveNodeDown: () =>
    set(
      produce((state: EditorState) => {
        if (!state.spec || !state.selectedNodeId) return;
        if (state.selectedNodeId === state.spec.tree.id) return;
        const info = findParent(state.spec.tree, state.selectedNodeId);
        if (!info || !info.parent.children) return;
        if (info.index >= info.parent.children.length - 1) return;
        pushHistory(state);
        const [node] = info.parent.children.splice(info.index, 1);
        info.parent.children.splice(info.index + 1, 0, node);
        state.dirty = true;
      })
    ),

  undo: () =>
    set(
      produce((state: EditorState) => {
        if (state.historyIndex <= 0) return;
        state.historyIndex -= 1;
        state.spec = JSON.parse(
          JSON.stringify(state.history[state.historyIndex])
        );
        state.dirty = true;
      })
    ),

  redo: () =>
    set(
      produce((state: EditorState) => {
        if (state.historyIndex >= state.history.length - 1) return;
        state.historyIndex += 1;
        state.spec = JSON.parse(
          JSON.stringify(state.history[state.historyIndex])
        );
        state.dirty = true;
      })
    ),

  markClean: () => set({ dirty: false }),

  // Component system actions
  addComponentDef: (def) =>
    set((state) => {
      const next = new Map(state.componentDefs);
      next.set(def.id, def);
      return { componentDefs: next };
    }),

  removeComponentDef: (id) =>
    set((state) => {
      const next = new Map(state.componentDefs);
      next.delete(id);
      return { componentDefs: next };
    }),

  updateComponentDef: (id, tree) =>
    set((state) => {
      const existing = state.componentDefs.get(id);
      if (!existing) return state;
      const next = new Map(state.componentDefs);
      next.set(id, { ...existing, tree: JSON.parse(JSON.stringify(tree)) });
      return { componentDefs: next };
    }),

  createComponentFromNode: (nodeId) => {
    const { spec, componentDefs } = get();
    if (!spec) return null;
    const node = findNode(spec.tree, nodeId);
    if (!node) return null;

    const defId = generateId("comp");
    const def: ComponentDef = {
      id: defId,
      name: node.id,
      tree: JSON.parse(JSON.stringify(node)),
    };

    const next = new Map(componentDefs);
    next.set(defId, def);

    set(
      produce((state: EditorState) => {
        if (!state.spec) return;
        pushHistory(state);
        const target = findNode(state.spec.tree, nodeId);
        if (!target) return;
        const refNode: Node = {
          id: target.id,
          type: "ComponentRef",
          props: { ref: defId },
        };
        Object.assign(target, refNode);
        delete target.children;
        delete target.style;
        delete target.interactions;
        delete target.dataSource;
        delete target.responsive;
        state.componentDefs = next;
        state.dirty = true;
      })
    );

    return defId;
  },

  createInstanceOfComponent: (defId, parentId, index) => {
    const { componentDefs } = get();
    const def = componentDefs.get(defId);
    if (!def) return;
    const instanceNode: Node = {
      id: generateId("inst"),
      type: "ComponentRef",
      props: { ref: defId },
    };
    get().addNode(parentId, instanceNode, index);
  },

  resetInstanceToComponent: (nodeId) =>
    set(
      produce((state: EditorState) => {
        if (!state.spec) return;
        const node = findNode(state.spec.tree, nodeId);
        if (!node || !isComponentRef(node)) return;
        pushHistory(state);
        const reset = resetToComponent(node);
        Object.assign(node, reset);
        state.dirty = true;
      })
    ),

  resolvedTree: () => {
    const { spec, componentDefs } = get();
    if (!spec) return null;
    return resolveAllRefs(spec.tree, componentDefs);
  },
}));
