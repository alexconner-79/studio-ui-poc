/**
 * Pure-function compiler: JSON in, strings out. No filesystem I/O.
 *
 * Used by API routes and future SaaS serverless functions.
 * All inputs are passed as arguments — the function reads nothing from disk.
 */

import type { StudioConfig } from "./config";
import type { ScreenSpec, Node } from "./types";
import type { Emitter, EmittedFile } from "./emitters/types";
import { nextjsEmitter } from "./emitters/nextjs";
import { vueEmitter } from "./emitters/vue";
import { svelteEmitter } from "./emitters/svelte";
import { htmlEmitter } from "./emitters/html";
import { expoEmitter } from "./emitters/expo";
import { resolveRefsInTree, type ComponentDefInput } from "./resolve-refs";

// validate.ts imports ajv which lives in the monorepo root node_modules.
// iCloud can evict those files causing require() to hang indefinitely.
// We lazy-load it only when explicitly requested, never at module-load time.
type ValidateFn = (spec: ScreenSpec) => void;
let _cachedValidate: ValidateFn | null | undefined;
function getValidateFn(): ValidateFn | null {
  if (_cachedValidate !== undefined) return _cachedValidate;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _cachedValidate = (require("./validate") as { validateSpec: ValidateFn }).validateSpec;
  } catch {
    _cachedValidate = null;
  }
  return _cachedValidate;
}

export type { EmittedFile };

const EMITTERS: Record<string, Emitter> = {
  nextjs: nextjsEmitter,
  vue: vueEmitter,
  svelte: svelteEmitter,
  html: htmlEmitter,
  expo: expoEmitter,
};

export type CompileError = {
  filePath: string;
  message: string;
};

export type CompileResult = {
  files: EmittedFile[];
  errors: CompileError[];
  summary: { succeeded: number; failed: number; skipped: number };
};

export type CompileFromMemoryInput = {
  specs: { name: string; spec: ScreenSpec }[];
  config: StudioConfig;
  componentDefs?: ComponentDefInput[];
  /** Skip schema validation — use when specs are trusted (e.g. saved via the editor). */
  skipValidation?: boolean;
};

/**
 * Recursively strip nodes with `compile === false` from the tree.
 * Returns null if the root itself is non-compile.
 */
function filterNonCompileNodes(node: Node): Node | null {
  if (node.compile === false) return null;
  if (!node.children) return node;
  const filtered = node.children
    .map(filterNonCompileNodes)
    .filter((n): n is Node => n !== null);
  return { ...node, children: filtered.length > 0 ? filtered : undefined };
}

export function compileFromMemory(input: CompileFromMemoryInput): CompileResult {
  const { specs, config, componentDefs } = input;
  const emitter = EMITTERS[config.framework];

  if (!emitter) {
    throw new Error(
      `No emitter for framework "${config.framework}". Available: ${Object.keys(EMITTERS).join(", ")}`
    );
  }

  const defsMap = new Map<string, ComponentDefInput>();
  if (componentDefs) {
    for (const def of componentDefs) {
      defsMap.set(def.id, def);
    }
  }

  const allFiles: EmittedFile[] = [];
  const componentNames: string[] = [];
  const errors: CompileError[] = [];
  let skipped = 0;

  for (const { name, spec } of specs) {
    // Validation is advisory — specs saved by the editor are trusted.
    // skipValidation avoids loading ajv (which may hang due to iCloud eviction).
    if (!input.skipValidation) {
      const validate = getValidateFn();
      if (validate) {
        try {
          validate(spec);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push({ filePath: name, message: `Validation warning (continuing): ${message}` });
        }
      }
    }

    const resolvedSpec = defsMap.size > 0
      ? { ...spec, tree: resolveRefsInTree(spec.tree, defsMap) }
      : spec;

    const filteredTree = filterNonCompileNodes(resolvedSpec.tree);
    if (!filteredTree) {
      skipped++;
      continue;
    }
    const finalSpec = { ...resolvedSpec, tree: filteredTree };

    try {
      const emitted = emitter.emitScreen(finalSpec, config);
      allFiles.push(...emitted.files);
      componentNames.push(emitted.componentName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ filePath: name, message: `Emit failed: ${message}` });
    }
  }

  const indexFile = emitter.emitBarrelIndex(componentNames, config);
  allFiles.push(indexFile);

  return {
    files: allFiles,
    errors,
    summary: { succeeded: componentNames.length, failed: errors.length, skipped },
  };
}
