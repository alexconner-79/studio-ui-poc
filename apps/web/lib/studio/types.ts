/**
 * Shared types for the Studio visual editor.
 * These mirror compiler/types.ts but are usable in browser context.
 */

export type Gap = "xs" | "sm" | "md" | "lg" | "xl";
export type Size = "xs" | "sm" | "md" | "lg" | "xl";

export type BuiltInNodeType =
  | "Stack"
  | "Grid"
  | "Section"
  | "ScrollArea"
  | "Spacer"
  | "Box"
  | "Container"
  | "AspectRatio"
  | "Heading"
  | "Text"
  | "Image"
  | "Input"
  | "Link"
  | "Divider"
  | "List"
  | "Icon"
  | "SVG"
  | "Card"
  | "Button"
  | "Form"
  | "Modal"
  | "Tabs"
  | "Nav"
  | "DataTable"
  | "CustomComponent"
  | "Textarea"
  | "Select"
  | "Checkbox"
  | "RadioGroup"
  | "Switch"
  | "Slider"
  | "Label"
  | "FileUpload"
  | "Avatar"
  | "Badge"
  | "Chip"
  | "Tooltip"
  | "Progress"
  | "Skeleton"
  | "Stat"
  | "Rating"
  | "Alert"
  | "Toast"
  | "Spinner"
  | "Dialog"
  | "Drawer"
  | "Sheet"
  | "Breadcrumb"
  | "Pagination"
  | "Stepper"
  | "Sidebar"
  | "DropdownMenu"
  | "AppBar"
  | "Accordion"
  | "Popover"
  | "HoverCard"
  | "Video"
  | "Embed"
  | "Blockquote"
  | "Code"
  | "Carousel"
  | "Calendar"
  | "Timeline"
  | "ComponentRef"
  // Shapes (v0.8.5)
  | "Rectangle"
  | "Ellipse"
  | "Line"
  | "Frame"
  | "ComponentInstance"
  | "ExternalComponent";

export const BUILT_IN_TYPES: BuiltInNodeType[] = [
  "Stack", "Grid", "Section", "ScrollArea", "Spacer", "Box", "Container", "AspectRatio",
  "Heading", "Text", "Image", "Input", "Link", "Divider", "List", "Icon", "SVG",
  "Card", "Button", "Form", "Modal", "Tabs", "Nav", "DataTable", "CustomComponent",
  "Textarea", "Select", "Checkbox", "RadioGroup", "Switch", "Slider", "Label", "FileUpload",
  "Avatar", "Badge", "Chip", "Tooltip", "Progress", "Skeleton", "Stat", "Rating",
  "Alert", "Toast", "Spinner", "Dialog", "Drawer", "Sheet",
  "Breadcrumb", "Pagination", "Stepper", "Sidebar", "DropdownMenu", "AppBar",
  "Accordion", "Popover", "HoverCard",
  "Video", "Embed", "Blockquote", "Code", "Carousel", "Calendar", "Timeline",
  "ComponentRef",
  "Rectangle", "Ellipse", "Line", "Frame",
];

export const CONTAINER_TYPES = new Set<string>([
  "Stack", "Grid", "Section", "ScrollArea", "Card", "Form", "Modal", "Tabs", "Nav",
  "Box", "Container", "AspectRatio", "CustomComponent",
  "Tooltip", "Alert", "Dialog", "Drawer", "Sheet",
  "Stepper", "Sidebar", "AppBar",
  "Accordion", "Popover", "HoverCard",
  "Carousel", "Timeline",
  "ComponentRef",
  "Frame", "Rectangle",
  "ComponentInstance", "ExternalComponent",
]);

export type NodeProps = Record<string, unknown>;

// Interactions (7.5)
export type InteractionAction = "navigate" | "toggleVisibility" | "custom";
export type InteractionChangeAction = "setState" | "custom";
export type VisibilityOperator = "eq" | "neq" | "truthy";

export type NodeInteractions = {
  onClick?: { action: InteractionAction; target?: string; code?: string };
  onChange?: { action: InteractionChangeAction; target?: string; code?: string };
  visibleWhen?: { state: string; operator: VisibilityOperator; value?: string };
};

// Data binding (7.6)
export type DataSourceType = "static" | "api" | "mock";

export type DataSource = {
  type: DataSourceType;
  url?: string;
  data?: unknown[];
  mapping?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Style values (token-aware)
// ---------------------------------------------------------------------------

/** A style value: either a raw CSS value or a token reference ("$color.primary") */
export type StyleValue = string | number;

export type NodeStyle = {
  // Typography
  fontFamily?: StyleValue;
  fontSize?: StyleValue;
  fontWeight?: StyleValue;
  fontStyle?: "normal" | "italic";
  lineHeight?: StyleValue;
  letterSpacing?: StyleValue;
  wordSpacing?: StyleValue;
  textAlign?: "left" | "center" | "right" | "justify";
  textDecoration?: "none" | "underline" | "line-through";
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  color?: StyleValue;

  // Sizing
  width?: StyleValue;
  height?: StyleValue;
  minWidth?: StyleValue;
  maxWidth?: StyleValue;
  minHeight?: StyleValue;
  maxHeight?: StyleValue;

  // Spacing (per-side)
  paddingTop?: StyleValue;
  paddingRight?: StyleValue;
  paddingBottom?: StyleValue;
  paddingLeft?: StyleValue;
  marginTop?: StyleValue;
  marginRight?: StyleValue;
  marginBottom?: StyleValue;
  marginLeft?: StyleValue;

  // Background
  backgroundColor?: StyleValue;
  backgroundImage?: string;

  // Border
  borderWidth?: StyleValue;
  borderColor?: StyleValue;
  borderStyle?: "none" | "solid" | "dashed" | "dotted";
  borderRadius?: StyleValue;
  borderTopLeftRadius?: StyleValue;
  borderTopRightRadius?: StyleValue;
  borderBottomLeftRadius?: StyleValue;
  borderBottomRightRadius?: StyleValue;

  // Effects
  opacity?: number;
  boxShadow?: StyleValue;

  // Effects stack — stackable, takes priority over boxShadow when present
  effects?: Array<
    | { type: "drop-shadow"; x: number; y: number; blur: number; spread: number; color: string; opacity: number; enabled?: boolean }
    | { type: "inner-shadow"; x: number; y: number; blur: number; spread: number; color: string; opacity: number; enabled?: boolean }
    | { type: "layer-blur"; radius: number; enabled?: boolean }
    | { type: "background-blur"; radius: number; enabled?: boolean }
    | { type: "glass"; blurRadius: number; backgroundOpacity: number; enabled?: boolean }
  >;

  // Multiple fills — backwards-compat: backgroundColor still works as a single solid fill
  fills?: Array<
    | { type: "solid"; color: string; opacity?: number }
    | { type: "linear-gradient"; angle: number; stops: Array<{ color: string; position: number }>; opacity?: number }
    | { type: "radial-gradient"; center: { x: number; y: number }; stops: Array<{ color: string; position: number }>; opacity?: number }
    | { type: "image"; src: string; size: "cover" | "contain" | "custom"; position?: string; opacity?: number }
  >;

  // Multiple strokes — backwards-compat: borderWidth/borderColor still work for a single center stroke
  strokes?: Array<{
    color: string;
    width: number;
    position: "inside" | "center" | "outside";
    dashPattern?: number[];
    opacity?: number;
  }>;

  // Blend mode
  mixBlendMode?: "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten" | "color-dodge" | "color-burn" | "hard-light" | "soft-light" | "difference" | "exclusion" | "hue" | "saturation" | "color" | "luminosity";

  // Transform components — compiled into a single CSS transform string
  rotation?: number;   // degrees (0–360)
  scaleX?: number;     // 1 = normal, -1 = flipped
  scaleY?: number;
  skewX?: number;      // degrees
  skewY?: number;

  // CSS Filters
  cssFilters?: Array<{
    type: "brightness" | "contrast" | "saturate" | "hue-rotate" | "grayscale" | "sepia" | "invert";
    value: number;
  }>;

  // Layout (flex container)
  flexDirection?: "row" | "column";
  overflow?: "visible" | "hidden" | "auto" | "scroll";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
  flexWrap?: "nowrap" | "wrap";
  gap?: StyleValue;

  // Layout (flex child)
  flexGrow?: number;
  flexShrink?: number;
  alignSelf?: "auto" | "flex-start" | "center" | "flex-end" | "stretch";

  // Sizing modes (override raw width/height)
  widthMode?: "fixed" | "fill" | "hug";
  heightMode?: "fixed" | "fill" | "hug";

  // Edge constraints (active when inside a Frame with autoLayout OFF)
  constraints?: {
    horizontal?: "left" | "right" | "left-right" | "center" | "scale";
    vertical?: "top" | "bottom" | "top-bottom" | "center" | "scale";
  };

  // Position
  position?: "static" | "relative" | "absolute" | "fixed" | "sticky";
  top?: StyleValue;
  right?: StyleValue;
  bottom?: StyleValue;
  left?: StyleValue;
  zIndex?: number;
};

// ---------------------------------------------------------------------------
// Design tokens (runtime type for editor)
// ---------------------------------------------------------------------------

export type TokenValue = {
  value: string;
  type?: string;
};

export type TokenGroup = Record<string, TokenValue>;

export type TextStyleDef = {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
};

export type DesignTokens = {
  spacing?: TokenGroup;
  size?: TokenGroup;
  color?: TokenGroup;
  typography?: {
    fontFamily?: TokenGroup;
    fontSize?: TokenGroup;
    fontWeight?: TokenGroup;
    lineHeight?: TokenGroup;
    letterSpacing?: TokenGroup;
  };
  borderRadius?: TokenGroup;
  shadow?: TokenGroup;
  /** Named text style presets (e.g. H1, H2, Body, Caption) */
  textStyles?: Record<string, TextStyleDef>;
  raw: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------

/** Per-breakpoint style overrides. Keys are breakpoint names; values override NodeStyle. */
export type ResponsiveOverrides = {
  tablet?: Partial<NodeStyle>;
  mobile?: Partial<NodeStyle>;
};

export type Node = {
  id: string;
  type: string;
  /** User-facing layer label. Falls back to `type` when absent. */
  name?: string;
  props?: NodeProps;
  children?: Node[];
  interactions?: NodeInteractions;
  dataSource?: DataSource;
  style?: NodeStyle;
  responsive?: ResponsiveOverrides;
  /** When false the compiler skips this node and its subtree. Absent = true. */
  compile?: boolean;
};

export type ScreenMeta = {
  layout?: string;
  auth?: string;
};

// ---------------------------------------------------------------------------
// Brownfield codebase import types (0.10.5)
// ---------------------------------------------------------------------------

export interface BrownfieldSourceConfig {
  type: "local" | "npm" | "github";
  path?: string;
  packageName?: string;
  packageVersion?: string;
  owner?: string;
  repo?: string;
  branch?: string;
  scannedAt: string;
}

export interface ScannedProp {
  name: string;
  type: string;
  required: boolean;
  defaultValue?: string;
}

export interface ScannedComponent {
  name: string;
  importPath: string;
  props: ScannedProp[];
  variants: string[];
  needsManualMapping: boolean;
  /** Absolute path to the source file that exports this component (local scan only). */
  filePath?: string;
  /** The export name to resolve from the bundled module (defaults to `name`). */
  exportName?: string;
}

export interface TokenDiff {
  key: string;
  category: string;
  status: "added" | "changed" | "removed";
  oldValue?: string;
  newValue?: string;
}

export interface ScanResult {
  components: ScannedComponent[];
  tokens: Record<string, unknown>;
  warnings: string[];
  sourceConfig: BrownfieldSourceConfig;
}

export type ScreenSpec = {
  version: number;
  route: string;
  meta?: ScreenMeta;
  tree: Node;
};

// v0.10.11 — AI-Ready Codebase: human-readable design change log
export interface DesignChange {
  id: string;
  timestamp: string;
  action: "added" | "removed" | "updated" | "moved" | "renamed" | "styled" | "grouped" | "ungrouped";
  description: string;
  nodeId?: string;
  screenName?: string;
}
