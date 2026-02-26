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

function lookupToken(
  path: string,
  tokens: DesignTokens | null,
  depth = 0
): string | undefined {
  if (!tokens || depth > 8) return undefined;
  const segments = path.split(".");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = tokens;
  for (let i = 0; i < segments.length; i++) {
    if (current === undefined || current === null) return undefined;
    current = current[segments[i]];
  }

  // Dual-value token: pick web side for compiler output
  if (current && typeof current === "object" && typeof current.value === "object") {
    const dual = current.value as { web?: string };
    if (dual.web) return dual.web;
  }

  if (current && typeof current === "object" && typeof current.value === "string") {
    // Follow alias chains: if the resolved value is itself a "$" reference, recurse
    const val: string = current.value;
    if (val.startsWith("$")) {
      return lookupToken(val.slice(1), tokens, depth + 1);
    }
    return val;
  }
  if (typeof current === "string") {
    if (current.startsWith("$")) {
      return lookupToken(current.slice(1), tokens, depth + 1);
    }
    return current;
  }

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
