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
  p: "Text", span: "Text",
  img: "Image",
  input: "Input", textarea: "Input",
  a: "Link",
  button: "Button",
  hr: "Divider",
  ul: "List", ol: "List",
  nav: "Nav",
  section: "Section",
  form: "Form",
  table: "DataTable",
};

// Map shadcn/common component names
const COMPONENT_MAP: Record<string, string> = {
  Button: "Button",
  Card: "Card",
  Input: "Input",
  Separator: "Divider",
  ScrollArea: "ScrollArea",
  Tabs: "Tabs",
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
    if (componentType === "Button") {
      node.props = { label: text || getAttrValue(attrs, "children") || "Button" };
    }
    if (childNodes.length > 0) node.children = childNodes;
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
      default:
        if (childNodes.length > 0) node.children = childNodes;
    }

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
