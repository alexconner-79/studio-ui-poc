/**
 * Prop schemas per built-in node type.
 * Used by the property panel to generate form fields and by the
 * renderer for default values.
 */

export type PropType = "string" | "number" | "boolean" | "array";

export type PropDef = {
  type: PropType;
  label: string;
  required?: boolean;
  defaultValue?: unknown;
  options?: { label: string; value: string | number | boolean }[];
};

export type NodeSchema = {
  type: string;
  label: string;
  category: "Layout" | "Content" | "Components";
  description: string;
  props: Record<string, PropDef>;
  acceptsChildren: boolean;
};

const TOKEN_OPTIONS = [
  { label: "xs", value: "xs" },
  { label: "sm", value: "sm" },
  { label: "md", value: "md" },
  { label: "lg", value: "lg" },
  { label: "xl", value: "xl" },
];

export const NODE_SCHEMAS: Record<string, NodeSchema> = {
  Stack: {
    type: "Stack",
    label: "Stack",
    category: "Layout",
    description: "Vertical or horizontal flex container",
    acceptsChildren: true,
    props: {
      gap: {
        type: "string",
        label: "Gap",
        defaultValue: "md",
        options: TOKEN_OPTIONS,
      },
      padding: {
        type: "string",
        label: "Padding",
        options: TOKEN_OPTIONS,
      },
      direction: {
        type: "string",
        label: "Direction",
        defaultValue: "column",
        options: [
          { label: "Column", value: "column" },
          { label: "Row", value: "row" },
        ],
      },
    },
  },
  Grid: {
    type: "Grid",
    label: "Grid",
    category: "Layout",
    description: "CSS grid container with columns",
    acceptsChildren: true,
    props: {
      columns: {
        type: "number",
        label: "Columns",
        defaultValue: 2,
      },
      gap: {
        type: "string",
        label: "Gap",
        defaultValue: "md",
        options: TOKEN_OPTIONS,
      },
    },
  },
  Section: {
    type: "Section",
    label: "Section",
    category: "Layout",
    description: "Semantic section wrapper",
    acceptsChildren: true,
    props: {
      padding: {
        type: "string",
        label: "Padding",
        options: TOKEN_OPTIONS,
      },
    },
  },
  ScrollArea: {
    type: "ScrollArea",
    label: "Scroll Area",
    category: "Layout",
    description: "Scrollable container with custom scrollbar",
    acceptsChildren: true,
    props: {
      height: {
        type: "string",
        label: "Height",
        defaultValue: "auto",
      },
    },
  },
  Spacer: {
    type: "Spacer",
    label: "Spacer",
    category: "Layout",
    description: "Vertical spacing element",
    acceptsChildren: false,
    props: {
      size: {
        type: "string",
        label: "Size",
        defaultValue: "md",
        options: TOKEN_OPTIONS,
      },
    },
  },
  Heading: {
    type: "Heading",
    label: "Heading",
    category: "Content",
    description: "Heading text (h1-h6)",
    acceptsChildren: false,
    props: {
      text: { type: "string", label: "Text", defaultValue: "Heading" },
      level: {
        type: "number",
        label: "Level",
        defaultValue: 1,
        options: [
          { label: "H1", value: 1 },
          { label: "H2", value: 2 },
          { label: "H3", value: 3 },
          { label: "H4", value: 4 },
          { label: "H5", value: 5 },
          { label: "H6", value: 6 },
        ],
      },
      variant: {
        type: "string",
        label: "Variant",
        options: [
          { label: "Default (by level)", value: "" },
          { label: "Hero", value: "hero" },
          { label: "Title", value: "title" },
          { label: "Subtitle", value: "subtitle" },
          { label: "Section", value: "section" },
        ],
      },
      fontFamily: { type: "string", label: "Font Family", defaultValue: "" },
    },
  },
  Text: {
    type: "Text",
    label: "Text",
    category: "Content",
    description: "Paragraph text",
    acceptsChildren: false,
    props: {
      text: {
        type: "string",
        label: "Text",
        defaultValue: "Text content",
      },
      variant: {
        type: "string",
        label: "Variant",
        options: [
          { label: "Default", value: "" },
          { label: "Body", value: "body" },
          { label: "Muted", value: "muted" },
        ],
      },
      fontFamily: { type: "string", label: "Font Family", defaultValue: "" },
    },
  },
  Image: {
    type: "Image",
    label: "Image",
    category: "Content",
    description: "Image element",
    acceptsChildren: false,
    props: {
      src: { type: "string", label: "Source URL", required: true },
      alt: { type: "string", label: "Alt text", required: true },
      width: { type: "number", label: "Width" },
      height: { type: "number", label: "Height" },
    },
  },
  Input: {
    type: "Input",
    label: "Input",
    category: "Content",
    description: "Form input field",
    acceptsChildren: false,
    props: {
      placeholder: { type: "string", label: "Placeholder" },
      type: {
        type: "string",
        label: "Type",
        defaultValue: "text",
        options: [
          { label: "Text", value: "text" },
          { label: "Email", value: "email" },
          { label: "Password", value: "password" },
          { label: "Number", value: "number" },
          { label: "Tel", value: "tel" },
          { label: "URL", value: "url" },
        ],
      },
      label: { type: "string", label: "Label" },
    },
  },
  Link: {
    type: "Link",
    label: "Link",
    category: "Content",
    description: "Navigation link",
    acceptsChildren: false,
    props: {
      href: { type: "string", label: "URL", required: true },
      text: { type: "string", label: "Text" },
    },
  },
  Divider: {
    type: "Divider",
    label: "Divider",
    category: "Content",
    description: "Horizontal separator line",
    acceptsChildren: false,
    props: {},
  },
  List: {
    type: "List",
    label: "List",
    category: "Content",
    description: "Ordered or unordered list",
    acceptsChildren: false,
    props: {
      items: { type: "array", label: "Items", defaultValue: [] },
      ordered: { type: "boolean", label: "Ordered", defaultValue: false },
    },
  },
  Icon: {
    type: "Icon",
    label: "Icon",
    category: "Content",
    description: "Lucide icon",
    acceptsChildren: false,
    props: {
      name: { type: "string", label: "Icon Name", defaultValue: "Star" },
      size: { type: "number", label: "Size (px)", defaultValue: 24 },
      color: { type: "string", label: "Color", defaultValue: "" },
    },
  },
  Card: {
    type: "Card",
    label: "Card",
    category: "Components",
    description: "Card container with border and shadow",
    acceptsChildren: true,
    props: {
      padding: {
        type: "string",
        label: "Padding",
        defaultValue: "md",
        options: TOKEN_OPTIONS,
      },
    },
  },
  Button: {
    type: "Button",
    label: "Button",
    category: "Components",
    description: "Clickable button",
    acceptsChildren: false,
    props: {
      label: { type: "string", label: "Label", defaultValue: "Button" },
      intent: {
        type: "string",
        label: "Intent",
        defaultValue: "primary",
        options: [
          { label: "Default", value: "default" },
          { label: "Primary", value: "primary" },
          { label: "Secondary", value: "secondary" },
          { label: "Destructive", value: "destructive" },
          { label: "Outline", value: "outline" },
          { label: "Ghost", value: "ghost" },
          { label: "Link", value: "link" },
        ],
      },
      size: {
        type: "string",
        label: "Size",
        defaultValue: "default",
        options: [
          { label: "Default", value: "default" },
          { label: "XS", value: "xs" },
          { label: "SM", value: "sm" },
          { label: "LG", value: "lg" },
          { label: "Icon", value: "icon" },
        ],
      },
    },
  },
  Form: {
    type: "Form",
    label: "Form",
    category: "Components",
    description: "Form wrapper with action and method",
    acceptsChildren: true,
    props: {
      action: { type: "string", label: "Action URL" },
      method: {
        type: "string",
        label: "Method",
        defaultValue: "post",
        options: [
          { label: "POST", value: "post" },
          { label: "GET", value: "get" },
        ],
      },
    },
  },
  Modal: {
    type: "Modal",
    label: "Modal",
    category: "Components",
    description: "Dialog overlay container",
    acceptsChildren: true,
    props: {
      title: { type: "string", label: "Title", defaultValue: "Dialog" },
      open: { type: "boolean", label: "Open (preview)", defaultValue: true },
    },
  },
  Tabs: {
    type: "Tabs",
    label: "Tabs",
    category: "Components",
    description: "Tabbed navigation container",
    acceptsChildren: true,
    props: {
      tabs: {
        type: "array",
        label: "Tab labels",
        defaultValue: ["Tab 1", "Tab 2"],
      },
    },
  },
  Nav: {
    type: "Nav",
    label: "Nav",
    category: "Components",
    description: "Navigation bar",
    acceptsChildren: true,
    props: {
      orientation: {
        type: "string",
        label: "Orientation",
        defaultValue: "horizontal",
        options: [
          { label: "Horizontal", value: "horizontal" },
          { label: "Vertical", value: "vertical" },
        ],
      },
      items: {
        type: "array",
        label: "Nav items (label|href per line)",
        defaultValue: ["Home|/", "About|/about"],
      },
    },
  },
  DataTable: {
    type: "DataTable",
    label: "Data Table",
    category: "Components",
    description: "Table from column definitions and sample data",
    acceptsChildren: false,
    props: {
      columns: {
        type: "array",
        label: "Columns (key|label per line)",
        defaultValue: ["name|Name", "email|Email", "role|Role"],
      },
      rows: {
        type: "array",
        label: "Rows (JSON per line)",
        defaultValue: [
          '{"name":"Alice","email":"alice@example.com","role":"Admin"}',
          '{"name":"Bob","email":"bob@example.com","role":"User"}',
        ],
      },
    },
  },
};
