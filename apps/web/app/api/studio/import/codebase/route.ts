import { NextResponse } from "next/server";
import { scanLocal, scanNpm, scanGithub } from "@/lib/studio/codebase-scanner";
import type { ScanResult } from "@/lib/studio/types";
import { resolve } from "path";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as {
      type: "local" | "npm" | "github";
      path?: string;
      packageName?: string;
      packageVersion?: string;
      owner?: string;
      repo?: string;
      branch?: string;
      githubToken?: string;
    };

    const warnings: string[] = [];
    let result: ScanResult;

    switch (body.type) {
      case "local": {
        if (!body.path) {
          return NextResponse.json({ error: "path is required for local scan" }, { status: 400 });
        }
        const safePath = resolve(body.path);
        // Security: path must be absolute and not try to escape via traversal
        if (body.path.includes("..") || !safePath) {
          return NextResponse.json({ error: "Invalid path — path traversal not allowed" }, { status: 400 });
        }
        result = await scanLocal(safePath, warnings);
        break;
      }

      case "npm": {
        if (!body.packageName) {
          return NextResponse.json({ error: "packageName is required for npm scan" }, { status: 400 });
        }
        result = await scanNpm(body.packageName, body.packageVersion ?? "latest", warnings);
        break;
      }

      case "github": {
        if (!body.owner || !body.repo) {
          return NextResponse.json({ error: "owner and repo are required for GitHub scan" }, { status: 400 });
        }
        if (!body.githubToken) {
          return NextResponse.json({ error: "githubToken is required for GitHub scan" }, { status: 400 });
        }
        result = await scanGithub(
          body.owner,
          body.repo,
          body.branch ?? "main",
          body.githubToken,
          warnings,
        );
        break;
      }

      default:
        return NextResponse.json({ error: "type must be one of: local, npm, github" }, { status: 400 });
    }

    return NextResponse.json({ result });
  } catch (err) {
    console.error("[import/codebase]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
