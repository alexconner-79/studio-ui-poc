import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const STARTERS_DIR = path.resolve(process.cwd(), "../../spec/ds-starters");

export interface DSStarter {
  id: string;
  name: string;
  description: string;
  platform: "web" | "native" | "universal";
  /** "boilerplate" = Studio's own; "library" = external; "hidden" = excluded from picker */
  category?: string;
  /** If set, the API merges this named starter's components block into this one */
  inheritsComponents?: string;
  preview: string[];
  tokens: Record<string, unknown>;
  components?: Record<string, unknown>;
  packageName?: string;
  packageNameNative?: string;
}

function loadAllStarters(): DSStarter[] {
  if (!fs.existsSync(STARTERS_DIR)) return [];
  return fs
    .readdirSync(STARTERS_DIR)
    .filter((f) => f.endsWith(".tokens.json"))
    .map((file) => {
      try {
        const raw = fs.readFileSync(path.join(STARTERS_DIR, file), "utf-8");
        return JSON.parse(raw) as DSStarter;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as DSStarter[];
}

/**
 * Resolve `inheritsComponents` — when a starter declares this field, we merge
 * the named starter's components object into this one so lean theme files
 * (which only carry token values) still have a full component set.
 */
function resolveComponents(
  starter: DSStarter,
  allStarters: DSStarter[]
): Record<string, unknown> {
  if (starter.components && Object.keys(starter.components).length > 0) {
    return starter.components;
  }
  if (starter.inheritsComponents) {
    const base = allStarters.find((s) => s.id === starter.inheritsComponents);
    if (base?.components) return base.components;
  }
  return {};
}

function findCompDef(
  components: Record<string, unknown>,
  name: string
): Record<string, unknown> | undefined {
  return (
    (components[name] as Record<string, unknown> | undefined) ??
    (Object.values(components).find(
      (c) => (c as Record<string, unknown>)?.name === name
    ) as Record<string, unknown> | undefined)
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const starterId = searchParams.get("starter");
    const componentName = searchParams.get("component");
    const importPath = searchParams.get("importPath");

    const allStarters = loadAllStarters();

    // ---------------------------------------------------------------------------
    // Component template lookup
    // ?starter=<id>&component=<name>    — scoped by starter
    // ?importPath=<pkg>&component=<name> — scoped by package name
    // ?component=<name>                  — search all starters
    // ---------------------------------------------------------------------------
    if (componentName) {
      if (starterId || importPath) {
        const starter = starterId
          ? allStarters.find((s) => s.id === starterId)
          : allStarters.find(
              (s) =>
                s.packageName === importPath ||
                s.packageNameNative === importPath
            );
        if (!starter) {
          return NextResponse.json(
            { error: "Starter not found" },
            { status: 404 }
          );
        }
        const components = resolveComponents(starter, allStarters);
        const compDef = findCompDef(components, componentName);
        if (!compDef) {
          return NextResponse.json(
            { error: "Component not found" },
            { status: 404 }
          );
        }
        return NextResponse.json({
          defaultTemplate: compDef.defaultTemplate ?? null,
          defaultNodeStyle: compDef.defaultNodeStyle ?? null,
        });
      }

      // No starter specified — search all non-hidden starters
      for (const starter of allStarters) {
        if (starter.category === "hidden") continue;
        const components = resolveComponents(starter, allStarters);
        const compDef = findCompDef(components, componentName);
        if (compDef?.defaultTemplate) {
          return NextResponse.json({
            defaultTemplate: compDef.defaultTemplate,
            defaultNodeStyle: compDef.defaultNodeStyle ?? null,
          });
        }
      }
      return NextResponse.json({ defaultTemplate: null, defaultNodeStyle: null });
    }

    // ---------------------------------------------------------------------------
    // Default: return all visible starters, with components resolved
    // ---------------------------------------------------------------------------

    // Filter out hidden starters (e.g. shadcn — it is the boilerplate rendering
    // engine, not a user-facing choice)
    const visibleStarters = allStarters.filter(
      (s) => s.category !== "hidden"
    );

    // Resolve components for each starter so callers always get the full set
    const resolved = visibleStarters.map((starter) => ({
      ...starter,
      components: resolveComponents(starter, allStarters),
    }));

    // Sort: boilerplate first, then library, then universal, by name within group
    const categoryOrder: Record<string, number> = {
      boilerplate: 0,
      library: 1,
      universal: 2,
    };
    const platformFallback: Record<string, number> = {
      web: 0,
      native: 1,
      universal: 2,
    };
    resolved.sort((a, b) => {
      const catA = categoryOrder[a.category ?? "library"] ?? 9;
      const catB = categoryOrder[b.category ?? "library"] ?? 9;
      if (catA !== catB) return catA - catB;
      const platA = platformFallback[a.platform] ?? 9;
      const platB = platformFallback[b.platform] ?? 9;
      return platA - platB;
    });

    return NextResponse.json({ starters: resolved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
