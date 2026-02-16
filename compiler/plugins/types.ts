/**
 * Plugin system types.
 *
 * A NodePlugin registers a custom node type with prop schema,
 * emitter function, and optional runtime renderer hint.
 */

import type { Node } from "../types";

export type PropType = "string" | "number" | "boolean" | "array";

export type PropDef = {
  type: PropType;
  label: string;
  required?: boolean;
  defaultValue?: unknown;
  enum?: unknown[];
};

export interface NodePlugin {
  /** The node type name (must not conflict with built-in types). */
  type: string;

  /** Human-readable label for the editor palette. */
  label: string;

  /** Category for grouping in the editor palette. */
  category?: string;

  /** Description for the editor. */
  description?: string;

  /** Whether this node accepts children. */
  acceptsChildren?: boolean;

  /** Prop schema for validation and the property panel. */
  propSchema: Record<string, PropDef>;

  /**
   * Emit JSX string for the compiler.
   * Receives the node and should return the JSX representation.
   */
  emit(node: Node): string;
}

export interface PluginRegistry {
  /** All loaded plugins indexed by type. */
  plugins: Record<string, NodePlugin>;

  /** Register a new plugin. Throws if type conflicts with built-ins. */
  register(plugin: NodePlugin): void;

  /** Get a plugin by type. Returns undefined if not found. */
  get(type: string): NodePlugin | undefined;

  /** Check if a type is handled by a plugin. */
  has(type: string): boolean;

  /** Get all registered plugins. */
  all(): NodePlugin[];
}
