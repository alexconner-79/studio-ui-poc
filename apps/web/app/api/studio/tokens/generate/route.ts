import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "../..");
const TOKENS_PATH = path.resolve(ROOT_DIR, "tokens/design-tokens.json");

// -------------------------------------------------------------------------
// Color palette generation (HSL math)
// -------------------------------------------------------------------------

function hexToHSL(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
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
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function generatePalette(hex: string): Record<string, string> {
  const [h, s] = hexToHSL(hex);
  const shades: Record<string, number> = {
    "50": 97, "100": 94, "200": 86, "300": 76, "400": 64,
    "500": 50, "600": 40, "700": 32, "800": 24, "900": 16, "950": 10,
  };
  const result: Record<string, string> = {};
  for (const [name, lightness] of Object.entries(shades)) {
    result[name] = hslToHex(h, s, lightness);
  }
  return result;
}

// -------------------------------------------------------------------------
// Type scales
// -------------------------------------------------------------------------

const TYPE_SCALES: Record<string, number> = {
  "minor-third": 1.2,
  "major-third": 1.25,
  "perfect-fourth": 1.333,
  "augmented-fourth": 1.414,
  "perfect-fifth": 1.5,
};

function generateTypeScale(base: number, ratio: number): Record<string, string> {
  return {
    xs: `${(base / ratio / ratio).toFixed(3)}rem`,
    sm: `${(base / ratio).toFixed(3)}rem`,
    base: `${base}rem`,
    lg: `${(base * ratio).toFixed(3)}rem`,
    xl: `${(base * ratio * ratio).toFixed(3)}rem`,
    "2xl": `${(base * ratio * ratio * ratio).toFixed(3)}rem`,
    "3xl": `${(base * ratio * ratio * ratio * ratio).toFixed(3)}rem`,
  };
}

// -------------------------------------------------------------------------
// Spacing scales
// -------------------------------------------------------------------------

function generateSpacingScale(baseUnit: number): Record<string, string> {
  return {
    xs: `${baseUnit * 0.25}px`,
    sm: `${baseUnit * 0.5}px`,
    md: `${baseUnit}px`,
    lg: `${baseUnit * 1.5}px`,
    xl: `${baseUnit * 2}px`,
    "2xl": `${baseUnit * 3}px`,
    "3xl": `${baseUnit * 4}px`,
  };
}

// -------------------------------------------------------------------------
// Main handler
// -------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      primaryColor = "#3b82f6",
      secondaryColor = "#6b7280",
      accentColor,
      headingFont = "Geist, system-ui, sans-serif",
      bodyFont = "Geist, system-ui, sans-serif",
      typeScale = "major-third",
      baseUnit = 8,
    } = body;

    const ratio = TYPE_SCALES[typeScale] ?? 1.25;

    // Generate color tokens
    const primaryPalette = generatePalette(primaryColor);
    const secondaryPalette = generatePalette(secondaryColor);
    const colorTokens: Record<string, { value: string; type: string }> = {
      primary: { value: primaryColor, type: "color" },
      secondary: { value: secondaryColor, type: "color" },
      background: { value: "#ffffff", type: "color" },
      foreground: { value: "#111827", type: "color" },
      muted: { value: secondaryPalette["300"], type: "color" },
      border: { value: secondaryPalette["200"], type: "color" },
      destructive: { value: "#ef4444", type: "color" },
    };
    if (accentColor) {
      colorTokens.accent = { value: accentColor, type: "color" };
    }
    // Add palette shades
    for (const [shade, hex] of Object.entries(primaryPalette)) {
      colorTokens[`primary-${shade}`] = { value: hex, type: "color" };
    }
    for (const [shade, hex] of Object.entries(secondaryPalette)) {
      colorTokens[`secondary-${shade}`] = { value: hex, type: "color" };
    }

    // Generate typography tokens
    const fontSizes = generateTypeScale(1, ratio);
    const typographyTokens: Record<string, Record<string, { value: string; type: string }>> = {
      fontFamily: {
        heading: { value: headingFont, type: "fontFamily" },
        body: { value: bodyFont, type: "fontFamily" },
      },
      fontSize: {},
    };
    for (const [name, val] of Object.entries(fontSizes)) {
      typographyTokens.fontSize[name] = { value: val, type: "fontSize" };
    }

    // Generate spacing tokens
    const spacingValues = generateSpacingScale(baseUnit);
    const spacingTokens: Record<string, { value: string; type: string }> = {};
    for (const [name, val] of Object.entries(spacingValues)) {
      spacingTokens[name] = { value: val, type: "spacing" };
    }

    const tokens = {
      color: colorTokens,
      typography: typographyTokens,
      spacing: spacingTokens,
      borderRadius: {
        sm: { value: "0.25rem", type: "borderRadius" },
        md: { value: "0.375rem", type: "borderRadius" },
        lg: { value: "0.5rem", type: "borderRadius" },
        full: { value: "9999px", type: "borderRadius" },
      },
    };

    // Preview mode
    const preview = new URL(request.url).searchParams.get("preview") === "true";
    if (preview) {
      return NextResponse.json({ tokens });
    }

    // Write tokens file
    const dir = path.dirname(TOKENS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));

    return NextResponse.json({ tokens, success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
