import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { compileFromMemory } from "../../../../../../compiler/compile-memory";
import type { StudioConfig } from "../../../../../../compiler/config";
import type { ScreenSpec } from "../../../../../../compiler/types";
import { isSupabaseConfigured, listScreens, getProject } from "@/lib/supabase/queries";
import { ROOT_DIR } from "@/lib/studio/config-paths";
import { loadCache, saveCache, filterChangedScreens } from "../../../../../../compiler/compile-cache";

function loadStudioConfig(): StudioConfig {
  const configPath = path.join(ROOT_DIR, "studio.config.json");
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw) as StudioConfig;
}

function loadScreenSpecsFromDisk(
  screensDir: string,
  filesToLoad?: string[],
): { name: string; spec: ScreenSpec }[] {
  const absDir = path.resolve(ROOT_DIR, screensDir);
  if (!fs.existsSync(absDir)) return [];

  const allFiles = fs
    .readdirSync(absDir)
    .filter((f) => f.endsWith(".screen.json"))
    .sort();

  const targetFiles = filesToLoad ?? allFiles;

  return targetFiles
    .filter((f) => allFiles.includes(f))
    .map((f) => {
      const raw = fs.readFileSync(path.join(absDir, f), "utf8");
      return { name: f, spec: JSON.parse(raw) as ScreenSpec };
    });
}

async function writeCompiledFiles(files: { path: string; contents: string }[]): Promise<{
  written: number;
  skipped: number;
}> {
  let written = 0;
  let skipped = 0;

  for (const file of files) {
    const absPath = path.resolve(ROOT_DIR, file.path);
    const dir = path.dirname(absPath);
    fs.mkdirSync(dir, { recursive: true });

    const { contents } = file;

    if (fs.existsSync(absPath)) {
      const existing = fs.readFileSync(absPath, "utf8");
      if (existing === contents) {
        skipped++;
        continue;
      }
    }

    fs.writeFileSync(absPath, contents, "utf8");
    written++;
  }

  return { written, skipped };
}

/** POST /api/studio/compile -- in-process compiler */
export async function POST(request: Request) {
  try {
    let config: StudioConfig;
    let specs: { name: string; spec: ScreenSpec }[];
    let pendingCache: Record<string, { mtimeMs: number }> | null = null;

    const body = await request.json().catch(() => ({}));
    const projectId = (body as Record<string, unknown>).projectId as string | undefined;

    // Resolve the design-tokens file to an absolute path so the emitter can find it
    // regardless of process.cwd() (which is apps/web/ inside Next.js).
    const absTokensPath = path.resolve(ROOT_DIR, "tokens/design-tokens.json");
    const tokensPathArg = fs.existsSync(absTokensPath) ? absTokensPath : undefined;

    // Supabase mode: load screens from DB
    if (isSupabaseConfigured() && projectId) {
      const project = await getProject(projectId);
      config = {
        framework: "nextjs", // In-app compile always targets the Next.js web app
        appDir: "apps/web/app",
        componentsDir: "apps/web/components/ui",
        generatedDir: "apps/web/components/generated",
        screensDir: "spec/screens",
        schemaPath: "spec/schema/screen.schema.json",
        importAlias: "@/",
        ...(project?.config as Record<string, unknown> ?? {}),
        // Always override tokens with the resolved absolute path
        ...(tokensPathArg ? { tokens: tokensPathArg } : {}),
      } as StudioConfig;

      const screens = await listScreens(projectId);
      specs = screens.map((s) => ({
        name: `${s.name}.screen.json`,
        spec: s.spec as unknown as ScreenSpec,
      }));
    } else {
      // Filesystem mode -- use incremental cache to skip unchanged screens
      config = loadStudioConfig();
      // Resolve tokens path to absolute so the emitter finds it from any cwd
      if (tokensPathArg) config = { ...config, tokens: tokensPathArg };
      const absScreensDir = path.resolve(ROOT_DIR, config.screensDir);
      const allScreenFiles = fs.existsSync(absScreensDir)
        ? fs.readdirSync(absScreensDir).filter((f) => f.endsWith(".screen.json")).sort()
        : [];
      const cache = loadCache(ROOT_DIR);
      const { changedFiles, updatedCache } = filterChangedScreens(absScreensDir, allScreenFiles, cache);
      // If all screens are cached, still compile them all (first run safety); otherwise only changed ones
      specs = loadScreenSpecsFromDisk(
        config.screensDir,
        changedFiles.length > 0 ? changedFiles : allScreenFiles,
      );
      pendingCache = updatedCache;
    }

    if (specs.length === 0) {
      if (pendingCache) saveCache(ROOT_DIR, pendingCache);
      return NextResponse.json({
        ok: true,
        message: "No screen specs found -- nothing to compile.",
      });
    }

    // skipValidation: specs from the editor are already trusted; skipping avoids
    // loading ajv from monorepo root node_modules which iCloud may evict.
    const result = compileFromMemory({ specs, config, skipValidation: true });

    // Always write to disk in local dev so the preview iframe can load the correct output.
    // In production (Vercel), the filesystem is read-only so we skip writing.
    const isProduction = process.env.NODE_ENV === "production";
    if (!isProduction) {
      // Rebuild a comprehensive barrel index from ALL existing *.generated.tsx files on disk
      // so that a partial/filtered compile run doesn't wipe exports for other screens.
      const filesToWrite = [...result.files];
      const generatedAbsDir = path.resolve(ROOT_DIR, config.generatedDir);
      if (fs.existsSync(generatedAbsDir)) {
        const existingFiles = fs.readdirSync(generatedAbsDir).filter((f) => f.endsWith(".generated.tsx"));
        // Extract component names from existing files (e.g. "Dashboard.generated.tsx" -> "Dashboard")
        const existingNames = existingFiles.map((f) => f.replace(".generated.tsx", ""));
        // Merge with newly compiled names (de-dup)
        const newNames = result.files
          .filter((f) => f.path.endsWith(".generated.tsx"))
          .map((f) => path.basename(f.path).replace(".generated.tsx", ""));
        const allNames = Array.from(new Set([...existingNames, ...newNames])).sort();
        if (allNames.length > 0) {
          // Replace the barrel index in filesToWrite with the comprehensive one
          const barrelIdx = filesToWrite.findIndex((f) => f.path.endsWith("/index.ts") || f.path.endsWith("\\index.ts"));
          const barrelContents =
            `/** Auto-generated barrel index */\n` +
            allNames.map((n) => `export { ${n} } from "./${n}.generated";`).join("\n") +
            "\n";
          if (barrelIdx >= 0) {
            filesToWrite[barrelIdx] = { ...filesToWrite[barrelIdx], contents: barrelContents };
          }
        }
      }
      const { written, skipped } = await writeCompiledFiles(filesToWrite);
      // Persist cache after successful write
      if (pendingCache) saveCache(ROOT_DIR, pendingCache);
      if (result.errors.length > 0) {
        return NextResponse.json({
          ok: true,
          warnings: result.errors.map((e) => `${e.filePath}: ${e.message}`),
          message: `Compiled with ${result.errors.length} warning(s). ${result.summary.succeeded} screen(s) succeeded.`,
          written,
          skipped,
        });
      }
      return NextResponse.json({ ok: true, compiled: result.summary.succeeded, written, skipped });
    }

    // Supabase mode: return files as JSON (caller stores or downloads)
    if (result.errors.length > 0) {
      return NextResponse.json({
        ok: true,
        warnings: result.errors.map((e) => `${e.filePath}: ${e.message}`),
        files: result.files,
        compiled: result.summary.succeeded,
      });
    }

    return NextResponse.json({
      ok: true,
      compiled: result.summary.succeeded,
      files: result.files,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
