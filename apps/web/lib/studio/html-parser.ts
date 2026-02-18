/**
 * HTML-to-ScreenSpec parser.
 * Parses plain HTML/CSS and maps elements to Studio node types.
 * Works entirely in the browser without any build-time dependencies.
 */

type StudioNode = {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: StudioNode[];
  style?: Record<string, unknown>;
};

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}_${++idCounter}`;
}

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
  header: "Section",
  footer: "Section",
  main: "Section",
  article: "Section",
  aside: "Sidebar",
};

function inferContainerType(el: Element): string {
  const style = el.getAttribute("style") || "";
  const cls = el.getAttribute("class") || "";
  const combined = `${style} ${cls}`;

  if (/display\s*:\s*grid|grid-template|\bgrid\b/.test(combined)) return "Grid";
  if (/display\s*:\s*flex|\bflex\b/.test(combined)) {
    if (/flex-direction\s*:\s*column|\bflex-col\b/.test(combined)) return "Stack:column";
    return "Stack:row";
  }
  return "Section";
}

function extractInlineStyles(el: Element): Record<string, unknown> {
  const style: Record<string, unknown> = {};
  const raw = el.getAttribute("style");
  if (!raw) return style;

  const camelCase = (s: string) =>
    s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

  const allowed = new Set([
    "fontSize", "fontWeight", "fontStyle", "lineHeight", "letterSpacing",
    "textAlign", "color", "backgroundColor", "width", "height",
    "minWidth", "maxWidth", "minHeight", "maxHeight",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "padding", "marginTop", "marginRight", "marginBottom", "marginLeft", "margin",
    "borderWidth", "borderColor", "borderStyle", "borderRadius",
    "opacity", "boxShadow", "overflow", "gap",
    "justifyContent", "alignItems", "flexWrap", "position",
    "top", "right", "bottom", "left", "zIndex",
  ]);

  for (const decl of raw.split(";")) {
    const [prop, ...valParts] = decl.split(":");
    if (!prop || valParts.length === 0) continue;
    const key = camelCase(prop.trim());
    const value = valParts.join(":").trim();
    if (allowed.has(key) && value) {
      style[key] = value;
    }
  }

  if (style.padding && typeof style.padding === "string") {
    const val = style.padding;
    style.paddingTop = val; style.paddingRight = val;
    style.paddingBottom = val; style.paddingLeft = val;
    delete style.padding;
  }
  if (style.margin && typeof style.margin === "string") {
    const val = style.margin;
    style.marginTop = val; style.marginRight = val;
    style.marginBottom = val; style.marginLeft = val;
    delete style.margin;
  }

  return style;
}

function convertElement(el: Element): StudioNode | null {
  const tag = el.tagName.toLowerCase();
  if (["script", "style", "link", "meta", "head", "title", "noscript"].includes(tag)) return null;

  const childNodes: StudioNode[] = [];
  for (const child of Array.from(el.children)) {
    const converted = convertElement(child);
    if (converted) childNodes.push(converted);
  }

  const textContent = Array.from(el.childNodes)
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent?.trim() || "")
    .filter(Boolean)
    .join(" ");

  const studioType = TAG_MAP[tag];
  const inlineStyle = extractInlineStyles(el);

  if (studioType) {
    const node: StudioNode = { id: nextId(studioType.toLowerCase()), type: studioType };

    switch (studioType) {
      case "Heading": {
        const level = parseInt(tag.replace("h", ""), 10);
        node.props = { text: textContent || "Heading", level: isNaN(level) ? 1 : level };
        break;
      }
      case "Text":
        node.props = { text: textContent || "Text" };
        break;
      case "Label":
        node.props = { text: textContent || "Label" };
        break;
      case "Image":
        node.props = { src: el.getAttribute("src") || "", alt: el.getAttribute("alt") || "" };
        break;
      case "Input":
        node.props = {
          type: el.getAttribute("type") || "text",
          placeholder: el.getAttribute("placeholder") || "",
        };
        break;
      case "Textarea":
        node.props = { placeholder: el.getAttribute("placeholder") || "" };
        break;
      case "Link":
        node.props = { href: el.getAttribute("href") || "#", text: textContent || el.getAttribute("href") || "Link" };
        break;
      case "Button":
        node.props = { label: textContent || "Button" };
        break;
      case "List":
        node.props = { ordered: tag === "ol" };
        if (childNodes.length > 0) node.children = childNodes;
        break;
      case "Form":
        if (childNodes.length > 0) node.children = childNodes;
        break;
      case "Video":
        node.props = { src: el.getAttribute("src") || "", controls: el.hasAttribute("controls") };
        break;
      case "Embed":
        node.props = { src: el.getAttribute("src") || "" };
        break;
      case "Blockquote":
        node.props = { text: textContent || "" };
        break;
      case "Code":
        node.props = { code: textContent || "" };
        break;
      case "Progress":
        node.props = { value: parseInt(el.getAttribute("value") || "50", 10) };
        break;
      default:
        if (childNodes.length > 0) node.children = childNodes;
    }

    if (Object.keys(inlineStyle).length > 0) node.style = inlineStyle;
    return node;
  }

  if (tag === "div" || tag === "span") {
    const inferred = inferContainerType(el);
    const [type, direction] = inferred.includes(":") ? inferred.split(":") : [inferred, undefined];
    const node: StudioNode = { id: nextId(type.toLowerCase()), type };
    const props: Record<string, unknown> = {};
    if (direction) props.direction = direction;
    if (Object.keys(props).length > 0) node.props = props;
    if (childNodes.length > 0) node.children = childNodes;
    if (Object.keys(inlineStyle).length > 0) node.style = inlineStyle;
    return node;
  }

  const node: StudioNode = {
    id: nextId("section"),
    type: "Section",
    children: childNodes.length > 0 ? childNodes : undefined,
  };
  if (Object.keys(inlineStyle).length > 0) node.style = inlineStyle;
  return node;
}

export function parseHTML(html: string): { spec: Record<string, unknown> } | { error: string } {
  idCounter = 0;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const body = doc.body;
    if (!body || body.children.length === 0) {
      return { error: "No content found in HTML" };
    }

    const children: StudioNode[] = [];
    for (const el of Array.from(body.children)) {
      const converted = convertElement(el);
      if (converted) children.push(converted);
    }

    let rootNode: StudioNode;
    if (children.length === 1) {
      rootNode = children[0];
      rootNode.id = "root";
    } else {
      rootNode = {
        id: "root",
        type: "Stack",
        props: { direction: "column", gap: "4" },
        children,
      };
    }

    return {
      spec: {
        version: 1,
        route: "/imported",
        meta: { layout: "default" },
        tree: rootNode,
      },
    };
  } catch (e) {
    return { error: `Parse error: ${e instanceof Error ? e.message : "unknown"}` };
  }
}
