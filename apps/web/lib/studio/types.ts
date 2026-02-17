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
  | "Heading"
  | "Text"
  | "Image"
  | "Input"
  | "Link"
  | "Divider"
  | "List"
  | "Icon"
  | "Card"
  | "Button"
  | "Form"
  | "Modal"
  | "Tabs"
  | "Nav"
  | "DataTable";

export const BUILT_IN_TYPES: BuiltInNodeType[] = [
  "Stack",
  "Grid",
  "Section",
  "ScrollArea",
  "Spacer",
  "Heading",
  "Text",
  "Image",
  "Input",
  "Link",
  "Divider",
  "List",
  "Icon",
  "Card",
  "Button",
  "Form",
  "Modal",
  "Tabs",
  "Nav",
  "DataTable",
];

export const CONTAINER_TYPES = new Set<string>([
  "Stack",
  "Grid",
  "Section",
  "ScrollArea",
  "Card",
  "Form",
  "Modal",
  "Tabs",
  "Nav",
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
  fontSize?: StyleValue;
  fontWeight?: StyleValue;
  fontStyle?: "normal" | "italic";
  lineHeight?: StyleValue;
  letterSpacing?: StyleValue;
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

  // Layout (flex child / container)
  overflow?: "visible" | "hidden" | "auto" | "scroll";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
  flexWrap?: "nowrap" | "wrap";
  gap?: StyleValue;
  flexGrow?: number;
  flexShrink?: number;
  alignSelf?: "auto" | "flex-start" | "center" | "flex-end" | "stretch";

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
  raw: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Node
// ---------------------------------------------------------------------------

export type Node = {
  id: string;
  type: string;
  props?: NodeProps;
  children?: Node[];
  interactions?: NodeInteractions;
  dataSource?: DataSource;
  style?: NodeStyle;
};

export type ScreenMeta = {
  layout?: string;
  auth?: string;
};

export type ScreenSpec = {
  version: number;
  route: string;
  meta?: ScreenMeta;
  tree: Node;
};
