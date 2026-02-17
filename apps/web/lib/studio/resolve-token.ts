/**
 * Token resolver utility for the editor runtime.
 * Resolves "$color.primary" style references to actual CSS values from design tokens.
 */

import type { StyleValue, NodeStyle, DesignTokens, TokenGroup } from "./types";

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

function lookupToken(path: string, tokens: DesignTokens | null): string | undefined {
  if (!tokens) return undefined;
  const segments = path.split(".");

  // Navigate into the tokens object by dot path
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = tokens;
  for (let i = 0; i < segments.length; i++) {
    if (current === undefined || current === null) return undefined;
    current = current[segments[i]];
  }

  // If we ended up at a TokenValue object, return its .value
  if (current && typeof current === "object" && typeof current.value === "string") {
    return current.value;
  }
  // If it's a raw string, return it
  if (typeof current === "string") return current;

  return undefined;
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
  if (style.textAlign !== undefined) css.textAlign = style.textAlign;
  if (style.textDecoration !== undefined) css.textDecoration = style.textDecoration;
  if (style.textTransform !== undefined) css.textTransform = style.textTransform;
  if (style.color !== undefined) css.color = String(r(style.color) ?? "");

  // Sizing
  if (style.width !== undefined) css.width = r(style.width);
  if (style.height !== undefined) css.height = r(style.height);
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
  if (style.overflow !== undefined) css.overflow = style.overflow;
  if (style.justifyContent !== undefined) css.justifyContent = style.justifyContent;
  if (style.alignItems !== undefined) css.alignItems = style.alignItems;
  if (style.flexWrap !== undefined) css.flexWrap = style.flexWrap;
  if (style.gap !== undefined) css.gap = r(style.gap);
  if (style.flexGrow !== undefined) css.flexGrow = style.flexGrow;
  if (style.flexShrink !== undefined) css.flexShrink = style.flexShrink;
  if (style.alignSelf !== undefined) css.alignSelf = style.alignSelf;

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
    value: token.value,
    ref: `$${prefix}.${name}`,
  }));
}
