// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export type Gap = "xs" | "sm" | "md" | "lg" | "xl";
export type Size = "xs" | "sm" | "md" | "lg" | "xl";

// ---------------------------------------------------------------------------
// Node types (V1)
// ---------------------------------------------------------------------------

/** Built-in node type names. Anything else is treated as a repo component. */
export type BuiltInNodeType =
  // Layout primitives
  | "Stack"
  | "Grid"
  | "Section"
  | "ScrollArea"
  | "Spacer"
  // Content
  | "Heading"
  | "Text"
  | "Image"
  | "Input"
  | "Link"
  | "Divider"
  | "List"
  | "Icon"
  // Components
  | "Card"
  | "Button"
  | "Form"
  | "Modal"
  | "Tabs"
  | "Nav"
  | "DataTable";

export type NodeProps = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Interactions (7.5)
// ---------------------------------------------------------------------------

export type InteractionAction = "navigate" | "toggleVisibility" | "custom";
export type InteractionChangeAction = "setState" | "custom";
export type VisibilityOperator = "eq" | "neq" | "truthy";

export type NodeInteractions = {
  onClick?: { action: InteractionAction; target?: string; code?: string };
  onChange?: { action: InteractionChangeAction; target?: string; code?: string };
  visibleWhen?: { state: string; operator: VisibilityOperator; value?: string };
};

// ---------------------------------------------------------------------------
// Data binding (7.6)
// ---------------------------------------------------------------------------

export type DataSourceType = "static" | "api" | "mock";

export type DataSource = {
  type: DataSourceType;
  url?: string;
  data?: unknown[];
  mapping?: Record<string, string>;
};

export type Node = {
  id: string;
  type: string; // BuiltInNodeType or repo component name
  props?: NodeProps;
  children?: Node[];
  interactions?: NodeInteractions;
  dataSource?: DataSource;
};

// ---------------------------------------------------------------------------
// Screen spec (V1)
// ---------------------------------------------------------------------------

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
