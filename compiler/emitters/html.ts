/**
 * Plain HTML/CSS emitter -- generates standalone .html files from screen specs.
 *
 * No framework dependencies. Files can be opened directly in a browser.
 * Uses inline styles for layout and a minimal embedded stylesheet.
 */

import type { Node, ScreenSpec } from "../types";
import type { StudioConfig } from "../config";
import type { Emitter, EmittedFile, EmitScreenResult } from "./types";

const GAP_MAP: Record<string, string> = {
  xs: "0.25rem", sm: "0.5rem", md: "1rem", lg: "1.5rem", xl: "2rem",
};
const SIZE_MAP: Record<string, string> = {
  xs: "0.5rem", sm: "1rem", md: "1.5rem", lg: "2rem", xl: "3rem",
};

const resolveGap = (gap?: unknown): string =>
  GAP_MAP[typeof gap === "string" ? gap : "md"] ?? GAP_MAP.md;

const resolveSize = (size?: unknown): string =>
  SIZE_MAP[typeof size === "string" ? size : "md"] ?? SIZE_MAP.md;

const escapeText = (value: unknown): string => {
  const str = typeof value === "string" ? value : String(value ?? "");
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
};

function componentNameFromRoute(route: string): string {
  if (route === "/") return "Home";
  return route.split("/").filter(Boolean).map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}

function emitNode(node: Node, indent: number = 4): string {
  const props = node.props ?? {};
  const type = node.type;
  const pad = " ".repeat(indent);

  switch (type) {
    case "Stack": {
      const gap = resolveGap(props.gap);
      const padding = props.padding ? `; padding: ${resolveSize(props.padding)}` : "";
      const direction = props.direction === "row" ? "row" : "column";
      const children = emitChildren(node.children ?? [], indent + 2);
      return `${pad}<div style="display: flex; flex-direction: ${direction}; gap: ${gap}${padding}">\n${children}\n${pad}</div>`;
    }

    case "Grid": {
      const columns = typeof props.columns === "number" ? props.columns : 2;
      const gap = resolveGap(props.gap);
      const children = emitChildren(node.children ?? [], indent + 2);
      return `${pad}<div style="display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: ${gap}">\n${children}\n${pad}</div>`;
    }

    case "Section": {
      const padding = props.padding ? ` style="padding: ${resolveSize(props.padding)}"` : "";
      const children = emitChildren(node.children ?? [], indent + 2);
      return `${pad}<section${padding}>\n${children}\n${pad}</section>`;
    }

    case "ScrollArea": {
      const height = typeof props.height === "string" ? props.height : "auto";
      const children = emitChildren(node.children ?? [], indent + 2);
      return `${pad}<div style="overflow: auto; height: ${height}">\n${children}\n${pad}</div>`;
    }

    case "Spacer": {
      const size = resolveSize(props.size);
      return `${pad}<div style="height: ${size}"></div>`;
    }

    case "Box": {
      const children = emitChildren(node.children ?? [], indent + 2);
      return `${pad}<div>\n${children}\n${pad}</div>`;
    }

    case "Container": {
      const mw = typeof props.maxWidth === "string" ? props.maxWidth : "lg";
      const MW: Record<string, string> = { sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px", full: "100%" };
      const padding = props.padding ? `; padding: ${resolveSize(props.padding)}` : "; padding: 0 1rem";
      const children = emitChildren(node.children ?? [], indent + 2);
      return `${pad}<div style="max-width: ${MW[mw] || "1024px"}; margin: 0 auto${padding}">\n${children}\n${pad}</div>`;
    }

    case "AspectRatio": {
      const arRatio = typeof props.ratio === "string" ? props.ratio : "16/9";
      const [w, h] = arRatio.split("/").map(Number);
      const pp = w && h ? (h / w) * 100 : 56.25;
      const children = emitChildren(node.children ?? [], indent + 4);
      return `${pad}<div style="position: relative; width: 100%; padding-top: ${pp}%">\n${pad}  <div style="position: absolute; inset: 0">\n${children}\n${pad}  </div>\n${pad}</div>`;
    }

    case "Heading": {
      const text = escapeText(props.text);
      const level = typeof props.level === "number" ? props.level : 1;
      const tag = `h${Math.min(Math.max(level, 1), 6)}`;
      return `${pad}<${tag}>${text}</${tag}>`;
    }

    case "Text": {
      const text = escapeText(props.text);
      if (props.variant === "muted") return `${pad}<p style="color: #6b7280; font-size: 0.875rem">${text}</p>`;
      return `${pad}<p>${text}</p>`;
    }

    case "Image": {
      const src = escapeText(props.src);
      const alt = escapeText(props.alt);
      const attrs = [`src="${src}"`, `alt="${alt}"`];
      if (typeof props.width === "number") attrs.push(`width="${props.width}"`);
      if (typeof props.height === "number") attrs.push(`height="${props.height}"`);
      return `${pad}<img ${attrs.join(" ")} />`;
    }

    case "Input": {
      const attrs: string[] = [];
      if (typeof props.type === "string") attrs.push(`type="${props.type}"`);
      if (typeof props.placeholder === "string") attrs.push(`placeholder="${escapeText(props.placeholder)}"`);
      const attrStr = attrs.length > 0 ? " " + attrs.join(" ") : "";
      if (typeof props.label === "string" && props.label) {
        return `${pad}<div>\n${pad}  <label>${escapeText(props.label)}</label><br>\n${pad}  <input${attrStr} />\n${pad}</div>`;
      }
      return `${pad}<input${attrStr} />`;
    }

    case "Link": {
      const href = typeof props.href === "string" ? props.href : "#";
      const text = typeof props.text === "string" ? escapeText(props.text) : href;
      return `${pad}<a href="${href}">${text}</a>`;
    }

    case "Divider":
      return `${pad}<hr />`;

    case "List": {
      const items = Array.isArray(props.items) ? props.items : [];
      const ordered = props.ordered === true;
      const tag = ordered ? "ol" : "ul";
      const lis = items.map((item) => `${pad}  <li>${escapeText(item)}</li>`).join("\n");
      return `${pad}<${tag}>\n${lis}\n${pad}</${tag}>`;
    }

    case "Icon":
      return `${pad}<span>${escapeText(typeof props.name === "string" ? props.name : "★")}</span>`;

    case "SVG": {
      const svgCode = typeof props.code === "string" ? props.code : "";
      const svgW = typeof props.width === "number" ? props.width : 24;
      const svgH = typeof props.height === "number" ? props.height : 24;
      return `${pad}<div style="width: ${svgW}px; height: ${svgH}px">\n${pad}  ${svgCode}\n${pad}</div>`;
    }

    case "Card": {
      const padding = props.padding ? resolveSize(props.padding) : "1rem";
      const children = emitChildren(node.children ?? [], indent + 2);
      return `${pad}<div style="padding: ${padding}; border: 1px solid #e5e7eb; border-radius: 0.5rem; box-shadow: 0 1px 3px rgb(0 0 0 / 0.1)">\n${children}\n${pad}</div>`;
    }

    case "Button": {
      const label = escapeText(props.label ?? "Button");
      const intent = typeof props.intent === "string" ? props.intent : "primary";
      const bg = intent === "destructive" ? "#ef4444" : intent === "secondary" ? "#f4f4f5" : intent === "outline" || intent === "ghost" ? "transparent" : "#18181b";
      const color = intent === "secondary" ? "#18181b" : intent === "outline" || intent === "ghost" ? "#18181b" : "#fff";
      const border = intent === "outline" ? "1px solid #e5e7eb" : "none";
      return `${pad}<button style="padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; background: ${bg}; color: ${color}; border: ${border}; cursor: pointer">${label}</button>`;
    }

    case "Form": {
      const formAttrs: string[] = [];
      if (typeof props.action === "string") formAttrs.push(`action="${escapeText(props.action)}"`);
      if (typeof props.method === "string") formAttrs.push(`method="${props.method}"`);
      const attrStr = formAttrs.length > 0 ? " " + formAttrs.join(" ") : "";
      const children = emitChildren(node.children ?? [], indent + 2);
      return `${pad}<form${attrStr} style="display: flex; flex-direction: column; gap: 1rem">\n${children}\n${pad}</form>`;
    }

    case "Textarea": {
      const ph = typeof props.placeholder === "string" ? ` placeholder="${escapeText(props.placeholder)}"` : "";
      const rows = typeof props.rows === "number" ? ` rows="${props.rows}"` : "";
      const label = typeof props.label === "string" ? props.label : undefined;
      const el = `<textarea${ph}${rows} style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem"></textarea>`;
      if (label) return `${pad}<div>\n${pad}  <label>${escapeText(label)}</label><br>\n${pad}  ${el}\n${pad}</div>`;
      return `${pad}${el}`;
    }

    case "Select": {
      const selOpts = Array.isArray(props.options) ? props.options : [];
      const ph = typeof props.placeholder === "string" ? props.placeholder : "Choose...";
      const label = typeof props.label === "string" ? props.label : undefined;
      const options = selOpts.map((opt) => {
        const s = String(opt);
        const [val, lab] = s.includes("|") ? s.split("|") : [s, s];
        return `${pad}    <option value="${escapeText(val)}">${escapeText(lab)}</option>`;
      }).join("\n");
      const el = `<select style="width: 100%; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem">\n${pad}    <option value="" disabled>${escapeText(ph)}</option>\n${options}\n${pad}  </select>`;
      if (label) return `${pad}<div>\n${pad}  <label>${escapeText(label)}</label><br>\n${pad}  ${el}\n${pad}</div>`;
      return `${pad}${el}`;
    }

    case "Checkbox": {
      const cbLabel = typeof props.label === "string" ? escapeText(props.label) : "Checkbox";
      return `${pad}<label style="display:flex;align-items:center;gap:0.5rem"><input type="checkbox"${props.checked ? " checked" : ""} /> ${cbLabel}</label>`;
    }

    case "RadioGroup": {
      const rgOpts = Array.isArray(props.options) ? props.options : [];
      const rgDefault = typeof props.defaultValue === "string" ? props.defaultValue : "";
      const rgLabel = typeof props.label === "string" ? props.label : undefined;
      const radios = rgOpts.map((opt) => {
        const s = String(opt);
        const [val, lab] = s.includes("|") ? s.split("|") : [s, s];
        return `${pad}  <label style="display:flex;align-items:center;gap:0.5rem"><input type="radio" name="${node.id}" value="${escapeText(val)}"${val === rgDefault ? " checked" : ""} /> ${escapeText(lab)}</label>`;
      }).join("\n");
      const legend = rgLabel ? `${pad}  <legend>${escapeText(rgLabel)}</legend>\n` : "";
      return `${pad}<fieldset style="display:flex;flex-direction:column;gap:0.5rem;border:none;padding:0">\n${legend}${radios}\n${pad}</fieldset>`;
    }

    case "Switch": {
      const swLabel = typeof props.label === "string" ? escapeText(props.label) : "Toggle";
      return `${pad}<label style="display:flex;align-items:center;gap:0.75rem"><input type="checkbox" role="switch"${props.checked ? " checked" : ""} /> ${swLabel}</label>`;
    }

    case "Slider": {
      const slMin = typeof props.min === "number" ? props.min : 0;
      const slMax = typeof props.max === "number" ? props.max : 100;
      const slDefault = typeof props.defaultValue === "number" ? props.defaultValue : 50;
      const slLabel = typeof props.label === "string" ? props.label : undefined;
      const el = `<input type="range" min="${slMin}" max="${slMax}" value="${slDefault}" style="width:100%" />`;
      if (slLabel) return `${pad}<div>\n${pad}  <label>${escapeText(slLabel)}</label><br>\n${pad}  ${el}\n${pad}</div>`;
      return `${pad}${el}`;
    }

    case "Label":
      return `${pad}<label>${escapeText(typeof props.text === "string" ? props.text : "Label")}</label>`;

    case "FileUpload": {
      const fuLabel = typeof props.label === "string" ? escapeText(props.label) : "Drop files here or click to upload";
      return `${pad}<label style="display:flex;flex-direction:column;align-items:center;gap:0.5rem;border:2px dashed #d1d5db;border-radius:0.5rem;padding:1.5rem;text-align:center;cursor:pointer">\n${pad}  <span>${fuLabel}</span>\n${pad}  <input type="file" style="display:none" />\n${pad}</label>`;
    }

    case "Avatar": {
      const avSrc = typeof props.src === "string" ? props.src : "";
      const avFallback = typeof props.fallback === "string" ? escapeText(props.fallback) : "AB";
      const avSize = typeof props.size === "number" ? props.size : 40;
      if (avSrc) return `${pad}<img src="${escapeText(avSrc)}" alt="${avFallback}" style="width:${avSize}px;height:${avSize}px;border-radius:50%;object-fit:cover" />`;
      return `${pad}<div style="width:${avSize}px;height:${avSize}px;border-radius:50%;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:500">${avFallback}</div>`;
    }

    case "Badge": {
      const bdText = typeof props.text === "string" ? escapeText(props.text) : "Badge";
      return `${pad}<span style="display:inline-flex;align-items:center;border-radius:9999px;padding:0.125rem 0.625rem;font-size:0.75rem;font-weight:600;background:#18181b;color:#fff">${bdText}</span>`;
    }

    case "Progress": {
      const prValue = typeof props.value === "number" ? props.value : 60;
      const prMax = typeof props.max === "number" ? props.max : 100;
      return `${pad}<progress value="${prValue}" max="${prMax}" style="width:100%"></progress>`;
    }

    case "Alert": {
      const alTitle = typeof props.title === "string" ? escapeText(props.title) : "Alert";
      const alDesc = typeof props.description === "string" ? escapeText(props.description) : "";
      const children = emitChildren(node.children ?? [], indent + 2);
      return `${pad}<div role="alert" style="border:1px solid #e5e7eb;border-radius:0.5rem;padding:1rem">\n${pad}  <strong>${alTitle}</strong>${alDesc ? `\n${pad}  <p style="margin-top:0.25rem;opacity:0.8">${alDesc}</p>` : ""}${children ? `\n${children}` : ""}\n${pad}</div>`;
    }

    case "Spinner":
      return `${pad}<div role="status" style="width:${typeof props.size === "number" ? props.size : 24}px;height:${typeof props.size === "number" ? props.size : 24}px;border:3px solid #e5e7eb;border-top:3px solid #18181b;border-radius:50%;animation:spin 1s linear infinite"></div>`;

    case "Dialog": {
      const dlTitle = typeof props.title === "string" ? escapeText(props.title) : "Dialog";
      const children = emitChildren(node.children ?? [], indent + 4);
      return `${pad}<dialog open style="border:1px solid #e5e7eb;border-radius:0.5rem;max-width:28rem;box-shadow:0 25px 50px -12px rgb(0 0 0 / 0.25)">\n${pad}  <div style="padding:1.5rem">\n${pad}    <h3 style="margin:0 0 0.5rem">${dlTitle}</h3>\n${children}\n${pad}  </div>\n${pad}</dialog>`;
    }

    case "Breadcrumb": {
      const bcItems = Array.isArray(props.items) ? props.items : [];
      const bcSep = typeof props.separator === "string" ? props.separator : "/";
      const items = bcItems.map((item, i) => {
        const s = String(item);
        const [label, href] = s.includes("|") ? s.split("|") : [s, ""];
        const sep = i > 0 ? ` <span style="margin:0 0.25rem">${escapeText(bcSep)}</span> ` : "";
        if (i === bcItems.length - 1 || !href) return `${sep}<span>${escapeText(label)}</span>`;
        return `${sep}<a href="${href}">${escapeText(label)}</a>`;
      }).join("");
      return `${pad}<nav>${items}</nav>`;
    }

    case "Blockquote": {
      const bqText = typeof props.text === "string" ? escapeText(props.text) : "";
      const bqCite = typeof props.cite === "string" ? escapeText(props.cite) : "";
      return `${pad}<blockquote style="border-left:4px solid #d1d5db;padding-left:1rem;font-style:italic;color:#6b7280">\n${pad}  <p>${bqText}</p>${bqCite ? `\n${pad}  <footer style="font-style:normal;font-size:0.875rem;color:#9ca3af">— ${bqCite}</footer>` : ""}\n${pad}</blockquote>`;
    }

    case "Code": {
      const cdCode = typeof props.code === "string" ? escapeText(props.code) : "";
      return `${pad}<pre style="background:#18181b;color:#f4f4f5;padding:1rem;border-radius:0.5rem;overflow-x:auto"><code>${cdCode}</code></pre>`;
    }

    case "Video": {
      const viSrc = typeof props.src === "string" ? props.src : "";
      if (!viSrc) return `${pad}<div style="height:12rem;background:#f4f4f5;display:flex;align-items:center;justify-content:center">Video (set src)</div>`;
      const attrs = [`src="${escapeText(viSrc)}"`, typeof props.poster === "string" ? `poster="${escapeText(props.poster)}"` : "", props.controls !== false ? "controls" : ""].filter(Boolean).join(" ");
      return `${pad}<video ${attrs} style="width:100%;border-radius:0.5rem"></video>`;
    }

    case "Embed": {
      const emSrc = typeof props.src === "string" ? props.src : "";
      const emTitle = typeof props.title === "string" ? escapeText(props.title) : "Embedded content";
      const emHeight = typeof props.height === "string" ? props.height : "400px";
      if (!emSrc) return `${pad}<div style="height:${emHeight};background:#f4f4f5;display:flex;align-items:center;justify-content:center">Embed (set URL)</div>`;
      return `${pad}<iframe src="${escapeText(emSrc)}" title="${emTitle}" style="width:100%;height:${emHeight};border:1px solid #e5e7eb;border-radius:0.5rem"></iframe>`;
    }

    case "Accordion": {
      const acItems = Array.isArray(props.items) ? props.items : [];
      const items = acItems.map((item, i) => {
        const s = String(item);
        const [title, body] = s.includes("|") ? s.split("|") : [s, ""];
        return `${pad}  <details${i === 0 ? " open" : ""}>\n${pad}    <summary style="cursor:pointer;padding:0.75rem 1rem;font-weight:500">${escapeText(title)}</summary>\n${pad}    <div style="padding:0 1rem 0.75rem;color:#6b7280">${escapeText(body)}</div>\n${pad}  </details>`;
      }).join("\n");
      return `${pad}<div style="border:1px solid #e5e7eb;border-radius:0.5rem">\n${items}\n${pad}</div>`;
    }

    case "Timeline": {
      const tlItems = Array.isArray(props.items) ? props.items : [];
      const items = tlItems.map((item) => {
        const s = String(item);
        const [title, desc] = s.includes("|") ? s.split("|") : [s, ""];
        return `${pad}  <div style="position:relative;padding-bottom:1rem;padding-left:1.5rem">\n${pad}    <div style="position:absolute;left:0;top:0.25rem;width:0.75rem;height:0.75rem;border-radius:50%;border:2px solid #2563eb;background:#fff"></div>\n${pad}    <div style="font-weight:500">${escapeText(title)}</div>${desc ? `\n${pad}    <div style="color:#6b7280;margin-top:0.25rem">${escapeText(desc)}</div>` : ""}\n${pad}  </div>`;
      }).join("\n");
      return `${pad}<div style="position:relative;padding-left:1.5rem">\n${pad}  <div style="position:absolute;left:0.3rem;top:0;bottom:0;width:1px;background:#e5e7eb"></div>\n${items}\n${pad}</div>`;
    }

    default: {
      const propEntries = Object.entries(props);
      const attrStr = propEntries.map(([key, value]) => {
        if (typeof value === "string") return `data-${key}="${escapeText(value)}"`;
        return `data-${key}="${escapeText(JSON.stringify(value))}"`;
      }).join(" ");
      const attrs = attrStr ? ` ${attrStr}` : "";
      if (node.children && node.children.length > 0) {
        const children = emitChildren(node.children, indent + 2);
        return `${pad}<div data-component="${type}"${attrs}>\n${children}\n${pad}</div>`;
      }
      return `${pad}<div data-component="${type}"${attrs}></div>`;
    }
  }
}

function emitChildren(nodes: Node[], indent: number): string {
  return nodes.map((node) => emitNode(node, indent)).join("\n");
}

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; color: #18181b; }
  a { color: #2563eb; }
  button { font-family: inherit; }
  @keyframes spin { to { transform: rotate(360deg); } }
`.trim();

function emitScreen(spec: ScreenSpec, config: StudioConfig): EmitScreenResult {
  const componentName = componentNameFromRoute(spec.route);
  const generatedPath = `${config.generatedDir}/${componentName}.generated.html`;

  const body = emitNode(spec.tree, 4);

  const contents = `<!DOCTYPE html>
<!-- AUTO-GENERATED by studio compiler. Do not edit directly. -->
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${componentName}</title>
  <style>
    ${BASE_CSS}
  </style>
</head>
<body>
  <div id="app">
${body}
  </div>
</body>
</html>
`;

  return {
    files: [{ path: generatedPath, contents }],
    componentName,
  };
}

function emitBarrelIndex(componentNames: string[], config: StudioConfig): EmittedFile {
  const links = componentNames
    .sort()
    .map((name) => `  <li><a href="./${name}.generated.html">${name}</a></li>`)
    .join("\n");

  return {
    path: `${config.generatedDir}/index.html`,
    contents: `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8" /><title>Studio Pages</title></head>\n<body>\n<h1>Generated Pages</h1>\n<ul>\n${links}\n</ul>\n</body>\n</html>\n`,
  };
}

export const htmlEmitter: Emitter = {
  name: "html",
  emitScreen,
  emitBarrelIndex,
};
