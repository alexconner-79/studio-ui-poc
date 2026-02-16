/**
 * Token maps shared between the runtime renderer and the compiler.
 * These convert semantic token names to Tailwind CSS values.
 */

export const GAP_MAP: Record<string, string> = {
  xs: "1",
  sm: "2",
  md: "4",
  lg: "6",
  xl: "8",
};

export const SIZE_MAP: Record<string, string> = {
  xs: "2",
  sm: "4",
  md: "6",
  lg: "8",
  xl: "12",
};

export const resolveGap = (gap?: unknown): string => {
  if (typeof gap !== "string") return GAP_MAP.md;
  return GAP_MAP[gap] ?? GAP_MAP.md;
};

export const resolveSize = (size?: unknown): string => {
  if (typeof size !== "string") return SIZE_MAP.md;
  return SIZE_MAP[size] ?? SIZE_MAP.md;
};
