/**
 * TSX-to-ScreenSpec parser (experimental).
 * Uses Babel to parse JSX AST and map HTML/shadcn elements to Studio node types.
 */

import { parse } from "@babel/parser";
import _traverse, { type NodePath } from "@babel/traverse";
import * as t from "@babel/types";

// Handle CJS/ESM interop for @babel/traverse
const traverse = (typeof _traverse === "function" ? _traverse : (_traverse as unknown as { default: typeof _traverse }).default) as typeof _traverse;

type StudioNode = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: StudioNode[];
};

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}_${++idCounter}`;
}

// Map HTML tags to Studio node types
const TAG_MAP: Record<string, string> = {
  h1: "Heading", h2: "Heading", h3: "Heading", h4: "Heading", h5: "Heading", h6: "Heading",
  p: "Text", span: "Text", label: "Label",
  img: "Image",
  input: "Input", textarea: "Textarea",
  select: "Select",
  a: "Link",
  button: "Button",
  hr: "Divider",
  ul: "List", ol: "List",
  nav: "Nav",
  section: "Section",
  form: "Form",
  table: "DataTable",
  video: "Video",
  iframe: "Embed",
  blockquote: "Blockquote",
  code: "Code", pre: "Code",
  dialog: "Dialog",
  details: "Accordion",
  progress: "Progress",
  svg: "SVG",
};

// Map shadcn/common component names (and common React library components)
const COMPONENT_MAP: Record<string, string> = {
  Button: "Button",
  Card: "Card",
  Input: "Input",
  Separator: "Divider",
  ScrollArea: "ScrollArea",
  Tabs: "Tabs",
  Avatar: "Avatar",
  Badge: "Badge",
  Checkbox: "Checkbox",
  Switch: "Switch",
  Slider: "Slider",
  Select: "Select",
  Textarea: "Textarea",
  RadioGroup: "RadioGroup",
  Alert: "Alert",
  AlertDialog: "Dialog",
  Dialog: "Dialog",
  Drawer: "Drawer",
  Sheet: "Sheet",
  Tooltip: "Tooltip",
  Popover: "Popover",
  HoverCard: "HoverCard",
  DropdownMenu: "DropdownMenu",
  Accordion: "Accordion",
  Breadcrumb: "Breadcrumb",
  Pagination: "Pagination",
  Progress: "Progress",
  Skeleton: "Skeleton",
  Spinner: "Spinner",
  Toast: "Toast",
  Carousel: "Carousel",
  Calendar: "Calendar",
  Label: "Label",
  Form: "Form",
  Modal: "Modal",
  Sidebar: "Sidebar",
  AppBar: "AppBar",
  Container: "Container",
  Box: "Box",
  Stack: "Stack",
  Grid: "Grid",
  Spacer: "Spacer",
  Icon: "Icon",
  Divider: "Divider",
  Nav: "Nav",
  DataTable: "DataTable",
};

function extractTextContent(node: t.JSXElement | t.JSXFragment): string {
  const texts: string[] = [];
  for (const child of node.children) {
    if (t.isJSXText(child)) {
      const trimmed = child.value.trim();
      if (trimmed) texts.push(trimmed);
    } else if (t.isJSXExpressionContainer(child) && t.isStringLiteral(child.expression)) {
      texts.push(child.expression.value);
    }
  }
  return texts.join(" ");
}

function getAttrValue(attrs: (t.JSXAttribute | t.JSXSpreadAttribute)[], name: string): string | undefined {
  for (const attr of attrs) {
    if (!t.isJSXAttribute(attr)) continue;
    if (t.isJSXIdentifier(attr.name) && attr.name.name === name) {
      if (t.isStringLiteral(attr.value)) return attr.value.value;
      if (t.isJSXExpressionContainer(attr.value) && t.isStringLiteral(attr.value.expression)) {
        return attr.value.expression.value;
      }
    }
  }
  return undefined;
}

function getClassName(attrs: (t.JSXAttribute | t.JSXSpreadAttribute)[]): string {
  return getAttrValue(attrs, "className") || getAttrValue(attrs, "class") || "";
}

function extractCommonProps(
  type: string,
  attrs: (t.JSXAttribute | t.JSXSpreadAttribute)[],
  text: string,
  children: StudioNode[],
): Record<string, unknown> {
  const props: Record<string, unknown> = {};

  switch (type) {
    case "Button":
      props.label = text || getAttrValue(attrs, "children") || "Button";
      props.variant = getAttrValue(attrs, "variant") || "default";
      break;
    case "Heading": {
      props.text = text || "Heading";
      const level = getAttrValue(attrs, "level");
      if (level) props.level = parseInt(level, 10);
      break;
    }
    case "Text":
      props.text = text || "Text";
      break;
    case "Input":
      props.placeholder = getAttrValue(attrs, "placeholder") || "";
      props.type = getAttrValue(attrs, "type") || "text";
      break;
    case "Image":
      props.src = getAttrValue(attrs, "src") || "";
      props.alt = getAttrValue(attrs, "alt") || "";
      break;
    case "Link":
      props.href = getAttrValue(attrs, "href") || "#";
      props.text = text || getAttrValue(attrs, "href") || "Link";
      break;
    case "Avatar":
      props.src = getAttrValue(attrs, "src") || "";
      props.fallback = getAttrValue(attrs, "fallback") || text || "A";
      break;
    case "Badge":
      props.text = text || getAttrValue(attrs, "children") || "Badge";
      props.variant = getAttrValue(attrs, "variant") || "default";
      break;
    case "Alert":
      props.title = getAttrValue(attrs, "title") || text || "Alert";
      break;
    case "Progress":
      props.value = parseInt(getAttrValue(attrs, "value") || "50", 10);
      break;
    case "Video":
      props.src = getAttrValue(attrs, "src") || "";
      props.controls = true;
      break;
    case "Embed":
      props.src = getAttrValue(attrs, "src") || "";
      break;
    case "Stack":
      props.direction = getAttrValue(attrs, "direction") || "column";
      break;
    case "Grid":
      props.columns = getAttrValue(attrs, "columns") || "3";
      break;
    default:
      break;
  }

  return props;
}

const TAILWIND_SPACING: Record<string, string> = {
  "0": "0", "1": "0.25rem", "2": "0.5rem", "3": "0.75rem", "4": "1rem",
  "5": "1.25rem", "6": "1.5rem", "8": "2rem", "10": "2.5rem", "12": "3rem",
  "16": "4rem", "20": "5rem", "24": "6rem",
};

function inferStyleFromTailwind(className: string): Record<string, unknown> {
  const style: Record<string, unknown> = {};
  if (!className) return style;

  const paddingMatch = className.match(/\bp-(\d+)\b/);
  if (paddingMatch && TAILWIND_SPACING[paddingMatch[1]]) {
    const val = TAILWIND_SPACING[paddingMatch[1]];
    style.paddingTop = val; style.paddingRight = val;
    style.paddingBottom = val; style.paddingLeft = val;
  }

  const pxMatch = className.match(/\bpx-(\d+)\b/);
  if (pxMatch && TAILWIND_SPACING[pxMatch[1]]) {
    style.paddingLeft = TAILWIND_SPACING[pxMatch[1]];
    style.paddingRight = TAILWIND_SPACING[pxMatch[1]];
  }
  const pyMatch = className.match(/\bpy-(\d+)\b/);
  if (pyMatch && TAILWIND_SPACING[pyMatch[1]]) {
    style.paddingTop = TAILWIND_SPACING[pyMatch[1]];
    style.paddingBottom = TAILWIND_SPACING[pyMatch[1]];
  }

  const marginMatch = className.match(/\bm-(\d+)\b/);
  if (marginMatch && TAILWIND_SPACING[marginMatch[1]]) {
    const val = TAILWIND_SPACING[marginMatch[1]];
    style.marginTop = val; style.marginRight = val;
    style.marginBottom = val; style.marginLeft = val;
  }

  const gapMatch = className.match(/\bgap-(\d+)\b/);
  if (gapMatch && TAILWIND_SPACING[gapMatch[1]]) {
    style.gap = TAILWIND_SPACING[gapMatch[1]];
  }

  const roundedMap: Record<string, string> = {
    "rounded-none": "0", "rounded-sm": "0.125rem", "rounded": "0.25rem",
    "rounded-md": "0.375rem", "rounded-lg": "0.5rem", "rounded-xl": "0.75rem",
    "rounded-2xl": "1rem", "rounded-full": "9999px",
  };
  for (const [cls, val] of Object.entries(roundedMap)) {
    if (className.includes(cls)) { style.borderRadius = val; break; }
  }

  if (/\btext-center\b/.test(className)) style.textAlign = "center";
  if (/\btext-right\b/.test(className)) style.textAlign = "right";
  if (/\btext-left\b/.test(className)) style.textAlign = "left";
  if (/\bfont-bold\b/.test(className)) style.fontWeight = "700";
  if (/\bfont-semibold\b/.test(className)) style.fontWeight = "600";
  if (/\bfont-medium\b/.test(className)) style.fontWeight = "500";
  if (/\bitalic\b/.test(className)) style.fontStyle = "italic";

  if (/\bw-full\b/.test(className)) style.width = "100%";
  if (/\bh-full\b/.test(className)) style.height = "100%";

  if (/\bjustify-center\b/.test(className)) style.justifyContent = "center";
  if (/\bjustify-between\b/.test(className)) style.justifyContent = "space-between";
  if (/\bitems-center\b/.test(className)) style.alignItems = "center";

  if (/\brelative\b/.test(className)) style.position = "relative";
  if (/\babsolute\b/.test(className)) style.position = "absolute";
  if (/\bfixed\b/.test(className)) style.position = "fixed";
  if (/\bsticky\b/.test(className)) style.position = "sticky";

  if (/\boverflow-hidden\b/.test(className)) style.overflow = "hidden";
  if (/\boverflow-auto\b/.test(className)) style.overflow = "auto";

  return style;
}

function inferDivType(className: string): string {
  if (/\bflex\b/.test(className) && /\bflex-col|flex-column\b/.test(className)) return "Stack:column";
  if (/\bflex\b/.test(className)) return "Stack:row";
  if (/\bgrid\b/.test(className)) return "Grid";
  return "Section";
}

function convertElement(element: t.JSXElement): StudioNode | null {
  const opening = element.openingElement;
  let tagName = "";

  if (t.isJSXIdentifier(opening.name)) {
    tagName = opening.name.name;
  } else if (t.isJSXMemberExpression(opening.name)) {
    tagName = opening.name.property.name;
  } else {
    return null;
  }

  const attrs = opening.attributes;
  const className = getClassName(attrs);
  const text = extractTextContent(element);

  // Process children recursively
  const childNodes: StudioNode[] = [];
  for (const child of element.children) {
    if (t.isJSXElement(child)) {
      const converted = convertElement(child);
      if (converted) childNodes.push(converted);
    } else if (t.isJSXFragment(child)) {
      for (const fragChild of child.children) {
        if (t.isJSXElement(fragChild)) {
          const converted = convertElement(fragChild);
          if (converted) childNodes.push(converted);
        }
      }
    } else if (t.isJSXExpressionContainer(child)) {
      if (t.isJSXElement(child.expression)) {
        const converted = convertElement(child.expression);
        if (converted) childNodes.push(converted);
      }
    }
  }

  // Check if it's a known component name
  const componentType = COMPONENT_MAP[tagName];
  if (componentType) {
    const node: StudioNode = { id: nextId(componentType.toLowerCase()), type: componentType };
    const extractedProps = extractCommonProps(componentType, attrs, text, childNodes);
    if (Object.keys(extractedProps).length > 0) node.props = extractedProps;
    if (childNodes.length > 0 && !["Button", "Text", "Heading"].includes(componentType)) {
      node.children = childNodes;
    }
    const style = inferStyleFromTailwind(className);
    if (Object.keys(style).length > 0) (node as StudioNode & { style: Record<string, unknown> }).style = style;
    return node;
  }

  // HTML tag mapping
  const studioType = TAG_MAP[tagName.toLowerCase()];

  if (studioType) {
    const node: StudioNode = { id: nextId(studioType.toLowerCase()), type: studioType };

    switch (studioType) {
      case "Heading": {
        const level = parseInt(tagName.replace("h", ""), 10);
        node.props = { text: text || "Heading", level: isNaN(level) ? 1 : level };
        break;
      }
      case "Text":
        node.props = { text: text || "Text" };
        break;
      case "Label":
        node.props = { text: text || "Label" };
        break;
      case "Image": {
        const src = getAttrValue(attrs, "src") || "";
        const alt = getAttrValue(attrs, "alt") || "";
        node.props = { src, alt };
        break;
      }
      case "Input": {
        const type = getAttrValue(attrs, "type") || "text";
        const placeholder = getAttrValue(attrs, "placeholder") || "";
        node.props = { type, placeholder };
        break;
      }
      case "Textarea":
        node.props = { placeholder: getAttrValue(attrs, "placeholder") || "" };
        break;
      case "Select":
        if (childNodes.length > 0) node.children = childNodes;
        break;
      case "Link": {
        const href = getAttrValue(attrs, "href") || "#";
        node.props = { href, text: text || href };
        break;
      }
      case "Button":
        node.props = { label: text || "Button" };
        break;
      case "List":
        node.props = { ordered: tagName === "ol" };
        if (childNodes.length > 0) node.children = childNodes;
        break;
      case "Form": {
        const action = getAttrValue(attrs, "action");
        if (action) node.props = { action };
        if (childNodes.length > 0) node.children = childNodes;
        break;
      }
      case "Video":
        node.props = { src: getAttrValue(attrs, "src") || "", controls: true };
        break;
      case "Embed":
        node.props = { src: getAttrValue(attrs, "src") || "" };
        break;
      case "Blockquote":
        node.props = { text: text || "" };
        break;
      case "Code":
        node.props = { code: text || "" };
        break;
      case "Progress":
        node.props = { value: parseInt(getAttrValue(attrs, "value") || "50", 10) };
        break;
      case "SVG":
        node.props = { viewBox: getAttrValue(attrs, "viewBox") || "0 0 24 24" };
        break;
      default:
        if (childNodes.length > 0) node.children = childNodes;
    }

    const style = inferStyleFromTailwind(className);
    if (Object.keys(style).length > 0) (node as StudioNode & { style: Record<string, unknown> }).style = style;

    return node;
  }

  // div or unknown element -- infer from className
  if (tagName === "div" || tagName === "main" || tagName === "article" || tagName === "aside" || tagName === "header" || tagName === "footer") {
    const inferred = inferDivType(className);
    const [type, direction] = inferred.includes(":") ? inferred.split(":") : [inferred, undefined];
    const node: StudioNode = { id: nextId(type.toLowerCase()), type };

    // Extract gap from tailwind classes like gap-4, gap-6
    const gapMatch = className.match(/\bgap-(\d+)\b/);
    const props: Record<string, unknown> = {};
    if (direction) props.direction = direction;
    if (gapMatch) props.gap = gapMatch[1];
    if (Object.keys(props).length > 0) node.props = props;
    if (childNodes.length > 0) node.children = childNodes;

    return node;
  }

  // Unknown component -- wrap in a Section
  const node: StudioNode = {
    id: nextId("section"),
    type: "Section",
    children: childNodes.length > 0 ? childNodes : undefined,
  };
  return node;
}

export function parseTSX(code: string): { spec: Record<string, unknown> } | { error: string } {
  idCounter = 0;

  let ast: t.File;
  try {
    ast = parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });
  } catch (e) {
    return { error: `Parse error: ${e instanceof Error ? e.message : "unknown"}` };
  }

  // Find the JSX returned from the default export or first function
  let rootJSX: t.JSXElement | t.JSXFragment | null = null;

  traverse(ast, {
    ReturnStatement(path: NodePath<t.ReturnStatement>) {
      const arg = path.node.argument;
      if (t.isJSXElement(arg) || t.isJSXFragment(arg)) {
        if (!rootJSX) rootJSX = arg;
      }
      // Handle parenthesized expression
      if (arg && t.isParenthesizedExpression(arg)) {
        const inner = arg.expression;
        if (t.isJSXElement(inner) || t.isJSXFragment(inner)) {
          if (!rootJSX) rootJSX = inner;
        }
      }
    },
  });

  const foundJSX = rootJSX;
  if (!foundJSX) {
    return { error: "No JSX return statement found in the code" };
  }

  let rootNode: StudioNode;

  if (t.isJSXFragment(foundJSX)) {
    const fragment = foundJSX as t.JSXFragment;
    const children: StudioNode[] = [];
    for (const child of fragment.children) {
      if (t.isJSXElement(child)) {
        const converted = convertElement(child);
        if (converted) children.push(converted);
      }
    }
    rootNode = {
      id: "root",
      type: "Stack",
      props: { direction: "column", gap: "4" },
      children,
    };
  } else {
    const element = foundJSX as t.JSXElement;
    const converted = convertElement(element);
    rootNode = converted || { id: "root", type: "Stack", props: { direction: "column" }, children: [] };
    rootNode.id = "root";
  }

  const spec = {
    version: 1,
    route: "/imported",
    meta: { layout: "default" },
    tree: rootNode,
  };

  return { spec };
}
