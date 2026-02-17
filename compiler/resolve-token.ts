/**
 * Token resolver utility for the compiler.
 * Resolves "$color.primary" style references to actual CSS values from design tokens.
 */

import type { StyleValue, NodeStyle } from "./types";
import type { DesignTokens } from "./tokens";

/**
 * Resolve a single StyleValue that may be a token reference.
 */
export function resolveStyleValue(
  value: StyleValue | undefined,
  tokens: DesignTokens | null
): string | number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.startsWith("$")) {
    return lookupToken(value.slice(1), tokens) ?? value;
  }
  return value;
}

function lookupToken(path: string, tokens: DesignTokens | null): string | undefined {
  if (!tokens) return undefined;
  const segments = path.split(".");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = tokens;
  for (let i = 0; i < segments.length; i++) {
    if (current === undefined || current === null) return undefined;
    current = current[segments[i]];
  }

  if (current && typeof current === "object" && typeof current.value === "string") {
    return current.value;
  }
  if (typeof current === "string") return current;

  return undefined;
}

/**
 * Resolve a full NodeStyle to a plain object with all tokens resolved.
 */
export function resolveNodeStyle(
  style: NodeStyle | undefined,
  tokens: DesignTokens | null
): Record<string, string | number> {
  if (!style) return {};

  const resolved: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(style)) {
    if (value === undefined || value === null) continue;
    const resolved_val = resolveStyleValue(value as StyleValue, tokens);
    if (resolved_val !== undefined) {
      resolved[key] = resolved_val;
    }
  }
  return resolved;
}
