/**
 * Figma JSON to Studio ScreenSpec parser.
 * Maps Figma node tree to Studio node types using auto-layout heuristics.
 */

type FigmaNode = {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  layoutMode?: "HORIZONTAL" | "VERTICAL" | "NONE";
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  characters?: string;
  style?: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: number;
  };
  fills?: Array<{ type: string; imageRef?: string; color?: { r: number; g: number; b: number; a?: number } }>;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
};

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

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function spacingToToken(px: number): string {
  if (px <= 2) return "1";
  if (px <= 6) return "2";
  if (px <= 12) return "3";
  if (px <= 20) return "4";
  if (px <= 32) return "6";
  return "8";
}

function convertNode(figma: FigmaNode): StudioNode | null {
  switch (figma.type) {
    case "FRAME":
    case "GROUP":
    case "COMPONENT":
    case "COMPONENT_SET":
    case "INSTANCE": {
      // Determine layout type
      if (figma.layoutMode === "VERTICAL" || figma.layoutMode === "HORIZONTAL") {
        const direction = figma.layoutMode === "VERTICAL" ? "column" : "row";
        const gap = figma.itemSpacing ? spacingToToken(figma.itemSpacing) : "4";
        const children = (figma.children || [])
          .map(convertNode)
          .filter(Boolean) as StudioNode[];

        // Heuristic: if it looks like a card (small, has border/fill)
        if (figma.type === "COMPONENT" || figma.type === "INSTANCE") {
          const lowerName = figma.name.toLowerCase();
          if (lowerName.includes("card")) {
            return {
              id: nextId("card"),
              type: "Card",
              children: children.length > 0 ? children : undefined,
            };
          }
          if (lowerName.includes("button") || lowerName.includes("btn")) {
            const text = extractDeepText(figma);
            return {
              id: nextId("button"),
              type: "Button",
              props: { label: text || figma.name },
            };
          }
          if (lowerName.includes("input") || lowerName.includes("field")) {
            return {
              id: nextId("input"),
              type: "Input",
              props: { placeholder: figma.name },
            };
          }
          if (lowerName.includes("nav") || lowerName.includes("header")) {
            return {
              id: nextId("nav"),
              type: "Nav",
              children: children.length > 0 ? children : undefined,
            };
          }
        }

        return {
          id: nextId("stack"),
          type: "Stack",
          props: { direction, gap },
          children: children.length > 0 ? children : undefined,
        };
      }

      // No auto-layout -- treat as Section
      const children = (figma.children || [])
        .map(convertNode)
        .filter(Boolean) as StudioNode[];
      return {
        id: nextId("section"),
        type: "Section",
        children: children.length > 0 ? children : undefined,
      };
    }

    case "TEXT": {
      const text = figma.characters || figma.name || "";
      const fontSize = figma.style?.fontSize || 16;

      // Heading heuristic: font size >= 20
      if (fontSize >= 20) {
        const level = fontSize >= 36 ? 1 : fontSize >= 28 ? 2 : fontSize >= 22 ? 3 : 4;
        return {
          id: nextId("heading"),
          type: "Heading",
          props: { text, level },
        };
      }

      return {
        id: nextId("text"),
        type: "Text",
        props: { text },
      };
    }

    case "RECTANGLE":
    case "ELLIPSE": {
      // Check for image fill
      const imageFill = figma.fills?.find((f) => f.type === "IMAGE");
      if (imageFill) {
        return {
          id: nextId("image"),
          type: "Image",
          props: { src: "", alt: figma.name || "image" },
        };
      }
      // Otherwise treat as a divider/spacer
      return {
        id: nextId("divider"),
        type: "Divider",
      };
    }

    case "LINE":
    case "VECTOR":
      return { id: nextId("divider"), type: "Divider" };

    default:
      return null;
  }
}

function extractDeepText(node: FigmaNode): string {
  if (node.type === "TEXT") return node.characters || "";
  if (node.children) {
    for (const child of node.children) {
      const text = extractDeepText(child);
      if (text) return text;
    }
  }
  return "";
}

export function extractFileKey(url: string): string | null {
  // https://www.figma.com/file/XXXXX/... or https://www.figma.com/design/XXXXX/...
  const match = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

export async function fetchFigmaFile(
  fileKey: string,
  accessToken: string
): Promise<FigmaNode> {
  const res = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
    headers: { "X-Figma-Token": accessToken },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Figma API error (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.document as FigmaNode;
}

export function listTopFrames(document: FigmaNode): Array<{ id: string; name: string }> {
  const frames: Array<{ id: string; name: string }> = [];
  // Figma document has pages as direct children
  for (const page of document.children || []) {
    for (const child of page.children || []) {
      if (child.type === "FRAME" || child.type === "COMPONENT" || child.type === "COMPONENT_SET") {
        frames.push({ id: child.id, name: child.name });
      }
    }
  }
  return frames;
}

export function figmaToSpec(
  document: FigmaNode,
  nodeId?: string
): Record<string, unknown> {
  idCounter = 0;

  let targetNode: FigmaNode | null = null;

  if (nodeId) {
    targetNode = findNode(document, nodeId);
  }

  if (!targetNode) {
    // Use the first page's children
    const firstPage = document.children?.[0];
    if (!firstPage || !firstPage.children?.length) {
      throw new Error("No frames found in the Figma file");
    }
    // Wrap all top-level frames in a root stack
    const children = firstPage.children
      .map(convertNode)
      .filter(Boolean) as StudioNode[];

    return {
      version: 1,
      route: "/figma-import",
      meta: { layout: "default" },
      tree: {
        id: "root",
        type: "Stack",
        props: { direction: "column", gap: "6" },
        children,
      },
    };
  }

  const converted = convertNode(targetNode);
  const rootNode = converted || {
    id: "root",
    type: "Section",
    children: [],
  };
  rootNode.id = "root";

  const routeName = targetNode.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    version: 1,
    route: `/${routeName || "figma-import"}`,
    meta: { layout: "default" },
    tree: rootNode,
  };
}

function findNode(root: FigmaNode, id: string): FigmaNode | null {
  if (root.id === id) return root;
  for (const child of root.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}
