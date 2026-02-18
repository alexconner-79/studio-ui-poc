/**
 * Resolves ComponentRef nodes in a tree at compile time.
 * Operates on compiler-side Node types (no dependency on browser code).
 */

import type { Node } from "./types";

export type ComponentDefInput = {
  id: string;
  name: string;
  tree: Node;
  slots?: string[];
};

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function applyOverrides(
  node: Node,
  propOverrides?: Record<string, unknown>,
  styleOverrides?: Record<string, unknown>,
): Node {
  const result = { ...node };
  if (propOverrides) result.props = { ...result.props, ...propOverrides };
  if (styleOverrides) result.style = { ...result.style, ...styleOverrides } as Node["style"];
  return result;
}

function applyDescendantOverrides(
  node: Node,
  descendants: Record<string, { props?: Record<string, unknown>; style?: Record<string, unknown> }>,
): Node {
  const result = { ...node };
  const ov = descendants[node.id];
  if (ov) {
    if (ov.props) result.props = { ...result.props, ...ov.props };
    if (ov.style) result.style = { ...result.style, ...ov.style } as Node["style"];
  }
  if (result.children) {
    result.children = result.children.map((c) => applyDescendantOverrides(c, descendants));
  }
  return result;
}

function injectSlotContent(node: Node, slotContent: Record<string, Node[]>): Node {
  if (node.props?.slot && typeof node.props.slot === "string") {
    const content = slotContent[node.props.slot];
    if (content?.length) return { ...node, children: content };
  }
  if (node.children) {
    return { ...node, children: node.children.map((c) => injectSlotContent(c, slotContent)) };
  }
  return node;
}

export function resolveRefsInTree(
  tree: Node,
  defs: Map<string, ComponentDefInput>,
): Node {
  if (tree.type === "ComponentRef") {
    const refId = tree.props?.ref as string | undefined;
    if (!refId) return tree;

    const def = defs.get(refId);
    if (!def) return tree;

    let resolved = deepClone(def.tree);
    resolved = applyOverrides(
      resolved,
      tree.props?.overrides as Record<string, unknown> | undefined,
      tree.props?.styleOverrides as Record<string, unknown> | undefined,
    );
    if (tree.props?.descendants) {
      resolved = applyDescendantOverrides(
        resolved,
        tree.props.descendants as Record<string, { props?: Record<string, unknown>; style?: Record<string, unknown> }>,
      );
    }
    if (tree.props?.slotContent) {
      resolved = injectSlotContent(resolved, tree.props.slotContent as Record<string, Node[]>);
    }
    resolved.id = tree.id;
    return resolveRefsInTree(resolved, defs);
  }

  if (tree.children) {
    return {
      ...tree,
      children: tree.children.map((c) => resolveRefsInTree(c, defs)),
    };
  }
  return tree;
}
