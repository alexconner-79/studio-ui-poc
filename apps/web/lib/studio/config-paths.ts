/**
 * Single source of truth for resolved absolute paths derived from studio.config.json.
 * All API routes should import paths from here instead of hardcoding them.
 *
 * Evaluated once at module load time (server-side only).
 */

import * as fs from "node:fs";
import * as path from "node:path";

interface StudioConfigPaths {
  screensDir: string;
  tokens?: string;
  generatedDir?: string;
  componentsDir?: string;
  appDir?: string;
}

export const ROOT_DIR = path.resolve(process.cwd(), "../..");

function loadConfig(): StudioConfigPaths {
  const configPath = path.join(ROOT_DIR, "studio.config.json");
  if (!fs.existsSync(configPath)) {
    return { screensDir: "spec/screens" };
  }
  const raw = fs.readFileSync(configPath, "utf8");
  return JSON.parse(raw) as StudioConfigPaths;
}

const config = loadConfig();

/** Absolute path to the screens spec directory */
export const SCREENS_DIR = path.resolve(ROOT_DIR, config.screensDir ?? "spec/screens");

/** Absolute path to the design tokens file */
export const TOKENS_PATH = path.resolve(ROOT_DIR, config.tokens ?? "tokens/design-tokens.json");

/** Absolute path to the custom components directory */
export const COMPONENTS_DIR = path.resolve(ROOT_DIR, "spec/components");
