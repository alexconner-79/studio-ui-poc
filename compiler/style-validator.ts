/**
 * Framework-aware style validation for the compiler.
 *
 * Filters unsupported style properties before they reach framework-specific
 * emitters. This is a defensive guard — the emitters themselves already skip
 * unknown properties, but this catches edge cases where a property might
 * produce broken output rather than being silently ignored.
 */

import type { NodeStyle } from "./types";

type EffectEntry = NonNullable<NodeStyle["effects"]>[number];
type FillEntry = NonNullable<NodeStyle["fills"]>[number];
type StrokeEntry = NonNullable<NodeStyle["strokes"]>[number];

const EXPO_UNSUPPORTED_EFFECTS = new Set(["inner-shadow", "layer-blur", "background-blur", "glass"]);
const EXPO_UNSUPPORTED_FILL_TYPES = new Set(["linear-gradient", "radial-gradient", "image"]);

export function validateStyleForFramework(
  style: NodeStyle | undefined,
  framework: string
): NodeStyle | undefined {
  if (!style || framework !== "expo") return style;

  const filtered = { ...style };

  if (filtered.cssFilters) {
    delete filtered.cssFilters;
  }

  if (filtered.mixBlendMode) {
    delete filtered.mixBlendMode;
  }

  if (filtered.backgroundImage) {
    delete filtered.backgroundImage;
  }

  if (filtered.effects) {
    filtered.effects = filtered.effects.filter(
      (e: EffectEntry) => !EXPO_UNSUPPORTED_EFFECTS.has(e.type)
    ) as typeof filtered.effects;
    if (filtered.effects && filtered.effects.length === 0) {
      delete filtered.effects;
    }
  }

  if (filtered.fills) {
    filtered.fills = filtered.fills.filter(
      (f: FillEntry) => !EXPO_UNSUPPORTED_FILL_TYPES.has(f.type)
    ) as typeof filtered.fills;
    if (filtered.fills && filtered.fills.length === 0) {
      delete filtered.fills;
    }
  }

  if (filtered.strokes) {
    filtered.strokes = filtered.strokes.filter(
      (s: StrokeEntry) => s.position === "center"
    ) as typeof filtered.strokes;
    if (filtered.strokes && filtered.strokes.length === 0) {
      delete filtered.strokes;
    }
  }

  return filtered;
}
