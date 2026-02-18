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

export type NodeCategory =
  | "Layout"
  | "Content"
  | "Components"
  | "Forms"
  | "Data Display"
  | "Feedback"
  | "Navigation"
  | "Surfaces"
  | "Media";

export type NodeSchema = {
  type: string;
  label: string;
  category: NodeCategory;
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

  // ── D2a: Design Freedom Nodes ─────────────────────────────────────

  Box: {
    type: "Box",
    label: "Box",
    category: "Layout",
    description: "Freeform styled container (unstyled div)",
    acceptsChildren: true,
    props: {},
  },
  SVG: {
    type: "SVG",
    label: "SVG",
    category: "Media",
    description: "Inline SVG vector graphics",
    acceptsChildren: false,
    props: {
      code: { type: "string", label: "SVG Code", defaultValue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>' },
      width: { type: "number", label: "Width", defaultValue: 24 },
      height: { type: "number", label: "Height", defaultValue: 24 },
    },
  },
  CustomComponent: {
    type: "CustomComponent",
    label: "Custom Component",
    category: "Components",
    description: "Wrap any external React component",
    acceptsChildren: true,
    props: {
      importPath: { type: "string", label: "Import Path", required: true, defaultValue: "@/components/ui/badge" },
      componentName: { type: "string", label: "Component Name", required: true, defaultValue: "Badge" },
      propValues: { type: "string", label: "Props (JSON)", defaultValue: "{}" },
    },
  },

  // ── D2b: Forms & Input ────────────────────────────────────────────

  Textarea: {
    type: "Textarea",
    label: "Textarea",
    category: "Forms",
    description: "Multi-line text input",
    acceptsChildren: false,
    props: {
      placeholder: { type: "string", label: "Placeholder", defaultValue: "Enter text..." },
      rows: { type: "number", label: "Rows", defaultValue: 4 },
      label: { type: "string", label: "Label" },
    },
  },
  Select: {
    type: "Select",
    label: "Select",
    category: "Forms",
    description: "Dropdown select input",
    acceptsChildren: false,
    props: {
      placeholder: { type: "string", label: "Placeholder", defaultValue: "Choose..." },
      options: { type: "array", label: "Options (value|label per line)", defaultValue: ["opt1|Option 1", "opt2|Option 2", "opt3|Option 3"] },
      label: { type: "string", label: "Label" },
    },
  },
  Checkbox: {
    type: "Checkbox",
    label: "Checkbox",
    category: "Forms",
    description: "Boolean checkbox input",
    acceptsChildren: false,
    props: {
      label: { type: "string", label: "Label", defaultValue: "Accept terms" },
      checked: { type: "boolean", label: "Checked", defaultValue: false },
    },
  },
  RadioGroup: {
    type: "RadioGroup",
    label: "Radio Group",
    category: "Forms",
    description: "Single-select radio group",
    acceptsChildren: false,
    props: {
      options: { type: "array", label: "Options (value|label per line)", defaultValue: ["a|Option A", "b|Option B", "c|Option C"] },
      label: { type: "string", label: "Label" },
      defaultValue: { type: "string", label: "Default Value", defaultValue: "a" },
    },
  },
  Switch: {
    type: "Switch",
    label: "Switch",
    category: "Forms",
    description: "Toggle switch",
    acceptsChildren: false,
    props: {
      label: { type: "string", label: "Label", defaultValue: "Enable notifications" },
      checked: { type: "boolean", label: "Checked", defaultValue: false },
    },
  },
  Slider: {
    type: "Slider",
    label: "Slider",
    category: "Forms",
    description: "Range slider input",
    acceptsChildren: false,
    props: {
      min: { type: "number", label: "Min", defaultValue: 0 },
      max: { type: "number", label: "Max", defaultValue: 100 },
      step: { type: "number", label: "Step", defaultValue: 1 },
      defaultValue: { type: "number", label: "Default Value", defaultValue: 50 },
      label: { type: "string", label: "Label" },
    },
  },
  Label: {
    type: "Label",
    label: "Label",
    category: "Forms",
    description: "Form field label",
    acceptsChildren: false,
    props: {
      text: { type: "string", label: "Text", defaultValue: "Label" },
      htmlFor: { type: "string", label: "For (input ID)" },
    },
  },
  FileUpload: {
    type: "FileUpload",
    label: "File Upload",
    category: "Forms",
    description: "File upload drop zone",
    acceptsChildren: false,
    props: {
      accept: { type: "string", label: "Accept", defaultValue: "image/*" },
      label: { type: "string", label: "Label", defaultValue: "Drop files here or click to upload" },
    },
  },

  // ── D2c: Data Display ─────────────────────────────────────────────

  Avatar: {
    type: "Avatar",
    label: "Avatar",
    category: "Data Display",
    description: "User avatar with image or initials",
    acceptsChildren: false,
    props: {
      src: { type: "string", label: "Image URL" },
      fallback: { type: "string", label: "Fallback Initials", defaultValue: "AB" },
      size: { type: "number", label: "Size (px)", defaultValue: 40 },
    },
  },
  Badge: {
    type: "Badge",
    label: "Badge",
    category: "Data Display",
    description: "Small status badge / tag",
    acceptsChildren: false,
    props: {
      text: { type: "string", label: "Text", defaultValue: "Badge" },
      variant: {
        type: "string",
        label: "Variant",
        defaultValue: "default",
        options: [
          { label: "Default", value: "default" },
          { label: "Secondary", value: "secondary" },
          { label: "Destructive", value: "destructive" },
          { label: "Outline", value: "outline" },
        ],
      },
    },
  },
  Chip: {
    type: "Chip",
    label: "Chip",
    category: "Data Display",
    description: "Removable tag / chip",
    acceptsChildren: false,
    props: {
      text: { type: "string", label: "Text", defaultValue: "Chip" },
      removable: { type: "boolean", label: "Removable", defaultValue: true },
    },
  },
  Tooltip: {
    type: "Tooltip",
    label: "Tooltip",
    category: "Data Display",
    description: "Hover tooltip wrapper",
    acceptsChildren: true,
    props: {
      content: { type: "string", label: "Tooltip Text", defaultValue: "Helpful tip" },
      side: {
        type: "string",
        label: "Side",
        defaultValue: "top",
        options: [
          { label: "Top", value: "top" },
          { label: "Bottom", value: "bottom" },
          { label: "Left", value: "left" },
          { label: "Right", value: "right" },
        ],
      },
    },
  },
  Progress: {
    type: "Progress",
    label: "Progress",
    category: "Data Display",
    description: "Progress bar",
    acceptsChildren: false,
    props: {
      value: { type: "number", label: "Value (%)", defaultValue: 60 },
      max: { type: "number", label: "Max", defaultValue: 100 },
      label: { type: "string", label: "Label" },
    },
  },
  Skeleton: {
    type: "Skeleton",
    label: "Skeleton",
    category: "Data Display",
    description: "Loading placeholder skeleton",
    acceptsChildren: false,
    props: {
      width: { type: "string", label: "Width", defaultValue: "100%" },
      height: { type: "string", label: "Height", defaultValue: "20px" },
      variant: {
        type: "string",
        label: "Variant",
        defaultValue: "text",
        options: [
          { label: "Text", value: "text" },
          { label: "Circular", value: "circular" },
          { label: "Rectangular", value: "rectangular" },
        ],
      },
    },
  },
  Stat: {
    type: "Stat",
    label: "Stat",
    category: "Data Display",
    description: "Statistic with label and value",
    acceptsChildren: false,
    props: {
      label: { type: "string", label: "Label", defaultValue: "Total Users" },
      value: { type: "string", label: "Value", defaultValue: "1,234" },
      change: { type: "string", label: "Change", defaultValue: "+12%" },
      trend: {
        type: "string",
        label: "Trend",
        defaultValue: "up",
        options: [
          { label: "Up", value: "up" },
          { label: "Down", value: "down" },
          { label: "Neutral", value: "neutral" },
        ],
      },
    },
  },
  Rating: {
    type: "Rating",
    label: "Rating",
    category: "Data Display",
    description: "Star rating display",
    acceptsChildren: false,
    props: {
      value: { type: "number", label: "Value", defaultValue: 3 },
      max: { type: "number", label: "Max Stars", defaultValue: 5 },
      readonly: { type: "boolean", label: "Read Only", defaultValue: true },
    },
  },

  // ── D2d: Feedback ─────────────────────────────────────────────────

  Alert: {
    type: "Alert",
    label: "Alert",
    category: "Feedback",
    description: "Alert banner with variant",
    acceptsChildren: true,
    props: {
      title: { type: "string", label: "Title", defaultValue: "Heads up!" },
      description: { type: "string", label: "Description", defaultValue: "This is an alert message." },
      variant: {
        type: "string",
        label: "Variant",
        defaultValue: "default",
        options: [
          { label: "Default", value: "default" },
          { label: "Info", value: "info" },
          { label: "Success", value: "success" },
          { label: "Warning", value: "warning" },
          { label: "Error", value: "error" },
        ],
      },
    },
  },
  Toast: {
    type: "Toast",
    label: "Toast",
    category: "Feedback",
    description: "Toast notification preview",
    acceptsChildren: false,
    props: {
      title: { type: "string", label: "Title", defaultValue: "Success" },
      description: { type: "string", label: "Description", defaultValue: "Your changes have been saved." },
      variant: {
        type: "string",
        label: "Variant",
        defaultValue: "default",
        options: [
          { label: "Default", value: "default" },
          { label: "Success", value: "success" },
          { label: "Error", value: "error" },
        ],
      },
    },
  },
  Spinner: {
    type: "Spinner",
    label: "Spinner",
    category: "Feedback",
    description: "Loading spinner",
    acceptsChildren: false,
    props: {
      size: { type: "number", label: "Size (px)", defaultValue: 24 },
      label: { type: "string", label: "Screen Reader Label", defaultValue: "Loading..." },
    },
  },
  Dialog: {
    type: "Dialog",
    label: "Dialog",
    category: "Feedback",
    description: "Centered dialog overlay",
    acceptsChildren: true,
    props: {
      title: { type: "string", label: "Title", defaultValue: "Confirm Action" },
      description: { type: "string", label: "Description" },
      open: { type: "boolean", label: "Open (preview)", defaultValue: true },
    },
  },
  Drawer: {
    type: "Drawer",
    label: "Drawer",
    category: "Feedback",
    description: "Slide-out panel from edge",
    acceptsChildren: true,
    props: {
      title: { type: "string", label: "Title", defaultValue: "Drawer" },
      side: {
        type: "string",
        label: "Side",
        defaultValue: "right",
        options: [
          { label: "Left", value: "left" },
          { label: "Right", value: "right" },
        ],
      },
      open: { type: "boolean", label: "Open (preview)", defaultValue: true },
    },
  },
  Sheet: {
    type: "Sheet",
    label: "Sheet",
    category: "Feedback",
    description: "Bottom sheet overlay",
    acceptsChildren: true,
    props: {
      title: { type: "string", label: "Title", defaultValue: "Sheet" },
      open: { type: "boolean", label: "Open (preview)", defaultValue: true },
    },
  },

  // ── D2e: Navigation ───────────────────────────────────────────────

  Breadcrumb: {
    type: "Breadcrumb",
    label: "Breadcrumb",
    category: "Navigation",
    description: "Breadcrumb trail",
    acceptsChildren: false,
    props: {
      items: { type: "array", label: "Items (label|href per line)", defaultValue: ["Home|/", "Products|/products", "Detail"] },
      separator: { type: "string", label: "Separator", defaultValue: "/" },
    },
  },
  Pagination: {
    type: "Pagination",
    label: "Pagination",
    category: "Navigation",
    description: "Page number navigation",
    acceptsChildren: false,
    props: {
      totalPages: { type: "number", label: "Total Pages", defaultValue: 10 },
      currentPage: { type: "number", label: "Current Page", defaultValue: 1 },
    },
  },
  Stepper: {
    type: "Stepper",
    label: "Stepper",
    category: "Navigation",
    description: "Multi-step progress indicator",
    acceptsChildren: true,
    props: {
      steps: { type: "array", label: "Step Labels", defaultValue: ["Account", "Profile", "Review"] },
      currentStep: { type: "number", label: "Current Step", defaultValue: 1 },
    },
  },
  Sidebar: {
    type: "Sidebar",
    label: "Sidebar",
    category: "Navigation",
    description: "Side navigation panel",
    acceptsChildren: true,
    props: {
      items: { type: "array", label: "Items (label|href per line)", defaultValue: ["Dashboard|/dashboard", "Settings|/settings", "Profile|/profile"] },
      collapsed: { type: "boolean", label: "Collapsed", defaultValue: false },
    },
  },
  DropdownMenu: {
    type: "DropdownMenu",
    label: "Dropdown Menu",
    category: "Navigation",
    description: "Dropdown action menu",
    acceptsChildren: false,
    props: {
      trigger: { type: "string", label: "Trigger Label", defaultValue: "Actions" },
      items: { type: "array", label: "Items (label|action per line)", defaultValue: ["Edit|edit", "Duplicate|duplicate", "Delete|delete"] },
    },
  },
  AppBar: {
    type: "AppBar",
    label: "App Bar",
    category: "Navigation",
    description: "Top application bar / header",
    acceptsChildren: true,
    props: {
      title: { type: "string", label: "Title", defaultValue: "My App" },
      sticky: { type: "boolean", label: "Sticky", defaultValue: true },
    },
  },

  // ── D2f: Surfaces & Containers ────────────────────────────────────

  Container: {
    type: "Container",
    label: "Container",
    category: "Layout",
    description: "Max-width centered container",
    acceptsChildren: true,
    props: {
      maxWidth: {
        type: "string",
        label: "Max Width",
        defaultValue: "lg",
        options: [
          { label: "SM (640px)", value: "sm" },
          { label: "MD (768px)", value: "md" },
          { label: "LG (1024px)", value: "lg" },
          { label: "XL (1280px)", value: "xl" },
          { label: "2XL (1536px)", value: "2xl" },
          { label: "Full", value: "full" },
        ],
      },
      padding: { type: "string", label: "Padding", options: TOKEN_OPTIONS },
    },
  },
  AspectRatio: {
    type: "AspectRatio",
    label: "Aspect Ratio",
    category: "Layout",
    description: "Fixed aspect ratio container",
    acceptsChildren: true,
    props: {
      ratio: {
        type: "string",
        label: "Ratio",
        defaultValue: "16/9",
        options: [
          { label: "16:9", value: "16/9" },
          { label: "4:3", value: "4/3" },
          { label: "1:1", value: "1/1" },
          { label: "21:9", value: "21/9" },
        ],
      },
    },
  },
  Accordion: {
    type: "Accordion",
    label: "Accordion",
    category: "Surfaces",
    description: "Collapsible content sections",
    acceptsChildren: true,
    props: {
      items: { type: "array", label: "Items (title|content per line)", defaultValue: ["Section 1|Content for section one", "Section 2|Content for section two", "Section 3|Content for section three"] },
      multiple: { type: "boolean", label: "Multiple Open", defaultValue: false },
    },
  },
  Popover: {
    type: "Popover",
    label: "Popover",
    category: "Surfaces",
    description: "Click-triggered floating panel",
    acceptsChildren: true,
    props: {
      trigger: { type: "string", label: "Trigger Label", defaultValue: "Open" },
    },
  },
  HoverCard: {
    type: "HoverCard",
    label: "Hover Card",
    category: "Surfaces",
    description: "Hover-triggered information card",
    acceptsChildren: true,
    props: {
      trigger: { type: "string", label: "Trigger Text", defaultValue: "Hover me" },
    },
  },

  // ── D2g: Media & Typography ───────────────────────────────────────

  Video: {
    type: "Video",
    label: "Video",
    category: "Media",
    description: "Video player element",
    acceptsChildren: false,
    props: {
      src: { type: "string", label: "Source URL", required: true },
      poster: { type: "string", label: "Poster Image" },
      controls: { type: "boolean", label: "Show Controls", defaultValue: true },
      autoplay: { type: "boolean", label: "Autoplay", defaultValue: false },
      loop: { type: "boolean", label: "Loop", defaultValue: false },
    },
  },
  Embed: {
    type: "Embed",
    label: "Embed",
    category: "Media",
    description: "Embedded iframe content",
    acceptsChildren: false,
    props: {
      src: { type: "string", label: "URL", required: true, defaultValue: "https://example.com" },
      title: { type: "string", label: "Title", defaultValue: "Embedded content" },
      height: { type: "string", label: "Height", defaultValue: "400px" },
    },
  },
  Blockquote: {
    type: "Blockquote",
    label: "Blockquote",
    category: "Media",
    description: "Block quotation",
    acceptsChildren: false,
    props: {
      text: { type: "string", label: "Quote Text", defaultValue: "The best way to predict the future is to invent it." },
      cite: { type: "string", label: "Citation", defaultValue: "Alan Kay" },
    },
  },
  Code: {
    type: "Code",
    label: "Code",
    category: "Media",
    description: "Code block with syntax highlighting",
    acceptsChildren: false,
    props: {
      code: { type: "string", label: "Code", defaultValue: "const hello = 'world';" },
      language: { type: "string", label: "Language", defaultValue: "typescript" },
      showLineNumbers: { type: "boolean", label: "Line Numbers", defaultValue: false },
    },
  },
  Carousel: {
    type: "Carousel",
    label: "Carousel",
    category: "Media",
    description: "Scrollable content carousel",
    acceptsChildren: true,
    props: {
      autoplay: { type: "boolean", label: "Autoplay", defaultValue: false },
      interval: { type: "number", label: "Interval (ms)", defaultValue: 3000 },
    },
  },
  Calendar: {
    type: "Calendar",
    label: "Calendar",
    category: "Media",
    description: "Date calendar display",
    acceptsChildren: false,
    props: {
      mode: {
        type: "string",
        label: "Mode",
        defaultValue: "single",
        options: [
          { label: "Single", value: "single" },
          { label: "Range", value: "range" },
        ],
      },
    },
  },
  Timeline: {
    type: "Timeline",
    label: "Timeline",
    category: "Media",
    description: "Vertical timeline of events",
    acceptsChildren: true,
    props: {
      items: { type: "array", label: "Items (title|description per line)", defaultValue: ["Step 1|First event happened", "Step 2|Second event happened", "Step 3|Third event happened"] },
    },
  },

  ComponentRef: {
    type: "ComponentRef",
    label: "Component Instance",
    category: "Components",
    description: "An instance of a reusable component definition with optional overrides",
    acceptsChildren: false,
    props: {
      ref: { type: "string", label: "Component ID", required: true },
    },
  },
};
