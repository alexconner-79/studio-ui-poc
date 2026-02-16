import * as fs from "node:fs";
import * as path from "node:path";
import * as prettier from "prettier";

import { loadConfig } from "./config";
import { discoverScreens } from "./discover";
import { validateSpec } from "./validate";
import type { Emitter, EmittedFile } from "./emitters/types";
import { nextjsEmitter } from "./emitters/nextjs";
import { vueEmitter } from "./emitters/vue";

export type { EmittedFile };

const EMITTERS: Record<string, Emitter> = {
  nextjs: nextjsEmitter,
  vue: vueEmitter,
};

function getEmitter(framework: string): Emitter {
  const emitter = EMITTERS[framework];
  if (!emitter) {
    throw new Error(
      `No emitter for framework "${framework}". Available: ${Object.keys(EMITTERS).join(", ")}`
    );
  }
  return emitter;
}

function ensureDirForFile(absFilePath: string) {
  const dir = path.dirname(absFilePath);
  fs.mkdirSync(dir, { recursive: true });
}

async function formatWithPrettier(contents: string, absFilePath: string) {
  const config = (await prettier.resolveConfig(process.cwd())) ?? {};
  const isTsx = absFilePath.endsWith(".tsx");
  const isTs = absFilePath.endsWith(".ts");
  const parser = isTsx || isTs ? "typescript" : undefined;
  return prettier.format(contents, {
    ...config,
    filepath: absFilePath,
    ...(parser ? { parser } : {}),
  });
}

export type CompileError = {
  filePath: string;
  message: string;
};

export type CompileResult = {
  files: EmittedFile[];
  errors: CompileError[];
  summary: { succeeded: number; failed: number; skipped: number };
};

export async function compile(options?: { write?: boolean }): Promise<CompileResult> {
  const studioConfig = loadConfig();
  const emitter = getEmitter(studioConfig.framework);
  const screens = discoverScreens();
  const shouldWrite = options?.write !== false;

  const allFiles: EmittedFile[] = [];
  const componentNames: string[] = [];
  const errors: CompileError[] = [];
  let skipped = 0;

  // Per-screen error isolation: validate and emit each screen independently
  for (const { filePath, spec } of screens) {
    try {
      validateSpec(spec);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ filePath, message });
      console.error(`Validation failed for ${filePath}: ${message}`);
      continue;
    }

    try {
      const emitted = emitter.emitScreen(spec, studioConfig);
      allFiles.push(...emitted.files);
      componentNames.push(emitted.componentName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ filePath, message: `Emit failed: ${message}` });
      console.error(`Emit failed for ${filePath}: ${message}`);
    }
  }

  // Generate barrel index for all successfully compiled screens
  const indexFile = emitter.emitBarrelIndex(componentNames, studioConfig);
  allFiles.push(indexFile);

  // Format and optionally write (with output diffing)
  const formattedFiles: EmittedFile[] = [];

  for (const file of allFiles) {
    const absPath = path.resolve(process.cwd(), file.path);
    const formatted = await formatWithPrettier(file.contents, absPath);
    formattedFiles.push({ path: file.path, contents: formatted });

    if (shouldWrite) {
      // Output diffing: skip write if file content is identical
      if (fs.existsSync(absPath)) {
        const existing = fs.readFileSync(absPath, "utf8");
        if (existing === formatted) {
          skipped++;
          continue;
        }
      }
      ensureDirForFile(absPath);
      fs.writeFileSync(absPath, formatted, "utf8");
      console.log(`Generated: ${file.path}`);
    }
  }

  const summary = {
    succeeded: componentNames.length,
    failed: errors.length,
    skipped,
  };

  if (errors.length > 0) {
    console.error(`\nCompile completed with ${errors.length} error(s):`);
    for (const err of errors) {
      console.error(`  - ${err.filePath}: ${err.message}`);
    }
  }

  return { files: formattedFiles, errors, summary };
}

// Allow `ts-node compiler/compile.ts`
if (require.main === module) {
  compile().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
