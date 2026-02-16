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
  };
  borderRadius?: TokenGroup;
  /** Raw parsed data for extension. */
  raw: Record<string, unknown>;
};

export type ResolvedTokenMaps = {
  gap: Record<string, string>;
  size: Record<string, string>;
  colors: Record<string, string>;
  fontSizes: Record<string, string>;
  radii: Record<string, string>;
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

  return {
    spacing: extractGroup(parsed.spacing),
    size: extractGroup(parsed.size),
    color: extractGroup(parsed.color),
    typography: parsed.typography
      ? {
          fontFamily: extractGroup(
            (parsed.typography as Record<string, unknown>).fontFamily
          ),
          fontSize: extractGroup(
            (parsed.typography as Record<string, unknown>).fontSize
          ),
        }
      : undefined,
    borderRadius: extractGroup(parsed.borderRadius),
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
export function resolveTokenMaps(
  tokens?: DesignTokens
): ResolvedTokenMaps {
  const gap = { ...DEFAULT_GAP };
  const size = { ...DEFAULT_SIZE };
  const colors: Record<string, string> = {};
  const fontSizes: Record<string, string> = {};
  const radii: Record<string, string> = {};

  if (tokens) {
    // Override gap map from spacing tokens
    if (tokens.spacing) {
      for (const [key, token] of Object.entries(tokens.spacing)) {
        gap[key] = token.value;
      }
    }

    // Override size map
    if (tokens.size) {
      for (const [key, token] of Object.entries(tokens.size)) {
        size[key] = token.value;
      }
    }

    // Colors
    if (tokens.color) {
      for (const [key, token] of Object.entries(tokens.color)) {
        colors[key] = token.value;
      }
    }

    // Font sizes
    if (tokens.typography?.fontSize) {
      for (const [key, token] of Object.entries(tokens.typography.fontSize)) {
        fontSizes[key] = token.value;
      }
    }

    // Border radii
    if (tokens.borderRadius) {
      for (const [key, token] of Object.entries(tokens.borderRadius)) {
        radii[key] = token.value;
      }
    }
  }

  return { gap, size, colors, fontSizes, radii };
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
