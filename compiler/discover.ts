import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig, resolveFromRoot } from "./config";
import type { ScreenSpec } from "./types";

/**
 * Discover all *.screen.json files in the configured screens directory.
 * Returns parsed specs sorted by route for deterministic output.
 */
export function discoverScreens(): { filePath: string; spec: ScreenSpec }[] {
  const config = loadConfig();
  const screensDir = resolveFromRoot(config.screensDir);

  if (!fs.existsSync(screensDir)) {
    throw new Error(`Screens directory not found: ${screensDir}`);
  }

  const entries = fs.readdirSync(screensDir).filter((name) =>
    name.endsWith(".screen.json")
  );

  if (entries.length === 0) {
    throw new Error(
      `No *.screen.json files found in ${screensDir}. ` +
        "Create at least one screen spec."
    );
  }

  const screens = entries.map((entry) => {
    const filePath = path.join(screensDir, entry);
    const raw = fs.readFileSync(filePath, "utf8");

    let spec: ScreenSpec;
    try {
      spec = JSON.parse(raw) as ScreenSpec;
    } catch {
      throw new Error(`Invalid JSON in ${filePath}`);
    }

    return { filePath, spec };
  });

  // Sort by route for deterministic output order
  screens.sort((a, b) => a.spec.route.localeCompare(b.spec.route));

  return screens;
}
