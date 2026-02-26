/**
 * Token resolver utility for the editor runtime.
 * Resolves "$color.primary" style references to actual CSS values from design tokens.
 */

import type { StyleValue, NodeStyle, DesignTokens, TokenGroup, TextStyleDef } from "./types";

/**
 * Resolve a single StyleValue that may be a token reference.
 * Token references start with "$" and use dot-path notation:
 *   "$color.primary"        -> tokens.color.primary.value
 *   "$typography.fontSize.lg" -> tokens.typography.fontSize.lg.value
 *   "$spacing.md"           -> tokens.spacing.md.value
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

/**
 * Normalise a raw token value that may be a plain string, a number, or a
 * dual-platform object `{ web: string|number, native: string|number }`.
 * Always returns a string (or undefined if unresolvable).
 */
function normaliseTokenValue(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw;
  if (typeof raw === "number") return String(raw);
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    // Dual-value platform token — prefer web for the editor (web-first)
    const platformVal = obj.web ?? obj.native;
    if (typeof platformVal === "string") return platformVal;
    if (typeof platformVal === "number") return String(platformVal);
    // Nested { value: ... } token wrapper
    if (obj.value !== undefined) return normaliseTokenValue(obj.value);
  }
  return undefined;
}

function lookupToken(path: string, tokens: DesignTokens | null): string | undefined {
  if (!tokens) return undefined;
  const segments = path.split(".");

  // Navigate into the tokens object by dot path
  let current: unknown = tokens;
  for (let i = 0; i < segments.length; i++) {
    if (current === undefined || current === null) return undefined;
    current = (current as Record<string, unknown>)[segments[i]];
  }

  // If we ended up at a TokenValue object, extract its .value (may itself be dual-value)
  if (current !== null && typeof current === "object") {
    const obj = current as Record<string, unknown>;
    if (obj.value !== undefined) return normaliseTokenValue(obj.value);
  }
  // If it's already a raw primitive, normalise it
  return normaliseTokenValue(current);
}

/**
 * Resolve a full NodeStyle to React.CSSProperties by resolving all token references.
 */
export function resolvedStyleToCSS(
  style: NodeStyle | undefined,
  tokens: DesignTokens | null
): React.CSSProperties {
  if (!style) return {};

  const css: React.CSSProperties = {};
  const r = (v: StyleValue | undefined) => resolveStyleValue(v, tokens);

  // Typography
  if (style.fontSize !== undefined) css.fontSize = r(style.fontSize);
  if (style.fontWeight !== undefined) css.fontWeight = r(style.fontWeight) as React.CSSProperties["fontWeight"];
  if (style.fontStyle !== undefined) css.fontStyle = style.fontStyle;
  if (style.lineHeight !== undefined) css.lineHeight = r(style.lineHeight);
  if (style.letterSpacing !== undefined) css.letterSpacing = r(style.letterSpacing);
  if (style.wordSpacing !== undefined) css.wordSpacing = r(style.wordSpacing);
  if (style.textAlign !== undefined) css.textAlign = style.textAlign;
  if (style.textDecoration !== undefined) css.textDecoration = style.textDecoration;
  if (style.textTransform !== undefined) css.textTransform = style.textTransform;
  if (style.color !== undefined) css.color = String(r(style.color) ?? "");

  // Sizing (mode takes priority over raw value)
  if (style.widthMode === "fill") {
    css.width = "100%";
  } else if (style.widthMode === "hug") {
    css.width = "fit-content";
  } else if (style.width !== undefined) {
    css.width = r(style.width);
  }
  if (style.heightMode === "fill") {
    css.height = "100%";
  } else if (style.heightMode === "hug") {
    css.height = "fit-content";
  } else if (style.height !== undefined) {
    css.height = r(style.height);
  }
  if (style.minWidth !== undefined) css.minWidth = r(style.minWidth);
  if (style.maxWidth !== undefined) css.maxWidth = r(style.maxWidth);
  if (style.minHeight !== undefined) css.minHeight = r(style.minHeight);
  if (style.maxHeight !== undefined) css.maxHeight = r(style.maxHeight);

  // Spacing
  if (style.paddingTop !== undefined) css.paddingTop = r(style.paddingTop);
  if (style.paddingRight !== undefined) css.paddingRight = r(style.paddingRight);
  if (style.paddingBottom !== undefined) css.paddingBottom = r(style.paddingBottom);
  if (style.paddingLeft !== undefined) css.paddingLeft = r(style.paddingLeft);
  if (style.marginTop !== undefined) css.marginTop = r(style.marginTop);
  if (style.marginRight !== undefined) css.marginRight = r(style.marginRight);
  if (style.marginBottom !== undefined) css.marginBottom = r(style.marginBottom);
  if (style.marginLeft !== undefined) css.marginLeft = r(style.marginLeft);

  // Background
  if (style.backgroundColor !== undefined) css.backgroundColor = String(r(style.backgroundColor) ?? "");
  if (style.backgroundImage !== undefined) css.backgroundImage = style.backgroundImage;

  // Border
  if (style.borderWidth !== undefined) css.borderWidth = r(style.borderWidth);
  if (style.borderColor !== undefined) css.borderColor = String(r(style.borderColor) ?? "");
  if (style.borderStyle !== undefined) css.borderStyle = style.borderStyle;
  if (style.borderRadius !== undefined) css.borderRadius = r(style.borderRadius);
  if (style.borderTopLeftRadius !== undefined) css.borderTopLeftRadius = r(style.borderTopLeftRadius);
  if (style.borderTopRightRadius !== undefined) css.borderTopRightRadius = r(style.borderTopRightRadius);
  if (style.borderBottomLeftRadius !== undefined) css.borderBottomLeftRadius = r(style.borderBottomLeftRadius);
  if (style.borderBottomRightRadius !== undefined) css.borderBottomRightRadius = r(style.borderBottomRightRadius);

  // Effects
  if (style.opacity !== undefined) css.opacity = style.opacity;
  if (style.boxShadow !== undefined) css.boxShadow = String(r(style.boxShadow) ?? "");

  // Layout
  if (style.flexDirection !== undefined) css.flexDirection = style.flexDirection;
  if (style.overflow !== undefined) css.overflow = style.overflow;
  if (style.justifyContent !== undefined) css.justifyContent = style.justifyContent;
  if (style.alignItems !== undefined) css.alignItems = style.alignItems;
  if (style.flexWrap !== undefined) css.flexWrap = style.flexWrap;
  if (style.gap !== undefined) css.gap = r(style.gap);
  if (style.flexGrow !== undefined) css.flexGrow = style.flexGrow;
  if (style.flexShrink !== undefined) css.flexShrink = style.flexShrink;
  if (style.alignSelf !== undefined) css.alignSelf = style.alignSelf;

  // Constraints (position overrides for absolute-positioned nodes)
  if (style.constraints) {
    const hc = style.constraints.horizontal;
    const vc = style.constraints.vertical;
    if (hc === "right") { css.right = css.right ?? 0; css.left = "auto"; }
    else if (hc === "left-right") { /* keep existing left/right */ }
    else if (hc === "center") { css.left = "50%"; css.transform = "translateX(-50%)"; }
    if (vc === "bottom") { css.bottom = css.bottom ?? 0; css.top = "auto"; }
    else if (vc === "top-bottom") { /* keep existing top/bottom */ }
    else if (vc === "center") {
      const existing = css.transform as string | undefined;
      css.top = "50%";
      css.transform = existing ? `${existing} translateY(-50%)` : "translateY(-50%)";
    }
  }

  // Position
  if (style.position !== undefined) css.position = style.position;
  if (style.top !== undefined) css.top = r(style.top);
  if (style.right !== undefined) css.right = r(style.right);
  if (style.bottom !== undefined) css.bottom = r(style.bottom);
  if (style.left !== undefined) css.left = r(style.left);
  if (style.zIndex !== undefined) css.zIndex = style.zIndex;

  return css;
}

/**
 * Get available tokens for a given style property category.
 * Returns an array of { name, value, ref } for building token dropdowns.
 */
export function getTokensForCategory(
  category: string,
  tokens: DesignTokens | null
): Array<{ name: string; value: string; ref: string }> {
  if (!tokens) return [];

  let group: TokenGroup | undefined;
  let prefix: string;

  switch (category) {
    case "color":
      group = tokens.color;
      prefix = "color";
      break;
    case "spacing":
      group = tokens.spacing;
      prefix = "spacing";
      break;
    case "size":
      group = tokens.size;
      prefix = "size";
      break;
    case "typography.fontSize":
      group = tokens.typography?.fontSize;
      prefix = "typography.fontSize";
      break;
    case "typography.fontWeight":
      group = tokens.typography?.fontWeight;
      prefix = "typography.fontWeight";
      break;
    case "typography.lineHeight":
      group = tokens.typography?.lineHeight;
      prefix = "typography.lineHeight";
      break;
    case "typography.letterSpacing":
      group = tokens.typography?.letterSpacing;
      prefix = "typography.letterSpacing";
      break;
    case "typography.fontFamily":
      group = tokens.typography?.fontFamily;
      prefix = "typography.fontFamily";
      break;
    case "borderRadius":
      group = tokens.borderRadius;
      prefix = "borderRadius";
      break;
    case "shadow":
      group = tokens.shadow;
      prefix = "shadow";
      break;
    default:
      return [];
  }

  if (!group) return [];
  return Object.entries(group).map(([name, token]) => ({
    name,
    value: normaliseTokenValue(token.value) ?? "",
    ref: `$${prefix}.${name}`,
  }));
}

/**
 * Return named text styles from the DS, with all token references resolved to
 * concrete values so callers can apply them directly.
 */
export function getTextStyles(
  tokens: DesignTokens | null
): Array<{ name: string } & TextStyleDef> {
  if (!tokens?.textStyles) return [];
  return Object.entries(tokens.textStyles).map(([name, def]) => ({
    name,
    fontSize: def.fontSize
      ? (typeof def.fontSize === "string" && def.fontSize.startsWith("$")
          ? lookupToken(def.fontSize.slice(1), tokens) ?? def.fontSize
          : def.fontSize)
      : undefined,
    fontWeight: def.fontWeight
      ? (typeof def.fontWeight === "string" && def.fontWeight.startsWith("$")
          ? lookupToken(def.fontWeight.slice(1), tokens) ?? def.fontWeight
          : def.fontWeight)
      : undefined,
    lineHeight: def.lineHeight
      ? (typeof def.lineHeight === "string" && def.lineHeight.startsWith("$")
          ? lookupToken(def.lineHeight.slice(1), tokens) ?? def.lineHeight
          : def.lineHeight)
      : undefined,
    letterSpacing: def.letterSpacing
      ? (typeof def.letterSpacing === "string" && def.letterSpacing.startsWith("$")
          ? lookupToken(def.letterSpacing.slice(1), tokens) ?? def.letterSpacing
          : def.letterSpacing)
      : undefined,
    fontFamily: def.fontFamily
      ? (typeof def.fontFamily === "string" && def.fontFamily.startsWith("$")
          ? lookupToken(def.fontFamily.slice(1), tokens) ?? def.fontFamily
          : def.fontFamily)
      : undefined,
  }));
}

/**
 * Apply DS theme overrides onto a base DesignTokens object.
 * Overrides are in the form: { "color": { "primary": { value: "#new" } } }
 * Returns a new DesignTokens with the override values merged in.
 */
export function applyThemeOverrides(
  tokens: DesignTokens,
  overrides: Record<string, Record<string, { value: string }>>
): DesignTokens {
  if (!overrides || Object.keys(overrides).length === 0) return tokens;

  const result = { ...tokens } as Record<string, unknown>;

  for (const [groupKey, groupOverrides] of Object.entries(overrides)) {
    if (!groupOverrides || typeof groupOverrides !== "object") continue;
    const baseGroup = (tokens as Record<string, unknown>)[groupKey];
    if (baseGroup && typeof baseGroup === "object") {
      const mergedGroup = { ...(baseGroup as Record<string, unknown>) };
      for (const [tokenKey, override] of Object.entries(groupOverrides)) {
        if (override?.value !== undefined) {
          mergedGroup[tokenKey] = { ...((mergedGroup[tokenKey] as Record<string, unknown>) ?? {}), value: override.value };
        }
      }
      result[groupKey] = mergedGroup;
    }
  }

  return result as DesignTokens;
}
