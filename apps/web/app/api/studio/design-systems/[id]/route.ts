import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getDesignSystem, updateDesignSystem, deleteDesignSystem } from "@/lib/supabase/queries";

// ---------------------------------------------------------------------------
// Spec-baseline merge
//
// Component definitions in the DB were written when the starter was first
// applied. Any fields added to the JSON spec after that point (e.g.
// defaultTemplate, defaultNodeStyle, new prop defaults) are invisible to
// existing DS records. This function reads the boilerplate spec at request
// time and back-fills any missing fields — without ever writing to the DB.
//
// Merge rules (DB always wins):
//   • defaultTemplate  — taken from spec when absent/null in DB record
//   • defaultNodeStyle — taken from spec when absent/null in DB record
//   • props[].default  — filled in per-prop when the DB record's prop lacks
//                        a default value (new props from spec are also added)
// ---------------------------------------------------------------------------

type SpecProp = { name: string; default?: unknown; [key: string]: unknown };
type SpecComponent = {
  name?: string;
  defaultTemplate?: unknown;
  defaultNodeStyle?: unknown;
  props?: SpecProp[];
  [key: string]: unknown;
};

function loadBoilerplateSpec(): Record<string, SpecComponent> {
  try {
    const specPath = path.resolve(
      process.cwd(),
      "../../spec/ds-starters/studio-minimal-web.tokens.json"
    );
    const raw = fs.readFileSync(specPath, "utf-8");
    const parsed = JSON.parse(raw) as { components?: Record<string, SpecComponent> };
    return parsed.components ?? {};
  } catch {
    return {};
  }
}

function findSpecDef(
  spec: Record<string, SpecComponent>,
  componentName: string
): SpecComponent | undefined {
  // Try direct key match first, then search by .name field
  return (
    spec[componentName] ??
    Object.values(spec).find((c) => c.name === componentName)
  );
}

function mergeSpecIntoComponents(
  dbComponents: Record<string, unknown>
): Record<string, unknown> {
  const spec = loadBoilerplateSpec();
  if (Object.keys(spec).length === 0) return dbComponents;

  const merged: Record<string, unknown> = {};

  for (const [key, raw] of Object.entries(dbComponents)) {
    const dbComp = raw as Record<string, unknown>;
    const name = (dbComp.name as string | undefined) ?? key;
    const specDef = findSpecDef(spec, name);

    if (!specDef) {
      merged[key] = dbComp;
      continue;
    }

    // Fill in defaultTemplate if DB record is missing it
    const defaultTemplate =
      dbComp.defaultTemplate != null
        ? dbComp.defaultTemplate
        : (specDef.defaultTemplate ?? null);

    // Fill in defaultNodeStyle if DB record is missing it
    const defaultNodeStyle =
      dbComp.defaultNodeStyle != null
        ? dbComp.defaultNodeStyle
        : (specDef.defaultNodeStyle ?? null);

    // Merge props: for each prop, fill in default from spec if missing
    const dbProps = (dbComp.props as SpecProp[] | undefined) ?? [];
    const specProps = specDef.props ?? [];

    const dbPropMap = new Map(dbProps.map((p) => [p.name, p]));

    // Add any spec props that are entirely absent from the DB record
    for (const sp of specProps) {
      if (!dbPropMap.has(sp.name)) {
        dbPropMap.set(sp.name, sp);
      } else {
        const existing = dbPropMap.get(sp.name)!;
        if (existing.default === undefined && sp.default !== undefined) {
          dbPropMap.set(sp.name, { ...existing, default: sp.default });
        }
      }
    }

    const mergedProps = Array.from(dbPropMap.values());

    merged[key] = {
      ...dbComp,
      ...(defaultTemplate != null ? { defaultTemplate } : {}),
      ...(defaultNodeStyle != null ? { defaultNodeStyle } : {}),
      props: mergedProps,
    };
  }

  return merged;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ds = await getDesignSystem(id);
    if (!ds) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Enrich component definitions with any fields added to the spec after this
    // DS was created (e.g. defaultTemplate, defaultNodeStyle, prop defaults).
    const rawComponents = (ds.components ?? {}) as Record<string, unknown>;
    const enrichedComponents = mergeSpecIntoComponents(rawComponents);

    return NextResponse.json({
      designSystem: { ...ds, components: enrichedComponents },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const ds = await updateDesignSystem(id, body);
    return NextResponse.json({ designSystem: ds });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteDesignSystem(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
