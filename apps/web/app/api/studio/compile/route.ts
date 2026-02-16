import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "../..");

function runCommand(cmd: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd, timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stdout, stderr }));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

/** POST /api/studio/compile -- trigger the compiler */
export async function POST() {
  try {
    // Prefer pre-compiled JS for speed; fall back to ts-node
    const distPath = path.join(ROOT_DIR, "dist/compiler/compile.js");
    const cmd = fs.existsSync(distPath)
      ? "node dist/compiler/compile.js"
      : "npx ts-node compiler/compile.ts";

    const { stdout, stderr } = await runCommand(cmd, ROOT_DIR);

    // Parse output for any per-screen error lines
    const combined = (stdout || "") + "\n" + (stderr || "");
    const errorLines = combined
      .split("\n")
      .filter((l) => l.includes("Validation failed") || l.includes("Emit failed"));

    if (errorLines.length > 0) {
      return NextResponse.json({
        ok: true,
        warnings: errorLines,
        message: `Compiled with ${errorLines.length} warning(s). Some screens had errors but others were compiled successfully.`,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const stderr =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr: string }).stderr ?? "")
        : "";
    const stdout =
      err && typeof err === "object" && "stdout" in err
        ? String((err as { stdout: string }).stdout ?? "")
        : "";

    const combined = stderr + "\n" + stdout;
    const errorLines = combined
      .split("\n")
      .filter(
        (l) =>
          l.includes("Validation failed") ||
          l.includes("Emit failed") ||
          l.includes("Error")
      )
      .slice(0, 10);

    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      {
        error: message,
        details: errorLines.length > 0 ? errorLines : undefined,
      },
      { status: 500 }
    );
  }
}
