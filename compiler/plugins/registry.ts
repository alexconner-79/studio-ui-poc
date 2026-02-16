/**
 * Plugin registry -- loads and manages custom node type plugins.
 */

import * as path from "node:path";
import type { NodePlugin, PluginRegistry } from "./types";

const BUILT_IN_TYPES = new Set([
  "Stack",
  "Grid",
  "Section",
  "ScrollArea",
  "Spacer",
  "Heading",
  "Text",
  "Image",
  "Input",
  "Link",
  "Divider",
  "List",
  "Card",
  "Button",
]);

class PluginRegistryImpl implements PluginRegistry {
  plugins: Record<string, NodePlugin> = {};

  register(plugin: NodePlugin): void {
    if (BUILT_IN_TYPES.has(plugin.type)) {
      throw new Error(
        `Plugin type "${plugin.type}" conflicts with a built-in node type`
      );
    }
    if (this.plugins[plugin.type]) {
      throw new Error(
        `Plugin type "${plugin.type}" is already registered`
      );
    }
    this.plugins[plugin.type] = plugin;
  }

  get(type: string): NodePlugin | undefined {
    return this.plugins[type];
  }

  has(type: string): boolean {
    return type in this.plugins;
  }

  all(): NodePlugin[] {
    return Object.values(this.plugins);
  }
}

/**
 * Load plugins from the paths specified in studio.config.json.
 * Each path should point to a JS/TS module that default-exports a
 * NodePlugin object (or an array of NodePlugin objects).
 */
export function loadPlugins(pluginPaths: string[], rootDir?: string): PluginRegistry {
  const registry = new PluginRegistryImpl();
  const root = rootDir ?? process.cwd();

  for (const pluginPath of pluginPaths) {
    const absPath = path.resolve(root, pluginPath);

    let module: unknown;
    try {
      module = require(absPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to load plugin "${pluginPath}": ${message}`);
    }

    const mod = module as Record<string, unknown>;
    const exported = mod.default ?? mod;

    if (Array.isArray(exported)) {
      for (const plugin of exported) {
        validatePlugin(plugin, pluginPath);
        registry.register(plugin as NodePlugin);
      }
    } else if (isPlugin(exported)) {
      validatePlugin(exported, pluginPath);
      registry.register(exported as NodePlugin);
    } else {
      throw new Error(
        `Plugin "${pluginPath}" must export a NodePlugin object or array of NodePlugin objects`
      );
    }
  }

  return registry;
}

/**
 * Create an empty plugin registry.
 */
export function createEmptyRegistry(): PluginRegistry {
  return new PluginRegistryImpl();
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isPlugin(value: unknown): value is NodePlugin {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.type === "string" &&
    typeof obj.emit === "function" &&
    typeof obj.propSchema === "object"
  );
}

function validatePlugin(value: unknown, sourcePath: string): void {
  if (!isPlugin(value)) {
    throw new Error(
      `Plugin from "${sourcePath}" is missing required fields (type, propSchema, emit)`
    );
  }
}
