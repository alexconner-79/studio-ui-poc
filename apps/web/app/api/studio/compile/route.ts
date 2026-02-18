import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import { compileFromMemory } from "../../../../../../compiler/compile-memory";
import type { StudioConfig } from "../../../../../../compiler/config";
import type { ScreenSpec } from "../../../../../../compiler/types";
import { isSupabaseConfigured, listScreens, getProject } from "@/lib/supabase/queries";

const ROOT_DIR = path.resolve(process.cwd(), "../..");

function loadStudioConfig(): StudioConfig {
  const configPath = path.join(ROOT_DIR, "studio.config.json");
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw) as StudioConfig;
}

function loadScreenSpecsFromDisk(screensDir: string): { name: string; spec: ScreenSpec }[] {
  const absDir = path.resolve(ROOT_DIR, screensDir);
  if (!fs.existsSync(absDir)) return [];

  return fs
    .readdirSync(absDir)
    .filter((f) => f.endsWith(".screen.json"))
    .sort()
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

  let prettier: typeof import("prettier") | null = null;
  try {
    prettier = await import("prettier");
  } catch {
    // prettier not available -- write unformatted
  }

  for (const file of files) {
    const absPath = path.resolve(ROOT_DIR, file.path);
    const dir = path.dirname(absPath);
    fs.mkdirSync(dir, { recursive: true });

    let contents = file.contents;

    // Format with prettier if available
    if (prettier) {
      try {
        const prettierConfig = (await prettier.resolveConfig(ROOT_DIR)) ?? {};
        const isTsx = absPath.endsWith(".tsx");
        const isTs = absPath.endsWith(".ts");
        const parser = isTsx || isTs ? "typescript" : undefined;
        contents = await prettier.format(contents, {
          ...prettierConfig,
          filepath: absPath,
          ...(parser ? { parser } : {}),
        });
      } catch {
        // formatting failed -- use raw output
      }
    }

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

    const body = await request.json().catch(() => ({}));
    const projectId = (body as Record<string, unknown>).projectId as string | undefined;

    // Supabase mode: load screens from DB
    if (isSupabaseConfigured() && projectId) {
      const project = await getProject(projectId);
      config = {
        framework: project?.framework ?? "nextjs",
        appDir: "apps/web/app",
        componentsDir: "apps/web/components/ui",
        generatedDir: "apps/web/components/generated",
        screensDir: "spec/screens",
        schemaPath: "spec/schema/screen.schema.json",
        importAlias: "@/",
        ...(project?.config as Record<string, unknown> ?? {}),
      } as StudioConfig;

      const screens = await listScreens(projectId);
      specs = screens.map((s) => ({
        name: `${s.name}.screen.json`,
        spec: s.spec as unknown as ScreenSpec,
      }));
    } else {
      // Filesystem mode
      config = loadStudioConfig();
      specs = loadScreenSpecsFromDisk(config.screensDir);
    }

    if (specs.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "No screen specs found -- nothing to compile.",
      });
    }

    const result = compileFromMemory({ specs, config });

    // In filesystem mode (local dev), write files to disk
    if (!isSupabaseConfigured() || !projectId) {
      const { written, skipped } = await writeCompiledFiles(result.files);
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
