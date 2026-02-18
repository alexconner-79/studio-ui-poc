/**
 * Pure-function compiler: JSON in, strings out. No filesystem I/O.
 *
 * Used by API routes and future SaaS serverless functions.
 * All inputs are passed as arguments — the function reads nothing from disk.
 */

import type { StudioConfig } from "./config";
import type { ScreenSpec } from "./types";
import type { Emitter, EmittedFile } from "./emitters/types";
import { nextjsEmitter } from "./emitters/nextjs";
import { vueEmitter } from "./emitters/vue";
import { svelteEmitter } from "./emitters/svelte";
import { htmlEmitter } from "./emitters/html";
import { expoEmitter } from "./emitters/expo";
import { validateSpec } from "./validate";
import { resolveRefsInTree, type ComponentDefInput } from "./resolve-refs";

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
};

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

  for (const { name, spec } of specs) {
    try {
      validateSpec(spec);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ filePath: name, message });
      continue;
    }

    const resolvedSpec = defsMap.size > 0
      ? { ...spec, tree: resolveRefsInTree(spec.tree, defsMap) }
      : spec;

    try {
      const emitted = emitter.emitScreen(resolvedSpec, config);
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
    summary: { succeeded: componentNames.length, failed: errors.length, skipped: 0 },
  };
}
