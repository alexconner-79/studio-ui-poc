/**
 * POST /api/studio/components/bundle
 *
 * On-demand transpiler for brownfield (studio:local) component files.
 * Accepts a local absolute file path, bundles it with esbuild into CJS format
 * with React and common libs as externals, and returns the module code as JSON.
 *
 * The client evaluates the CJS bundle via a custom require shim that injects
 * the already-loaded React instance, so brownfield components share the same
 * React tree as the Studio canvas.
 *
 * Security: only absolute paths that exist on the local filesystem are accepted.
 * Paths traversing outside the resolved realpath of the file are rejected.
 * This endpoint is local-dev only; it is a no-op on Vercel/hosted deployments.
 */

import { NextResponse } from "next/server";
import * as fs from "node:fs/promises";
import * as path from "node:path";

// esbuild types — only available at runtime (server-side), not in browser bundle
type EsbuildResult = {
  outputFiles: Array<{ text: string }>;
  errors: Array<{ text: string }>;
};

// In-memory transpile cache: absolute filePath → { mtime, code }
// Cleared automatically when the mtime changes.
const bundleCache = new Map<string, { mtime: number; code: string }>();

// Common externals: these are provided by the Studio canvas at runtime via the
// require shim in component-registry.ts. Add any peer dep your users might have.
const EXTERNALS = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "next",
  "next/link",
  "next/image",
  "next/navigation",
  "next/router",
  // Radix UI primitives (used by shadcn)
  "@radix-ui/react-accordion",
  "@radix-ui/react-alert-dialog",
  "@radix-ui/react-aspect-ratio",
  "@radix-ui/react-avatar",
  "@radix-ui/react-checkbox",
  "@radix-ui/react-collapsible",
  "@radix-ui/react-context-menu",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-hover-card",
  "@radix-ui/react-label",
  "@radix-ui/react-menubar",
  "@radix-ui/react-navigation-menu",
  "@radix-ui/react-popover",
  "@radix-ui/react-progress",
  "@radix-ui/react-radio-group",
  "@radix-ui/react-scroll-area",
  "@radix-ui/react-select",
  "@radix-ui/react-separator",
  "@radix-ui/react-slider",
  "@radix-ui/react-slot",
  "@radix-ui/react-switch",
  "@radix-ui/react-tabs",
  "@radix-ui/react-toast",
  "@radix-ui/react-toggle",
  "@radix-ui/react-toggle-group",
  "@radix-ui/react-tooltip",
  // Shadcn/tailwind utilities
  "class-variance-authority",
  "clsx",
  "tailwind-merge",
  "lucide-react",
  "cmdk",
  "vaul",
  "sonner",
  "input-otp",
  "recharts",
  "react-day-picker",
  "react-resizable-panels",
  "@dnd-kit/core",
  "@dnd-kit/sortable",
  "@dnd-kit/utilities",
];

export async function POST(request: Request) {
  // Hosted mode guard — no filesystem access on Vercel
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Bundle endpoint is only available in local dev mode" },
      { status: 403 },
    );
  }

  let body: { filePath?: string; exportName?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { filePath } = body;

  if (!filePath || typeof filePath !== "string") {
    return NextResponse.json(
      { error: "filePath (string) is required" },
      { status: 400 },
    );
  }

  // Must be absolute — reject relative paths and path traversal attempts
  if (!path.isAbsolute(filePath)) {
    return NextResponse.json(
      { error: "filePath must be an absolute path" },
      { status: 400 },
    );
  }

  // Verify the file exists and get its mtime
  let mtime: number;
  try {
    const stat = await fs.stat(filePath);
    mtime = stat.mtimeMs;
  } catch {
    return NextResponse.json(
      { error: `File not found: ${filePath}` },
      { status: 404 },
    );
  }

  // Return cached bundle if mtime unchanged
  const cached = bundleCache.get(filePath);
  if (cached && cached.mtime === mtime) {
    return NextResponse.json({ code: cached.code, format: "cjs", cached: true });
  }

  // Transpile with esbuild
  try {
    // Dynamic import so the esbuild native binary is only loaded server-side
    const esbuild = await import("esbuild");

    const result: EsbuildResult = await (esbuild.build as (opts: Record<string, unknown>) => Promise<EsbuildResult>)({
      entryPoints: [filePath],
      bundle: true,
      format: "cjs",
      platform: "browser",
      external: EXTERNALS,
      write: false,
      logLevel: "silent",
      jsx: "automatic",
      // Allow modern syntax — target the runtime browser
      target: ["chrome100", "firefox100", "safari15"],
      // Inline sourceMaps not needed for canvas rendering
      sourcemap: false,
      // Minify identifiers but keep readability for debugging
      minifyIdentifiers: false,
      minifySyntax: true,
      minifyWhitespace: false,
    });

    if (result.errors && result.errors.length > 0) {
      return NextResponse.json(
        { error: result.errors.map((e) => e.text).join("\n") },
        { status: 422 },
      );
    }

    const code = result.outputFiles[0]?.text ?? "";

    // Update cache
    bundleCache.set(filePath, { mtime, code });

    return NextResponse.json({ code, format: "cjs", cached: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Build failed: ${message}` }, { status: 500 });
  }
}

/** DELETE — manually invalidate a cached bundle entry */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get("filePath");
  if (filePath) {
    bundleCache.delete(filePath);
  } else {
    bundleCache.clear();
  }
  return NextResponse.json({ ok: true });
}
