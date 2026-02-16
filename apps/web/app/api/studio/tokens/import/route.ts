import { NextResponse } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";

const ROOT_DIR = path.resolve(process.cwd(), "../..");
const TOKENS_PATH = path.resolve(ROOT_DIR, "tokens/design-tokens.json");

type StudioTokens = Record<string, Record<string, { value: string; type: string }>>;

function readExistingTokens(): StudioTokens {
  if (!fs.existsSync(TOKENS_PATH)) return {};
  return JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
}

function writeTokens(tokens: StudioTokens): void {
  const dir = path.dirname(TOKENS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

// -------------------------------------------------------------------------
// W3C Design Tokens Community Group format parser
// -------------------------------------------------------------------------

function parseW3C(data: Record<string, unknown>): StudioTokens {
  const result: StudioTokens = {};

  function walk(obj: Record<string, unknown>, group: string) {
    for (const [key, val] of Object.entries(obj)) {
      if (val && typeof val === "object" && "$value" in (val as Record<string, unknown>)) {
        const token = val as Record<string, unknown>;
        const type = (token.$type as string) || group;
        const value = String(token.$value);
        const category = mapW3CType(type);
        if (!result[category]) result[category] = {};
        result[category][key] = { value, type: category };
      } else if (val && typeof val === "object" && !("$value" in (val as Record<string, unknown>))) {
        walk(val as Record<string, unknown>, key);
      }
    }
  }

  walk(data, "");
  return result;
}

function mapW3CType(type: string): string {
  const map: Record<string, string> = {
    color: "color",
    dimension: "spacing",
    spacing: "spacing",
    sizing: "size",
    fontFamily: "typography",
    fontSize: "typography",
    borderRadius: "borderRadius",
    fontWeight: "typography",
    lineHeight: "typography",
  };
  return map[type] || "spacing";
}

// -------------------------------------------------------------------------
// Tailwind config parser (extracts theme values from string)
// -------------------------------------------------------------------------

function parseTailwind(data: string): StudioTokens {
  const result: StudioTokens = {};

  // Extract colors
  const colorMatch = data.match(/colors\s*:\s*\{([^}]+)\}/);
  if (colorMatch) {
    result.color = {};
    const pairs = colorMatch[1].matchAll(/['"]?(\w+)['"]?\s*:\s*['"]([^'"]+)['"]/g);
    for (const m of pairs) {
      result.color[m[1]] = { value: m[2], type: "color" };
    }
  }

  // Extract spacing
  const spacingMatch = data.match(/spacing\s*:\s*\{([^}]+)\}/);
  if (spacingMatch) {
    result.spacing = {};
    const pairs = spacingMatch[1].matchAll(/['"]?(\w+)['"]?\s*:\s*['"]([^'"]+)['"]/g);
    for (const m of pairs) {
      result.spacing[m[1]] = { value: m[2], type: "spacing" };
    }
  }

  // Extract fontSize
  const fsMatch = data.match(/fontSize\s*:\s*\{([^}]+)\}/);
  if (fsMatch) {
    if (!result.typography) result.typography = {};
    const pairs = fsMatch[1].matchAll(/['"]?(\w+)['"]?\s*:\s*['"]([^'"]+)['"]/g);
    for (const m of pairs) {
      result.typography[`fontSize-${m[1]}`] = { value: m[2], type: "fontSize" };
    }
  }

  // Extract borderRadius
  const brMatch = data.match(/borderRadius\s*:\s*\{([^}]+)\}/);
  if (brMatch) {
    result.borderRadius = {};
    const pairs = brMatch[1].matchAll(/['"]?(\w+)['"]?\s*:\s*['"]([^'"]+)['"]/g);
    for (const m of pairs) {
      result.borderRadius[m[1]] = { value: m[2], type: "borderRadius" };
    }
  }

  return result;
}

// -------------------------------------------------------------------------
// shadcn CSS variables parser
// -------------------------------------------------------------------------

function parseShadcn(data: string): StudioTokens {
  const result: StudioTokens = { color: {} };

  // Match CSS custom properties like --background: 0 0% 100%;
  const matches = data.matchAll(/--([a-z-]+)\s*:\s*([^;]+)/gi);
  for (const m of matches) {
    const name = m[1].replace(/-/g, "_");
    const raw = m[2].trim();

    // Try to parse as HSL
    const hslParts = raw.match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
    if (hslParts) {
      const hex = hslToHex(
        parseFloat(hslParts[1]),
        parseFloat(hslParts[2]),
        parseFloat(hslParts[3])
      );
      result.color![name] = { value: hex, type: "color" };
    } else if (raw.startsWith("#") || raw.startsWith("rgb")) {
      result.color![name] = { value: raw, type: "color" };
    }
    // Skip non-color values (like radius)
  }

  return result;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// -------------------------------------------------------------------------
// Main handler
// -------------------------------------------------------------------------

function deepMerge(target: StudioTokens, source: StudioTokens): StudioTokens {
  const result = { ...target };
  for (const [category, tokens] of Object.entries(source)) {
    result[category] = { ...(result[category] || {}), ...tokens };
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const { format, data } = await request.json();

    if (!format || !data) {
      return NextResponse.json({ error: "format and data are required" }, { status: 400 });
    }

    let parsed: StudioTokens;

    switch (format) {
      case "w3c":
        parsed = parseW3C(data as Record<string, unknown>);
        break;
      case "tailwind":
        parsed = parseTailwind(data as string);
        break;
      case "shadcn":
        parsed = parseShadcn(data as string);
        break;
      default:
        return NextResponse.json({ error: `Unknown format: ${format}` }, { status: 400 });
    }

    // Preview mode: return parsed tokens without writing
    const preview = new URL(request.url).searchParams.get("preview") === "true";
    if (preview) {
      return NextResponse.json({ tokens: parsed });
    }

    // Merge with existing tokens and write
    const existing = readExistingTokens();
    const merged = deepMerge(existing, parsed);
    writeTokens(merged);

    return NextResponse.json({ tokens: merged });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
