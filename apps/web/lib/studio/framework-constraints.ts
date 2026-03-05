/**
 * Framework-aware style constraints.
 *
 * Defines which style properties and effect types are supported per framework.
 * Used by the property panel to hide unsupported controls and by the compiler
 * to strip unsupported properties before emission.
 */

export type FrameworkId = "nextjs" | "vue" | "svelte" | "html" | "expo";

export type StyleSection =
  | "fills"
  | "strokes"
  | "effects"
  | "cssFilters"
  | "transform"
  | "blendMode"
  | "backgroundImage"
  | "position";

export type EffectType =
  | "drop-shadow"
  | "inner-shadow"
  | "layer-blur"
  | "background-blur"
  | "glass";

export type FillType = "solid" | "linear-gradient" | "radial-gradient" | "image";

export type StrokePosition = "inside" | "center" | "outside";

export interface FrameworkConstraint {
  supportedSections: StyleSection[];
  supportedEffects: EffectType[];
  supportedFillTypes: FillType[];
  supportedStrokePositions: StrokePosition[];
}

const WEB_CONSTRAINT: FrameworkConstraint = {
  supportedSections: [
    "fills",
    "strokes",
    "effects",
    "cssFilters",
    "transform",
    "blendMode",
    "backgroundImage",
    "position",
  ],
  supportedEffects: ["drop-shadow", "inner-shadow", "layer-blur", "background-blur", "glass"],
  supportedFillTypes: ["solid", "linear-gradient", "radial-gradient", "image"],
  supportedStrokePositions: ["inside", "center", "outside"],
};

const EXPO_CONSTRAINT: FrameworkConstraint = {
  supportedSections: ["fills", "strokes", "effects", "transform", "position"],
  supportedEffects: ["drop-shadow"],
  supportedFillTypes: ["solid"],
  supportedStrokePositions: ["center"],
};

export const FRAMEWORK_CONSTRAINTS: Record<string, FrameworkConstraint> = {
  nextjs: WEB_CONSTRAINT,
  vue: WEB_CONSTRAINT,
  svelte: WEB_CONSTRAINT,
  html: WEB_CONSTRAINT,
  expo: EXPO_CONSTRAINT,
};

export function getConstraints(framework: string): FrameworkConstraint {
  return FRAMEWORK_CONSTRAINTS[framework] ?? WEB_CONSTRAINT;
}

export function isSectionSupported(framework: string, section: StyleSection): boolean {
  return getConstraints(framework).supportedSections.includes(section);
}

export function isEffectSupported(framework: string, effect: EffectType): boolean {
  return getConstraints(framework).supportedEffects.includes(effect);
}

export function isFillTypeSupported(framework: string, fillType: FillType): boolean {
  return getConstraints(framework).supportedFillTypes.includes(fillType);
}

export function isStrokePositionSupported(framework: string, position: StrokePosition): boolean {
  return getConstraints(framework).supportedStrokePositions.includes(position);
}

/**
 * Returns a human-readable summary of what's hidden for a given framework.
 * Used by the info disclosure tooltip.
 */
export function getHiddenSummary(framework: string): string | null {
  if (framework === "expo") {
    return [
      "CSS Filters, blend modes, and background images are not supported in React Native.",
      "Only drop shadows are available (no inner shadow, blur, or glass effects).",
      "Only solid fills are supported (no gradients or image fills).",
      "Only center-positioned strokes are supported.",
    ].join(" ");
  }
  return null;
}
