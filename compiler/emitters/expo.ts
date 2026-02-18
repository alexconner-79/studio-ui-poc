/**
 * Expo / React Native emitter.
 *
 * Generates .tsx files that use React Native primitives (View, Text, Image, etc.)
 * and StyleSheet.create() for styling. Compatible with Expo and bare React Native.
 */

import type { Emitter, EmitScreenResult, EmittedFile } from "./types";
import type { ScreenSpec, Node, NodeStyle, StyleValue } from "../types";
import type { StudioConfig } from "../config";
import { resolveStyleValue } from "../resolve-token";
import { loadTokens, type DesignTokens } from "../tokens";

// ---------------------------------------------------------------------------
// Token loading
// ---------------------------------------------------------------------------

let _designTokens: DesignTokens | null = null;

function ensureTokens(config: StudioConfig) {
  if (!_designTokens) {
    _designTokens = loadTokens(config.tokens ?? "tokens/design-tokens.json");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function componentNameFromRoute(route: string): string {
  if (route === "/") return "Home";
  const segments = route.split("/").filter(Boolean);
  return segments.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
}

function indentLines(code: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.length > 0 ? `${pad}${line}` : line))
    .join("\n");
}

// ---------------------------------------------------------------------------
// Style emission: NodeStyle -> React Native StyleSheet properties
// ---------------------------------------------------------------------------

function nodeStyleToRN(style: NodeStyle | undefined): Record<string, string | number> {
  if (!style) return {};
  const result: Record<string, string | number> = {};

  const r = (v: StyleValue | undefined): string | number | undefined => {
    return resolveStyleValue(v, _designTokens) as string | number | undefined;
  };

  // Typography
  if (style.fontSize !== undefined) result.fontSize = r(style.fontSize) as number;
  if (style.fontWeight !== undefined) result.fontWeight = String(r(style.fontWeight) ?? "normal");
  if (style.fontStyle !== undefined) result.fontStyle = style.fontStyle;
  if (style.lineHeight !== undefined) result.lineHeight = r(style.lineHeight) as number;
  if (style.letterSpacing !== undefined) result.letterSpacing = r(style.letterSpacing) as number;
  if (style.wordSpacing !== undefined) (result as Record<string, unknown>).wordSpacing = r(style.wordSpacing);
  if (style.textAlign !== undefined) result.textAlign = style.textAlign;
  if (style.textDecoration !== undefined) {
    // Map CSS textDecoration to RN textDecorationLine
    const map: Record<string, string> = { underline: "underline", "line-through": "line-through", none: "none" };
    result.textDecorationLine = map[style.textDecoration] ?? "none";
  }
  if (style.textTransform !== undefined) result.textTransform = style.textTransform;
  if (style.color !== undefined) result.color = String(r(style.color) ?? "");

  // Sizing
  if (style.width !== undefined) result.width = r(style.width) as string | number;
  if (style.height !== undefined) result.height = r(style.height) as string | number;
  if (style.minWidth !== undefined) result.minWidth = r(style.minWidth) as string | number;
  if (style.maxWidth !== undefined) result.maxWidth = r(style.maxWidth) as string | number;
  if (style.minHeight !== undefined) result.minHeight = r(style.minHeight) as string | number;
  if (style.maxHeight !== undefined) result.maxHeight = r(style.maxHeight) as string | number;

  // Spacing
  if (style.paddingTop !== undefined) result.paddingTop = r(style.paddingTop) as string | number;
  if (style.paddingRight !== undefined) result.paddingRight = r(style.paddingRight) as string | number;
  if (style.paddingBottom !== undefined) result.paddingBottom = r(style.paddingBottom) as string | number;
  if (style.paddingLeft !== undefined) result.paddingLeft = r(style.paddingLeft) as string | number;
  if (style.marginTop !== undefined) result.marginTop = r(style.marginTop) as string | number;
  if (style.marginRight !== undefined) result.marginRight = r(style.marginRight) as string | number;
  if (style.marginBottom !== undefined) result.marginBottom = r(style.marginBottom) as string | number;
  if (style.marginLeft !== undefined) result.marginLeft = r(style.marginLeft) as string | number;

  // Background
  if (style.backgroundColor !== undefined) result.backgroundColor = String(r(style.backgroundColor) ?? "");

  // Border
  if (style.borderWidth !== undefined) result.borderWidth = r(style.borderWidth) as number;
  if (style.borderColor !== undefined) result.borderColor = String(r(style.borderColor) ?? "");
  if (style.borderStyle !== undefined) result.borderStyle = style.borderStyle;
  if (style.borderRadius !== undefined) result.borderRadius = r(style.borderRadius) as number;
  if (style.borderTopLeftRadius !== undefined) result.borderTopLeftRadius = r(style.borderTopLeftRadius) as number;
  if (style.borderTopRightRadius !== undefined) result.borderTopRightRadius = r(style.borderTopRightRadius) as number;
  if (style.borderBottomLeftRadius !== undefined) result.borderBottomLeftRadius = r(style.borderBottomLeftRadius) as number;
  if (style.borderBottomRightRadius !== undefined) result.borderBottomRightRadius = r(style.borderBottomRightRadius) as number;

  // Effects
  if (style.opacity !== undefined) result.opacity = style.opacity;

  // Layout
  if (style.overflow !== undefined) result.overflow = style.overflow;
  if (style.justifyContent !== undefined) result.justifyContent = style.justifyContent;
  if (style.alignItems !== undefined) result.alignItems = style.alignItems;
  if (style.flexWrap !== undefined) result.flexWrap = style.flexWrap;
  if (style.gap !== undefined) result.gap = r(style.gap) as number;
  if (style.flexGrow !== undefined) result.flexGrow = style.flexGrow;
  if (style.flexShrink !== undefined) result.flexShrink = style.flexShrink;
  if (style.alignSelf !== undefined) result.alignSelf = style.alignSelf;

  // Position
  if (style.position !== undefined) result.position = style.position;
  if (style.top !== undefined) result.top = r(style.top) as string | number;
  if (style.right !== undefined) result.right = r(style.right) as string | number;
  if (style.bottom !== undefined) result.bottom = r(style.bottom) as string | number;
  if (style.left !== undefined) result.left = r(style.left) as string | number;
  if (style.zIndex !== undefined) result.zIndex = style.zIndex;

  return result;
}

function formatStyleObj(obj: Record<string, string | number>): string {
  if (Object.keys(obj).length === 0) return "{}";
  const entries = Object.entries(obj)
    .map(([k, v]) => `${k}: ${typeof v === "number" ? v : JSON.stringify(v)}`)
    .join(", ");
  return `{ ${entries} }`;
}

// ---------------------------------------------------------------------------
// Gap / size maps (RN uses numeric values)
// ---------------------------------------------------------------------------

const GAP_MAP: Record<string, number> = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const SIZE_MAP: Record<string, number> = { xs: 12, sm: 16, md: 24, lg: 32, xl: 48 };

function resolveGapRN(gap?: unknown): number {
  if (typeof gap === "number") return gap;
  if (typeof gap === "string") return GAP_MAP[gap] ?? GAP_MAP.md ?? 16;
  return GAP_MAP.md ?? 16;
}

function resolveSizeRN(size?: unknown): number {
  if (typeof size === "number") return size;
  if (typeof size === "string") return SIZE_MAP[size] ?? SIZE_MAP.md ?? 24;
  return SIZE_MAP.md ?? 24;
}

// ---------------------------------------------------------------------------
// Imports tracking
// ---------------------------------------------------------------------------

type EmitResult = { jsx: string; imports: Set<string> };

// ---------------------------------------------------------------------------
// Node emission
// ---------------------------------------------------------------------------

function emitChildren(children: Node[]): EmitResult {
  const imports = new Set<string>();
  const parts: string[] = [];
  for (const child of children) {
    const result = emitNode(child);
    result.imports.forEach((i) => imports.add(i));
    parts.push(result.jsx);
  }
  return { jsx: parts.join("\n"), imports };
}

function emitNode(node: Node): EmitResult {
  const props = node.props ?? {};
  const type = node.type;
  const imports = new Set<string>();

  const styleObj = nodeStyleToRN(node.style);
  const hasStyle = Object.keys(styleObj).length > 0;

  let jsx: string;

  switch (type) {
    case "Stack": {
      imports.add("View");
      const gap = resolveGapRN(props.gap);
      const padding = props.padding ? resolveSizeRN(props.padding) : 0;
      const direction = props.direction === "row" ? "row" : "column";
      const children = emitChildren(node.children ?? []);
      children.imports.forEach((i) => imports.add(i));
      const style = `{ flexDirection: "${direction}", gap: ${gap}${padding ? `, padding: ${padding}` : ""} }`;
      jsx = `<View style={${style}}>\n${indentLines(children.jsx, 2)}\n</View>`;
      break;
    }

    case "Grid": {
      imports.add("View");
      const gap = resolveGapRN(props.gap);
      const children = emitChildren(node.children ?? []);
      children.imports.forEach((i) => imports.add(i));
      jsx = `<View style={{ flexDirection: "row", flexWrap: "wrap", gap: ${gap} }}>\n${indentLines(children.jsx, 2)}\n</View>`;
      break;
    }

    case "Section": {
      imports.add("View");
      const padding = props.padding ? resolveSizeRN(props.padding) : 0;
      const children = emitChildren(node.children ?? []);
      children.imports.forEach((i) => imports.add(i));
      jsx = `<View style={{ width: "100%"${padding ? `, padding: ${padding}` : ""} }}>\n${indentLines(children.jsx, 2)}\n</View>`;
      break;
    }

    case "ScrollArea": {
      imports.add("ScrollView");
      const children = emitChildren(node.children ?? []);
      children.imports.forEach((i) => imports.add(i));
      jsx = `<ScrollView>\n${indentLines(children.jsx, 2)}\n</ScrollView>`;
      break;
    }

    case "Spacer": {
      imports.add("View");
      const size = resolveSizeRN(props.size);
      jsx = `<View style={{ height: ${size} }} />`;
      break;
    }

    case "Heading": {
      imports.add("Text");
      const text = String(props.text ?? "");
      const level = typeof props.level === "number" ? props.level : 1;
      const fontSize = [32, 28, 24, 20, 18, 16][Math.min(Math.max(level, 1), 6) - 1];
      jsx = `<Text style={{ fontSize: ${fontSize}, fontWeight: "bold" }}>${text}</Text>`;
      break;
    }

    case "Text": {
      imports.add("Text");
      const text = String(props.text ?? "");
      if (props.variant === "muted") {
        jsx = `<Text style={{ fontSize: 14, color: "#6b7280" }}>${text}</Text>`;
      } else {
        jsx = `<Text>${text}</Text>`;
      }
      break;
    }

    case "Image": {
      imports.add("Image");
      const src = String(props.src ?? "");
      const w = typeof props.width === "number" ? props.width : 200;
      const h = typeof props.height === "number" ? props.height : 200;
      if (!src) {
        imports.add("View");
        jsx = `<View style={{ width: ${w}, height: ${h}, backgroundColor: "#f3f4f6", borderRadius: 8, alignItems: "center", justifyContent: "center" }}>\n  <Text style={{ fontSize: 12, color: "#9ca3af" }}>Image</Text>\n</View>`;
      } else {
        jsx = `<Image source={{ uri: ${JSON.stringify(src)} }} style={{ width: ${w}, height: ${h} }} resizeMode="cover" />`;
      }
      break;
    }

    case "Input": {
      imports.add("TextInput");
      imports.add("View");
      const placeholder = typeof props.placeholder === "string" ? props.placeholder : "";
      const label = typeof props.label === "string" && props.label ? props.label : null;
      if (label) {
        imports.add("Text");
        jsx = `<View>\n  <Text style={{ fontSize: 14, fontWeight: "500", marginBottom: 4 }}>${label}</Text>\n  <TextInput placeholder=${JSON.stringify(placeholder)} style={{ borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 10, fontSize: 14 }} />\n</View>`;
      } else {
        jsx = `<TextInput placeholder=${JSON.stringify(placeholder)} style={{ borderWidth: 1, borderColor: "#d1d5db", borderRadius: 8, padding: 10, fontSize: 14 }} />`;
      }
      break;
    }

    case "Link": {
      imports.add("TouchableOpacity");
      imports.add("Text");
      const text = typeof props.text === "string" ? props.text : "Link";
      jsx = `<TouchableOpacity>\n  <Text style={{ color: "#2563eb", textDecorationLine: "underline" }}>${text}</Text>\n</TouchableOpacity>`;
      break;
    }

    case "Divider": {
      imports.add("View");
      jsx = `<View style={{ height: 1, backgroundColor: "#e5e7eb", width: "100%" }} />`;
      break;
    }

    case "List": {
      imports.add("View");
      imports.add("Text");
      const items = Array.isArray(props.items) ? props.items : [];
      const listItems = items.map((item) => `  <Text style={{ fontSize: 14, paddingVertical: 2 }}>• ${String(item)}</Text>`).join("\n");
      jsx = `<View>\n${listItems}\n</View>`;
      break;
    }

    case "Card": {
      imports.add("View");
      const padding = props.padding ? resolveSizeRN(props.padding) : 16;
      const children = emitChildren(node.children ?? []);
      children.imports.forEach((i) => imports.add(i));
      jsx = `<View style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: ${padding}, borderWidth: 1, borderColor: "#e5e7eb", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>\n${indentLines(children.jsx, 2)}\n</View>`;
      break;
    }

    case "Button": {
      imports.add("TouchableOpacity");
      imports.add("Text");
      const label = String(props.label ?? "Button");
      const variant = typeof props.intent === "string" ? props.intent : "primary";
      const bg = variant === "outline" ? "transparent" : "#2563eb";
      const textColor = variant === "outline" ? "#2563eb" : "#ffffff";
      const border = variant === "outline" ? ", borderWidth: 1, borderColor: \"#2563eb\"" : "";
      jsx = `<TouchableOpacity style={{ backgroundColor: "${bg}", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, alignItems: "center"${border} }}>\n  <Text style={{ color: "${textColor}", fontWeight: "600", fontSize: 14 }}>${label}</Text>\n</TouchableOpacity>`;
      break;
    }

    case "Form": {
      imports.add("View");
      const children = emitChildren(node.children ?? []);
      children.imports.forEach((i) => imports.add(i));
      jsx = `<View style={{ gap: 16 }}>\n${indentLines(children.jsx, 2)}\n</View>`;
      break;
    }

    case "Modal": {
      imports.add("View");
      imports.add("Text");
      const title = String(props.title ?? "Dialog");
      const children = emitChildren(node.children ?? []);
      children.imports.forEach((i) => imports.add(i));
      jsx = `<View style={{ backgroundColor: "#ffffff", borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb", maxWidth: 400 }}>\n  <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>\n    <Text style={{ fontWeight: "600", fontSize: 14 }}>${title}</Text>\n  </View>\n  <View style={{ padding: 16 }}>\n${indentLines(children.jsx, 4)}\n  </View>\n</View>`;
      break;
    }

    case "Tabs": {
      imports.add("View");
      imports.add("Text");
      imports.add("TouchableOpacity");
      const tabs = Array.isArray(props.tabs) ? props.tabs.map(String) : ["Tab 1", "Tab 2"];
      const tabButtons = tabs.map((tab, i) => {
        const active = i === 0;
        return `    <TouchableOpacity style={{ paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: ${active ? '"#2563eb"' : '"transparent"'} }}>\n      <Text style={{ fontSize: 14, color: ${active ? '"#2563eb"' : '"#6b7280"'}${active ? ', fontWeight: "500"' : ""} }}>${tab}</Text>\n    </TouchableOpacity>`;
      }).join("\n");
      const childList = node.children ?? [];
      const firstChild = childList.length > 0 ? emitNode(childList[0]) : null;
      if (firstChild) firstChild.imports.forEach((i) => imports.add(i));
      jsx = `<View>\n  <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>\n${tabButtons}\n  </View>\n  <View style={{ paddingTop: 12 }}>\n${firstChild ? indentLines(firstChild.jsx, 4) : ""}\n  </View>\n</View>`;
      break;
    }

    case "Nav": {
      imports.add("View");
      imports.add("TouchableOpacity");
      imports.add("Text");
      const items = Array.isArray(props.items) ? props.items : [];
      const orientation = props.orientation === "vertical" ? "column" : "row";
      const navItems = items.map((item) => {
        const str = String(item);
        const [label] = str.includes("|") ? str.split("|") : [str];
        return `    <TouchableOpacity style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}>\n      <Text style={{ fontSize: 14 }}>${label}</Text>\n    </TouchableOpacity>`;
      }).join("\n");
      const children = emitChildren(node.children ?? []);
      children.imports.forEach((i) => imports.add(i));
      jsx = `<View style={{ flexDirection: "${orientation}", gap: 4 }}>\n${navItems}\n${children.jsx ? indentLines(children.jsx, 2) : ""}\n</View>`;
      break;
    }

    case "DataTable": {
      imports.add("View");
      imports.add("Text");
      const columns = Array.isArray(props.columns) ? props.columns : [];
      const parsedCols = columns.map((c) => {
        const str = String(c);
        if (str.includes("|")) { const [key, label] = str.split("|"); return { key, label }; }
        return { key: str, label: str };
      });
      const headerCells = parsedCols.map((col) => `      <Text style={{ flex: 1, fontWeight: "600", fontSize: 12, padding: 8 }}>${col.label}</Text>`).join("\n");
      jsx = `<View style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, overflow: "hidden" }}>\n  <View style={{ flexDirection: "row", backgroundColor: "#f9fafb", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>\n${headerCells}\n  </View>\n  <View style={{ padding: 8, alignItems: "center" }}>\n    <Text style={{ color: "#9ca3af", fontSize: 12 }}>No data</Text>\n  </View>\n</View>`;
      break;
    }

    case "Icon": {
      imports.add("View");
      imports.add("Text");
      const iconName = typeof props.name === "string" ? props.name : "Star";
      jsx = `<View style={{ width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>\n  <Text style={{ fontSize: 12 }}>[${iconName}]</Text>\n</View>`;
      break;
    }

    default: {
      imports.add("View");
      imports.add("Text");
      const children = emitChildren(node.children ?? []);
      children.imports.forEach((i) => imports.add(i));
      jsx = `<View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: "#9ca3af", borderRadius: 4, padding: 8 }}>\n  <Text style={{ fontSize: 12, color: "#6b7280" }}>&lt;${type}&gt;</Text>\n${children.jsx ? indentLines(children.jsx, 2) : ""}\n</View>`;
    }
  }

  // Apply node.style overlay
  if (hasStyle) {
    imports.add("View");
    jsx = `<View style={${formatStyleObj(styleObj)}}>\n${indentLines(jsx, 2)}\n</View>`;
  }

  return { jsx, imports };
}

// ---------------------------------------------------------------------------
// Screen emission
// ---------------------------------------------------------------------------

function emitScreen(spec: ScreenSpec, config: StudioConfig): EmitScreenResult {
  ensureTokens(config);

  const componentName = componentNameFromRoute(spec.route);
  const result = emitNode(spec.tree);

  // Collect RN imports
  const rnComponents = ["View", "Text", "Image", "ScrollView", "TextInput", "TouchableOpacity", "FlatList", "Modal"];
  const rnImportsArr: string[] = [];
  result.imports.forEach((imp) => {
    if (rnComponents.indexOf(imp) !== -1 && rnImportsArr.indexOf(imp) === -1) {
      rnImportsArr.push(imp);
    }
  });
  rnImportsArr.sort();

  const importLine = `import { ${rnImportsArr.join(", ")} } from "react-native";`;

  const contents = `// Auto-generated by Studio Compiler (Expo emitter)\n// DO NOT EDIT – changes will be overwritten.\n\nimport React from "react";\n${importLine}\n\nexport function ${componentName}() {\n  return (\n${indentLines(result.jsx, 4)}\n  );\n}\n`;

  const genDir = config.generatedDir;
  const filePath = `${genDir}/${componentName}.generated.tsx`;

  return {
    files: [{ path: filePath, contents }],
    componentName,
  };
}

function emitBarrelIndex(componentNames: string[], config: StudioConfig): EmittedFile {
  const lines = ["// Auto-generated barrel index\n"];
  for (const name of componentNames.sort()) {
    lines.push(`export { ${name} } from "./${name}.generated";`);
  }
  return {
    path: `${config.generatedDir}/index.ts`,
    contents: lines.join("\n") + "\n",
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const expoEmitter: Emitter = {
  name: "expo",
  emitScreen,
  emitBarrelIndex,
};
