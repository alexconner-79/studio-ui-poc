#!/usr/bin/env ts-node
/**
 * Studio CLI — thin wrapper around the compiler and spec filesystem.
 *
 * Usage:
 *   pnpm studio compile [screen]   Compile all screens (or a single one)
 *   pnpm studio lint [screen]      Lint all screens (or a single one)
 *   pnpm studio list-screens       List all screen spec files
 *   pnpm studio get-screen <name>  Print a screen spec as JSON
 *   pnpm studio tokens             Print the current design tokens
 *   pnpm studio help               Show this help message
 *
 * Runs from any directory inside the monorepo — walks up to find studio.config.json.
 */

import * as fs from "node:fs";
import * as path from "node:path";

function findRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, "studio.config.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      console.error("Error: studio.config.json not found in any parent directory");
      process.exit(1);
    }
    dir = parent;
  }
}

const ROOT = findRoot();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface StudioConfig {
  screensDir: string;
  tokens: string;
  framework: string;
  [key: string]: unknown;
}

function loadConfig(): StudioConfig {
  const configPath = path.join(ROOT, "studio.config.json");
  return JSON.parse(fs.readFileSync(configPath, "utf-8")) as StudioConfig;
}

function resolveFromRoot(rel: string): string {
  return path.resolve(ROOT, rel);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function listScreens(): void {
  const config = loadConfig();
  const dir = resolveFromRoot(config.screensDir);
  if (!fs.existsSync(dir)) {
    console.error(`Screens directory not found: ${dir}`);
    process.exit(1);
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".screen.json")).sort();
  if (files.length === 0) {
    console.log("No screen specs found.");
    return;
  }
  console.log(`Found ${files.length} screen(s) in ${config.screensDir}/:\n`);
  for (const f of files) {
    const name = f.replace(".screen.json", "");
    const raw = fs.readFileSync(path.join(dir, f), "utf-8");
    try {
      const spec = JSON.parse(raw) as { route?: string };
      console.log(`  ${name}  →  ${spec.route ?? "(no route)"}`);
    } catch {
      console.log(`  ${name}  →  (invalid JSON)`);
    }
  }
}

function getScreen(name: string): void {
  const config = loadConfig();
  const dir = resolveFromRoot(config.screensDir);
  const fileName = name.endsWith(".screen.json") ? name : `${name}.screen.json`;
  const filePath = path.join(dir, fileName);
  if (!fs.existsSync(filePath)) {
    console.error(`Screen not found: ${filePath}`);
    // Suggest available screens
    if (fs.existsSync(dir)) {
      const available = fs.readdirSync(dir).filter((f) => f.endsWith(".screen.json")).map((f) => f.replace(".screen.json", ""));
      if (available.length > 0) {
        console.error(`Available screens: ${available.join(", ")}`);
      }
    }
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  console.log(raw);
}

function showTokens(): void {
  const config = loadConfig();
  const tokensPath = resolveFromRoot(config.tokens);
  if (!fs.existsSync(tokensPath)) {
    console.error(`Tokens file not found: ${tokensPath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(tokensPath, "utf-8");
  console.log(raw);
}

async function compileScreens(screenFilter?: string): Promise<void> {
  // Use the compiler's own functions
  const { discoverScreens } = await import("../compiler/discover");
  const { loadConfig: loadCompilerConfig } = await import("../compiler/config");
  const { compileFromMemory } = await import("../compiler/compile-memory");

  const allScreens = discoverScreens();
  const config = loadCompilerConfig();

  let screens = allScreens;
  if (screenFilter) {
    screens = allScreens.filter((s) => {
      const name = path.basename(s.filePath, ".screen.json");
      return name === screenFilter || s.spec.route === screenFilter;
    });
    if (screens.length === 0) {
      console.error(`No screen matching "${screenFilter}"`);
      process.exit(1);
    }
  }

  console.log(`Compiling ${screens.length} screen(s)...`);

  const result = compileFromMemory({
    specs: screens.map((s) => ({
      name: path.basename(s.filePath),
      spec: s.spec,
    })),
    config,
  });

  if (result.errors && result.errors.length > 0) {
    console.error("\nCompilation errors:");
    for (const err of result.errors) {
      console.error(`  ${err.filePath ?? "?"}: ${err.message}`);
    }
  }

  console.log(`\nResult: ${result.summary.succeeded} succeeded, ${result.summary.failed} failed, ${result.summary.skipped} skipped`);

  // Write output files
  let written = 0;
  for (const file of result.files) {
    const absPath = path.resolve(ROOT, file.path);
    const dir = path.dirname(absPath);
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(absPath) && fs.readFileSync(absPath, "utf-8") === file.contents) {
      continue;
    }
    fs.writeFileSync(absPath, file.contents);
    written++;
  }
  console.log(`${written} file(s) written, ${result.files.length - written} unchanged`);

  if (result.errors && result.errors.length > 0) {
    process.exit(1);
  }
}

async function lintScreens(screenFilter?: string): Promise<void> {
  const { lint } = await import("../compiler/lint");
  const issues = lint();

  let filtered = issues;
  if (screenFilter) {
    filtered = issues.filter((i) => {
      const name = path.basename(i.file, ".screen.json");
      return name === screenFilter || i.file.includes(screenFilter);
    });
  }

  if (filtered.length === 0) {
    console.log("No lint issues found.");
    return;
  }

  const errors = filtered.filter((i) => i.severity === "error");
  const warnings = filtered.filter((i) => i.severity === "warn");

  for (const issue of filtered) {
    const prefix = issue.severity === "error" ? "ERROR" : "WARN ";
    console.log(`  [${prefix}] ${issue.file} — ${issue.rule}: ${issue.message}`);
  }

  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
  if (errors.length > 0) process.exit(1);
}

function showHelp(): void {
  console.log(`
Studio CLI — design spec tools

Commands:
  compile [screen]     Compile all screens (or a single one) to code
  lint [screen]        Lint all screen specs (or a single one)
  list-screens         List all screen spec files with routes
  get-screen <name>    Print a screen spec as JSON
  tokens               Print the current design tokens
  help                 Show this help message

Examples:
  pnpm studio compile
  pnpm studio compile home
  pnpm studio lint dashboard
  pnpm studio list-screens
  pnpm studio get-screen landing-page
  pnpm studio tokens
`.trim());
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "compile":
      await compileScreens(args[0]);
      break;
    case "lint":
      await lintScreens(args[0]);
      break;
    case "list-screens":
      listScreens();
      break;
    case "get-screen":
      if (!args[0]) {
        console.error("Usage: studio get-screen <name>");
        process.exit(1);
      }
      getScreen(args[0]);
      break;
    case "tokens":
      showTokens();
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      showHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
