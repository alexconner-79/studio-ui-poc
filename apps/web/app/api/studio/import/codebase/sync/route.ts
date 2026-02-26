import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scanLocal, scanNpm, scanGithub, computeTokenDiff } from "@/lib/studio/codebase-scanner";
import type { BrownfieldSourceConfig } from "@/lib/studio/types";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as { dsId: string; githubToken?: string };
    if (!body.dsId) {
      return NextResponse.json({ error: "dsId is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: dsRow } = await supabase
      .from("design_systems")
      .select("tokens, components")
      .eq("id", body.dsId)
      .single();

    if (!dsRow) {
      return NextResponse.json({ error: "Design system not found" }, { status: 404 });
    }

    const currentTokens = (dsRow.tokens ?? {}) as Record<string, unknown>;
    const sourceConfig = (currentTokens as Record<string, unknown>)._sourceConfig as BrownfieldSourceConfig | undefined;

    if (!sourceConfig) {
      return NextResponse.json({ error: "No brownfield source config found. Run initial import first." }, { status: 400 });
    }

    const warnings: string[] = [];
    let newResult;

    switch (sourceConfig.type) {
      case "local":
        newResult = await scanLocal(sourceConfig.path ?? "", warnings);
        break;
      case "npm":
        newResult = await scanNpm(sourceConfig.packageName ?? "", sourceConfig.packageVersion, warnings);
        break;
      case "github": {
        const pat = body.githubToken;
        if (!pat) {
          return NextResponse.json({ error: "githubToken required for re-sync of GitHub source" }, { status: 400 });
        }
        newResult = await scanGithub(
          sourceConfig.owner ?? "",
          sourceConfig.repo ?? "",
          sourceConfig.branch ?? "main",
          pat,
          warnings,
        );
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown source type in stored config" }, { status: 400 });
    }

    const diff = computeTokenDiff(currentTokens, newResult.tokens);

    return NextResponse.json({
      diff,
      components: newResult.components,
      warnings,
      sourceConfig: newResult.sourceConfig,
    });
  } catch (err) {
    console.error("[import/codebase/sync]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
