/**
 * Visual preview -- runs the compiler watcher and the Next.js dev server
 * side-by-side so spec edits show up live in the browser.
 *
 * Usage: ts-node compiler/dev.ts
 */

import { spawn, type ChildProcess } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { startWatch } from "./watch";

const NEXT_APP_DIR = path.resolve(process.cwd(), "apps/web");

// -------------------------------------------------------------------------
// Prefixed line writer
// -------------------------------------------------------------------------

function prefixLines(prefix: string, data: Buffer | string): void {
  const text = data.toString();
  // Split on newlines but keep content intact
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.length > 0) {
      process.stdout.write(`${prefix} ${line}\n`);
    }
  }
}

// -------------------------------------------------------------------------
// Next.js dev server
// -------------------------------------------------------------------------

function startNextDev(): ChildProcess {
  const prefix = "\x1b[36m[next]\x1b[0m";

  // Remove stale Turbopack lock file from previous runs
  const lockPath = path.join(NEXT_APP_DIR, ".next", "dev", "lock");
  try {
    fs.unlinkSync(lockPath);
    console.log(`${prefix} Removed stale lock file`);
  } catch {
    // Lock file doesn't exist – nothing to do
  }

  // Detect pnpm location – try common paths
  const pnpmPaths = [
    path.join(process.env.HOME ?? "", ".local/share/pnpm/pnpm"),
    path.join(process.env.HOME ?? "", "Library/pnpm/pnpm"),
    "pnpm",
    "npx",
  ];

  let cmd = "pnpm";
  for (const p of pnpmPaths) {
    try {
      require("node:child_process").execSync(`${p} --version`, {
        stdio: "ignore",
      });
      cmd = p;
      break;
    } catch {
      continue;
    }
  }

  const child = spawn(cmd, ["next", "dev"], {
    cwd: NEXT_APP_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "1" },
  });

  child.stdout?.on("data", (data: Buffer) => prefixLines(prefix, data));
  child.stderr?.on("data", (data: Buffer) => prefixLines(prefix, data));

  child.on("error", (err) => {
    console.error(`${prefix} Failed to start: ${err.message}`);
  });

  child.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`${prefix} Exited with code ${code}`);
    }
  });

  return child;
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("Starting Studio visual preview...\n");

  // Start the Next.js dev server as a child process
  const nextProcess = startNextDev();

  // Start the compiler watcher in-process
  const compilerPrefix = "\x1b[33m[compiler]\x1b[0m";
  await startWatch(compilerPrefix);

  // Graceful shutdown
  const cleanup = () => {
    console.log("\nShutting down...");
    if (nextProcess && !nextProcess.killed) {
      nextProcess.kill("SIGTERM");
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
