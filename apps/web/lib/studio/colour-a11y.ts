/**
 * WCAG 2.1 colour contrast utilities.
 * All calculations are purely client-side — no API needed.
 *
 * References:
 *   https://www.w3.org/TR/WCAG21/#contrast-minimum
 *   https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */

// ─────────────────────────────────────────────────────────────
// Core maths
// ─────────────────────────────────────────────────────────────

function channelLinear(c8bit: number): number {
  const c = c8bit / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 0;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channelLinear(r) + 0.7152 * channelLinear(g) + 0.0722 * channelLinear(b);
}

/** WCAG contrast ratio (1:1 = no contrast, 21:1 = max). */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG pass/fail for normal text (AA=4.5), large text (AA=3), AAA (7). */
export function wcagRating(ratio: number): {
  aa: boolean;
  aaa: boolean;
  aaLarge: boolean;
} {
  return {
    aa:      ratio >= 4.5,
    aaa:     ratio >= 7,
    aaLarge: ratio >= 3,
  };
}

// ─────────────────────────────────────────────────────────────
// Higher-level helpers
// ─────────────────────────────────────────────────────────────

export type A11yCheck = {
  id: string;
  label: string;
  fg: string;
  bg: string;
  ratio: number;
  rating: { aa: boolean; aaa: boolean; aaLarge: boolean };
  note: string;
};

function note(ratio: number): string {
  if (ratio >= 7)   return "Excellent — passes AAA for all text";
  if (ratio >= 4.5) return "Passes AA — good for body text";
  if (ratio >= 3)   return "Large text only — minimum AA for headings";
  return "Fails WCAG — consider adjusting the colours";
}

/**
 * Run the standard set of brand colour checks used in the wizard panel.
 */
export function runBrandChecks(primary: string, secondary: string, focusRing: string): A11yCheck[] {
  const WHITE = "#ffffff";
  const BLACK = "#111111";

  const checks: Array<{ id: string; label: string; fg: string; bg: string }> = [
    { id: "primary-on-white",    label: "Primary text on white",       fg: primary,   bg: WHITE },
    { id: "white-on-primary",    label: "White text on primary",       fg: WHITE,     bg: primary },
    { id: "primary-on-secondary",label: "Primary text on secondary",   fg: primary,   bg: secondary },
    { id: "black-on-secondary",  label: "Dark text on secondary",      fg: BLACK,     bg: secondary },
    { id: "focus-on-white",      label: "Focus ring on white bg",      fg: focusRing, bg: WHITE },
  ];

  return checks.map(({ id, label, fg, bg }) => {
    const ratio = contrastRatio(fg, bg);
    return { id, label, fg, bg, ratio, rating: wcagRating(ratio), note: note(ratio) };
  });
}

/**
 * Run a comprehensive audit of all hex-like colour tokens in a token store.
 * Returns pairs between each colour token and white/black backgrounds.
 */
export function auditTokenColours(
  tokens: Record<string, Record<string, { value: unknown }>>
): A11yCheck[] {
  const WHITE = "#ffffff";
  const BLACK = "#111111";
  const results: A11yCheck[] = [];

  const colourTokens: Array<{ path: string; hex: string }> = [];

  for (const [group, entries] of Object.entries(tokens)) {
    for (const [key, entry] of Object.entries(entries)) {
      const val = typeof entry.value === "string" ? entry.value : null;
      if (!val) continue;
      const hex = val.startsWith("#") && val.length === 7 ? val : null;
      if (!hex) continue;
      colourTokens.push({ path: `${group}.${key}`, hex });
    }
  }

  for (const { path, hex } of colourTokens) {
    const onWhite = contrastRatio(hex, WHITE);
    const onBlack = contrastRatio(hex, BLACK);

    results.push({
      id:     `${path}-on-white`,
      label:  `${path} on white`,
      fg:     hex,
      bg:     WHITE,
      ratio:  onWhite,
      rating: wcagRating(onWhite),
      note:   note(onWhite),
    });

    results.push({
      id:     `${path}-on-black`,
      label:  `${path} on dark`,
      fg:     hex,
      bg:     BLACK,
      ratio:  onBlack,
      rating: wcagRating(onBlack),
      note:   note(onBlack),
    });
  }

  return results;
}
