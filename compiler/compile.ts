import * as fs from "node:fs";
import * as path from "node:path";
import * as prettier from "prettier";

import { loadConfig } from "./config";
import { discoverScreens } from "./discover";
import {
  compileFromMemory,
  type CompileResult,
  type CompileError,
  type CompileFromMemoryInput,
} from "./compile-memory";
import type { EmittedFile } from "./emitters/types";

// Re-export pure-function compiler for API routes and external consumers
export { compileFromMemory } from "./compile-memory";
export type { CompileFromMemoryInput, CompileResult, CompileError } from "./compile-memory";
export type { EmittedFile };

// ---------------------------------------------------------------------------
// Helpers (filesystem + formatting)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Filesystem-based compiler: reads from disk, writes to disk.
// Used by the CLI (`ts-node compiler/compile.ts` / `pnpm compile`).
// ---------------------------------------------------------------------------

export async function compile(options?: { write?: boolean }): Promise<CompileResult> {
  const studioConfig = loadConfig();
  const screens = discoverScreens();
  const shouldWrite = options?.write !== false;

  // Delegate to the pure-function compiler
  const specs = screens.map(({ filePath, spec }) => ({ name: filePath, spec }));
  const result = compileFromMemory({ specs, config: studioConfig });

  // Format with prettier and optionally write to disk
  const formattedFiles: EmittedFile[] = [];
  let skipped = 0;

  for (const file of result.files) {
    const absPath = path.resolve(process.cwd(), file.path);
    const formatted = await formatWithPrettier(file.contents, absPath);
    formattedFiles.push({ path: file.path, contents: formatted });

    if (shouldWrite) {
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

  if (result.errors.length > 0) {
    console.error(`\nCompile completed with ${result.errors.length} error(s):`);
    for (const err of result.errors) {
      console.error(`  - ${err.filePath}: ${err.message}`);
    }
  }

  return {
    files: formattedFiles,
    errors: result.errors,
    summary: {
      succeeded: result.summary.succeeded,
      failed: result.summary.failed,
      skipped,
    },
  };
}

// Allow `ts-node compiler/compile.ts`
if (require.main === module) {
  compile().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
