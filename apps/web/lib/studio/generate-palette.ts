/**
 * Generates a 50–900 colour scale from a base hex colour using HSL manipulation.
 * The base hex maps to ~500 weight; shades spread across lightness levels.
 */

type TokenEntry = { value: string; description?: string };

// ─────────────────────────────────────────────────────────────
// Hex ↔ HSL utilities
// ─────────────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const sl = s / 100;
  const ll = l / 100;
  const a = sl * Math.min(ll, 1 - ll);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// ─────────────────────────────────────────────────────────────
// Shade lightness map (Tailwind-inspired)
// ─────────────────────────────────────────────────────────────

const SHADE_LIGHTNESS: Record<string, number> = {
  "50":  97,
  "100": 93,
  "200": 86,
  "300": 75,
  "400": 62,
  "500": 50,  // ~base
  "600": 41,
  "700": 33,
  "800": 25,
  "900": 17,
};

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Returns a token group (e.g. `color.primary`) with 50–900 shades
 * derived from the given hex colour.
 */
export function hexToHuePalette(hex: string): Record<string, TokenEntry> {
  const hsl = hexToHsl(hex);
  if (!hsl) return {};
  const [h, s] = hsl;
  const result: Record<string, TokenEntry> = {};
  for (const [shade, lightness] of Object.entries(SHADE_LIGHTNESS)) {
    // Saturate mid-tones slightly, desaturate extremes for natural look
    const sat = lightness < 20 || lightness > 90
      ? Math.max(s - 10, 5)
      : Math.min(s + 5, 100);
    result[shade] = { value: hslToHex(h, sat, lightness) };
  }
  return result;
}

/**
 * Derives the interaction state colours from a primary hex:
 * hover (slightly darker), active (noticeably darker), focus-ring (slightly lighter/offset),
 * and disabled (desaturated grey).
 */
export function deriveInteractionTokens(primaryHex: string): Record<string, TokenEntry> {
  const hsl = hexToHsl(primaryHex);
  if (!hsl) return {};
  const [h, s, l] = hsl;

  return {
    hover:       { value: hslToHex(h, Math.min(s + 5, 100), Math.max(l - 8, 10)),  description: "Hover state — slightly darker than primary" },
    active:      { value: hslToHex(h, Math.min(s + 8, 100), Math.max(l - 16, 5)),  description: "Active / pressed state" },
    "focus-ring":{ value: hslToHex(h, Math.max(s - 10, 20), Math.min(l + 15, 90)), description: "Focus ring — lighter variant for keyboard navigation" },
    disabled:    { value: hslToHex(0, 0, 75),                                       description: "Disabled state — neutral grey" },
  };
}
