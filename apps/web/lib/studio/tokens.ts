/**
 * Token utilities for the runtime renderer.
 * These resolve semantic token names using the design-tokens loaded into the store.
 * Falls back to hardcoded Tailwind class values when no tokens are loaded.
 */

import type { DesignTokens } from "./types";

// ---------------------------------------------------------------------------
// Hardcoded fallback maps (used when tokens are not loaded)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Resolvers that accept optional tokens from the store
// ---------------------------------------------------------------------------

export const resolveGap = (gap?: unknown, tokens?: DesignTokens | null): string => {
  if (typeof gap !== "string") return DEFAULT_GAP.md;
  if (tokens?.spacing?.[gap]) {
    return cssToTailwindSpacing(tokens.spacing[gap].value) ?? DEFAULT_GAP[gap] ?? DEFAULT_GAP.md;
  }
  return DEFAULT_GAP[gap] ?? DEFAULT_GAP.md;
};

export const resolveSize = (size?: unknown, tokens?: DesignTokens | null): string => {
  if (typeof size !== "string") return DEFAULT_SIZE.md;
  if (tokens?.size?.[size]) {
    return cssToTailwindSpacing(tokens.size[size].value) ?? DEFAULT_SIZE[size] ?? DEFAULT_SIZE.md;
  }
  return DEFAULT_SIZE[size] ?? DEFAULT_SIZE.md;
};

/**
 * Convert a CSS rem/px value to a Tailwind spacing scale value.
 * e.g. "0.25rem" -> "1", "0.5rem" -> "2", "1rem" -> "4"
 */
function cssToTailwindSpacing(css: string): string | undefined {
  const remMatch = css.match(/^([\d.]+)rem$/);
  if (remMatch) {
    const rem = parseFloat(remMatch[1]);
    const tw = rem * 4;
    return String(tw);
  }
  const pxMatch = css.match(/^([\d.]+)px$/);
  if (pxMatch) {
    const px = parseFloat(pxMatch[1]);
    const tw = px / 4;
    return String(tw);
  }
  return undefined;
}

// Re-export for backward compat
export const GAP_MAP = DEFAULT_GAP;
export const SIZE_MAP = DEFAULT_SIZE;
