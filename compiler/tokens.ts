/**
 * Design token pipeline.
 *
 * Reads tokens from a Style Dictionary-compatible JSON file and makes them
 * available to the compiler and editor. Tokens override the default hardcoded
 * maps when a tokens file is configured.
 */

import * as fs from "node:fs";
import * as path from "node:path";

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export type TokenValue = {
  value: string;
  type?: string;
};

export type TokenGroup = Record<string, TokenValue>;

export type DesignTokens = {
  spacing?: TokenGroup;
  size?: TokenGroup;
  color?: TokenGroup;
  typography?: {
    fontFamily?: TokenGroup;
    fontSize?: TokenGroup;
    fontWeight?: TokenGroup;
    lineHeight?: TokenGroup;
    letterSpacing?: TokenGroup;
  };
  borderRadius?: TokenGroup;
  shadow?: TokenGroup;
  /** Raw parsed data for extension. */
  raw: Record<string, unknown>;
};

export type ResolvedTokenMaps = {
  gap: Record<string, string>;
  size: Record<string, string>;
  colors: Record<string, string>;
  fontSizes: Record<string, string>;
  fontWeights: Record<string, string>;
  lineHeights: Record<string, string>;
  letterSpacings: Record<string, string>;
  radii: Record<string, string>;
  shadows: Record<string, string>;
};

// -------------------------------------------------------------------------
// Default maps (used when no tokens file is configured)
// -------------------------------------------------------------------------

const DEFAULT_GAP: Record<string, string> = {
  xs: "1",
  sm: "2",
  md: "4",
  lg: "6",
  xl: "8",
};

const DEFAULT_SIZE: Record<string, string> = {
  xs: "2",
  sm: "4",
  md: "6",
  lg: "8",
  xl: "12",
};

// -------------------------------------------------------------------------
// Loader
// -------------------------------------------------------------------------

/**
 * Load and parse a Style Dictionary-compatible JSON token file.
 */
export function loadTokens(tokensPath: string, rootDir?: string): DesignTokens {
  const root = rootDir ?? process.cwd();
  const absPath = path.resolve(root, tokensPath);

  let raw: string;
  try {
    raw = fs.readFileSync(absPath, "utf8");
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      throw new Error(`Tokens file not found: ${absPath}`);
    }
    throw new Error(`Failed to read tokens file: ${absPath}`);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in tokens file: ${absPath}`);
  }

  const typo = parsed.typography as Record<string, unknown> | undefined;
  return {
    spacing: extractGroup(parsed.spacing),
    size: extractGroup(parsed.size),
    color: extractGroup(parsed.color),
    typography: typo
      ? {
          fontFamily: extractGroup(typo.fontFamily),
          fontSize: extractGroup(typo.fontSize),
          fontWeight: extractGroup(typo.fontWeight),
          lineHeight: extractGroup(typo.lineHeight),
          letterSpacing: extractGroup(typo.letterSpacing),
        }
      : undefined,
    borderRadius: extractGroup(parsed.borderRadius),
    shadow: extractGroup(parsed.shadow),
    raw: parsed,
  };
}

function extractGroup(value: unknown): TokenGroup | undefined {
  if (!value || typeof value !== "object") return undefined;
  const group: TokenGroup = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (isTokenValue(entry)) {
      group[key] = entry;
    }
  }
  return Object.keys(group).length > 0 ? group : undefined;
}

function isTokenValue(value: unknown): value is TokenValue {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).value === "string"
  );
}

// -------------------------------------------------------------------------
// Resolver
// -------------------------------------------------------------------------

/**
 * Resolve design tokens into the maps used by the compiler.
 * If a tokens file is provided, spacing/size tokens are used.
 * Otherwise falls back to the hardcoded Tailwind class maps.
 */
function groupToMap(group?: TokenGroup): Record<string, string> {
  const map: Record<string, string> = {};
  if (group) {
    for (const [key, token] of Object.entries(group)) {
      map[key] = token.value;
    }
  }
  return map;
}

export function resolveTokenMaps(
  tokens?: DesignTokens
): ResolvedTokenMaps {
  const gap = { ...DEFAULT_GAP };
  const size = { ...DEFAULT_SIZE };

  if (tokens?.spacing) {
    for (const [key, token] of Object.entries(tokens.spacing)) {
      gap[key] = token.value;
    }
  }
  if (tokens?.size) {
    for (const [key, token] of Object.entries(tokens.size)) {
      size[key] = token.value;
    }
  }

  return {
    gap,
    size,
    colors: groupToMap(tokens?.color),
    fontSizes: groupToMap(tokens?.typography?.fontSize),
    fontWeights: groupToMap(tokens?.typography?.fontWeight),
    lineHeights: groupToMap(tokens?.typography?.lineHeight),
    letterSpacings: groupToMap(tokens?.typography?.letterSpacing),
    radii: groupToMap(tokens?.borderRadius),
    shadows: groupToMap(tokens?.shadow),
  };
}

/**
 * List all token names for a given category.
 * Used by the editor property panel to show available tokens.
 */
export function listTokenNames(
  tokens: DesignTokens | undefined,
  category: "spacing" | "size" | "color"
): string[] {
  if (!tokens) {
    // Return default token names
    if (category === "spacing" || category === "size") {
      return ["xs", "sm", "md", "lg", "xl"];
    }
    return [];
  }

  const group =
    category === "spacing"
      ? tokens.spacing
      : category === "size"
        ? tokens.size
        : tokens.color;

  if (!group) return [];
  return Object.keys(group);
}
