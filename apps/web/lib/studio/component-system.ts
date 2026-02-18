/**
 * Figma-like Component System
 *
 * Replaces deep-copy with a ref/override model:
 * - ComponentDef: a reusable subtree marked with `reusable: true`
 * - ComponentRef: a node with type "ComponentRef" that references a definition
 *   and applies overrides (root props/style) and descendant overrides (by ID path)
 * - Slots: designated frames that accept injected children from instances
 *
 * Resolution happens at render time (editor) and compile time (emitters).
 * Emitters receive the fully resolved tree -- no changes to emitter code needed.
 */

import type { Node, NodeProps, NodeStyle } from "./types";

export type ComponentDef = {
  id: string;
  name: string;
  tree: Node;
  slots?: string[];
};

export type ComponentRefProps = {
  ref: string;
  overrides?: Partial<NodeProps>;
  styleOverrides?: Partial<NodeStyle>;
  descendants?: Record<string, { props?: Partial<NodeProps>; style?: Partial<NodeStyle> }>;
  slotContent?: Record<string, Node[]>;
};

export function isComponentRef(node: Node): boolean {
  return node.type === "ComponentRef";
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function applyOverridesToNode(
  node: Node,
  propOverrides?: Partial<NodeProps>,
  styleOverrides?: Partial<NodeStyle>,
): Node {
  const result = { ...node };

  if (propOverrides && Object.keys(propOverrides).length > 0) {
    result.props = { ...result.props, ...propOverrides };
  }
  if (styleOverrides && Object.keys(styleOverrides).length > 0) {
    result.style = { ...result.style, ...styleOverrides };
  }

  return result;
}

function applyDescendantOverrides(
  node: Node,
  descendants: Record<string, { props?: Partial<NodeProps>; style?: Partial<NodeStyle> }>,
): Node {
  const result = { ...node };

  const override = descendants[node.id];
  if (override) {
    if (override.props) result.props = { ...result.props, ...override.props };
    if (override.style) result.style = { ...result.style, ...override.style };
  }

  if (result.children) {
    result.children = result.children.map((child) =>
      applyDescendantOverrides(child, descendants)
    );
  }

  return result;
}

function injectSlotContent(
  node: Node,
  slotContent: Record<string, Node[]>,
): Node {
  if (node.props?.slot && typeof node.props.slot === "string") {
    const slotName = node.props.slot;
    const content = slotContent[slotName];
    if (content && content.length > 0) {
      return { ...node, children: content };
    }
  }

  if (node.children) {
    return {
      ...node,
      children: node.children.map((child) => injectSlotContent(child, slotContent)),
    };
  }

  return node;
}

/**
 * Resolve a ComponentRef node into a fully expanded tree.
 * The result can be rendered directly or passed to an emitter.
 */
export function resolveComponentRef(
  refNode: Node,
  definitions: Map<string, ComponentDef>,
): Node {
  if (!isComponentRef(refNode)) return refNode;

  const refProps = refNode.props as unknown as ComponentRefProps;
  if (!refProps?.ref) return refNode;

  const def = definitions.get(refProps.ref);
  if (!def) {
    return {
      ...refNode,
      type: "Box",
      props: {},
      children: [{
        id: `${refNode.id}_error`,
        type: "Text",
        props: { text: `Missing component: ${refProps.ref}`, variant: "muted" },
      }],
    };
  }

  let resolved = deepClone(def.tree);

  resolved = applyOverridesToNode(resolved, refProps.overrides, refProps.styleOverrides);

  if (refProps.descendants) {
    resolved = applyDescendantOverrides(resolved, refProps.descendants);
  }

  if (refProps.slotContent) {
    resolved = injectSlotContent(resolved, refProps.slotContent);
  }

  resolved.id = refNode.id;

  return resolved;
}

/**
 * Resolve all ComponentRef nodes in a tree recursively.
 */
export function resolveAllRefs(
  tree: Node,
  definitions: Map<string, ComponentDef>,
): Node {
  let resolved = isComponentRef(tree) ? resolveComponentRef(tree, definitions) : { ...tree };

  if (resolved.children) {
    resolved = {
      ...resolved,
      children: resolved.children.map((child) => resolveAllRefs(child, definitions)),
    };
  }

  return resolved;
}

/**
 * Check if a node has any overrides from its component definition.
 */
export function getOverriddenProps(
  instanceNode: Node,
  definition: ComponentDef,
): Set<string> {
  const overridden = new Set<string>();
  const refProps = instanceNode.props as unknown as ComponentRefProps;

  if (refProps?.overrides) {
    for (const key of Object.keys(refProps.overrides)) {
      if (refProps.overrides[key] !== (definition.tree.props ?? {})[key]) {
        overridden.add(key);
      }
    }
  }

  return overridden;
}

/**
 * Reset an instance back to its component definition (clear all overrides).
 */
export function resetToComponent(instanceNode: Node): Node {
  const refProps = instanceNode.props as unknown as ComponentRefProps;
  return {
    ...instanceNode,
    props: {
      ref: refProps.ref,
    } as unknown as NodeProps,
  };
}
