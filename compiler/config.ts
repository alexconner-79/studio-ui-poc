import * as fs from "node:fs";
import * as path from "node:path";

export type FontEntry = {
  family: string;
  source: "google" | "local";
  weights?: string[];
  files?: string[];
};

export type StudioConfig = {
  framework: string;
  appDir: string;
  componentsDir: string;
  generatedDir: string;
  screensDir: string;
  schemaPath: string;
  importAlias: string;
  componentLibrary?: string;
  plugins?: string[];
  tokens?: string;
  fonts?: FontEntry[];
};

const CONFIG_FILE = "studio.config.json";

let cachedConfig: StudioConfig | undefined;

export function loadConfig(rootDir?: string): StudioConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const root = rootDir ?? process.cwd();
  const configPath = path.resolve(root, CONFIG_FILE);

  let raw: string;
  try {
    raw = fs.readFileSync(configPath, "utf8");
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new Error(
        `Config file not found at ${configPath}. ` +
          `Create a ${CONFIG_FILE} in the project root.`
      );
    }
    throw new Error(`Failed to read config file: ${configPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${configPath}`);
  }

  const config = parsed as Record<string, unknown>;

  // Validate required fields
  const requiredStrings: (keyof StudioConfig)[] = [
    "framework",
    "appDir",
    "componentsDir",
    "generatedDir",
    "screensDir",
    "schemaPath",
    "importAlias",
  ];

  for (const key of requiredStrings) {
    if (typeof config[key] !== "string" || (config[key] as string).length === 0) {
      throw new Error(`${CONFIG_FILE}: "${key}" must be a non-empty string`);
    }
  }

  const supportedFrameworks = ["nextjs", "vue", "svelte", "html", "expo"];
  if (!supportedFrameworks.includes(config.framework as string)) {
    throw new Error(
      `${CONFIG_FILE}: "framework" must be one of: ${supportedFrameworks.join(", ")}`
    );
  }

  cachedConfig = config as unknown as StudioConfig;
  return cachedConfig;
}

/** Resolve a config-relative path to an absolute path from project root. */
export function resolveFromRoot(relativePath: string, rootDir?: string): string {
  const root = rootDir ?? process.cwd();
  return path.resolve(root, relativePath);
}

/** Clear the cached config (useful for tests). */
export function clearConfigCache(): void {
  cachedConfig = undefined;
}
