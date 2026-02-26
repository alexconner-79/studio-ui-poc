"use client";

/**
 * Style property sections for the property panel.
 * Each section is collapsible and renders token-aware inputs for style properties.
 */

import React, { useState, useCallback, useEffect } from "react";
import { useEditorStore } from "@/lib/studio/store";
import type { NodeStyle, StyleValue, DesignTokens } from "@/lib/studio/types";
import {
  TokenAwareInput,
  ColorInput,
  NumberWithUnit,
  SpacingEditor,
  ShadowEditor,
  SliderInput,
  SegmentedSelect,
} from "./style-fields";
import { getTextStyles, getTokensForCategory, applyThemeOverrides } from "@/lib/studio/resolve-token";

// ---------------------------------------------------------------------------
// Collapsible section wrapper
// ---------------------------------------------------------------------------

function StyleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="[border-top:1px_solid_var(--s-border)] [padding:10px_12px] last:border-b-0">
      <div
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between cursor-pointer select-none [margin-bottom:8px]"
      >
        <span className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-semibold)] uppercase [letter-spacing:var(--s-tracking-wide)] [color:var(--s-text-ter)]">
          {title}
        </span>
        <span className="[font-size:8px] [color:var(--s-text-ter)]">{open ? "▾" : "▸"}</span>
      </div>
      {open && <div className="space-y-2.5 pb-1">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Node type helpers
// ---------------------------------------------------------------------------

const TEXT_BEARING_TYPES = new Set([
  "Heading", "Text", "Button", "Link", "Input", "Nav", "List",
]);

const CONTAINER_TYPES = new Set([
  "Frame", "Stack", "Grid", "Section", "ScrollArea", "Card", "Form", "Modal", "Tabs", "Nav",
]);

// ---------------------------------------------------------------------------
// Main style panel
// ---------------------------------------------------------------------------

const BREAKPOINT_OPTIONS = [
  { value: "base" as const, label: "Base", icon: "🖥" },
  { value: "tablet" as const, label: "Tablet", icon: "📋" },
  { value: "mobile" as const, label: "Mobile", icon: "📱" },
];

export function StylePanel({ nodeId, nodeType }: { nodeId: string; nodeType: string }) {
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const updateNodeResponsiveStyle = useEditorStore((s) => s.updateNodeResponsiveStyle);
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const editingBreakpoint = useEditorStore((s) => s.editingBreakpoint);
  const setEditingBreakpoint = useEditorStore((s) => s.setEditingBreakpoint);
  const designTokens = useEditorStore((s) => s.designTokens);
  const dsThemes = useEditorStore((s) => s.dsThemes);
  const activeThemeId = useEditorStore((s) => s.activeThemeId);
  const loadDesignTokens = useEditorStore((s) => s.loadDesignTokens);
  const currentProjectId = useEditorStore((s) => s.currentProjectId);
  const spec = useEditorStore((s) => s.spec);

  // Load tokens on first mount and whenever the project changes
  useEffect(() => {
    loadDesignTokens();
  }, [currentProjectId, loadDesignTokens]);

  // Get current node's style
  const node = spec ? findNodeById(spec.tree, nodeId) : null;
  const baseStyle = node?.style ?? {};

  // Resolve the effective style for the current breakpoint
  const effectiveStyle: NodeStyle = React.useMemo(() => {
    if (editingBreakpoint === "base") return baseStyle;
    const overrides = node?.responsive?.[editingBreakpoint] ?? {};
    return { ...baseStyle, ...overrides };
  }, [baseStyle, node?.responsive, editingBreakpoint]);

  // Determine which properties have breakpoint-specific overrides
  const overrideKeys = React.useMemo(() => {
    if (editingBreakpoint === "base") return new Set<string>();
    const overrides = node?.responsive?.[editingBreakpoint] ?? {};
    return new Set(Object.keys(overrides));
  }, [node?.responsive, editingBreakpoint]);

  const handleStyleChange = useCallback(
    (prop: string, value: StyleValue | undefined) => {
      if (editingBreakpoint === "base") {
        updateNodeStyle(nodeId, { [prop]: value } as Partial<NodeStyle>);
      } else {
        updateNodeResponsiveStyle(nodeId, editingBreakpoint, { [prop]: value } as Partial<NodeStyle>);
      }
    },
    [nodeId, updateNodeStyle, updateNodeResponsiveStyle, editingBreakpoint]
  );

  // Apply active theme overrides if a theme is selected
  const tokens = React.useMemo(() => {
    if (!designTokens) return null;
    if (!activeThemeId || !dsThemes[activeThemeId]) return designTokens;
    return applyThemeOverrides(designTokens, dsThemes[activeThemeId]);
  }, [designTokens, activeThemeId, dsThemes]);
  const isTextNode = TEXT_BEARING_TYPES.has(nodeType);
  const isContainer = CONTAINER_TYPES.has(nodeType);
  const isFrame = nodeType === "Frame";
  const nodeProps = node?.props as Record<string, unknown> | undefined;
  const autoLayout = isFrame ? (nodeProps?.autoLayout !== false) : false;

  const handlePropsChange = useCallback(
    (key: string, value: unknown) => {
      updateNodeProps(nodeId, { [key]: value });
    },
    [nodeId, updateNodeProps]
  );

  return (
    <div className="space-y-0">
      {/* Breakpoint selector */}
      <div className="border-t pt-2 pb-1 px-0">
        <div className="flex items-center gap-0.5 bg-muted/50 rounded p-0.5">
          {BREAKPOINT_OPTIONS.map((bp) => (
            <button
              key={bp.value}
              onClick={() => setEditingBreakpoint(bp.value)}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${
                editingBreakpoint === bp.value
                  ? "bg-background shadow-sm font-semibold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{bp.icon}</span>
              <span>{bp.label}</span>
            </button>
          ))}
        </div>
        {editingBreakpoint !== "base" && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Editing <strong>{editingBreakpoint}</strong> overrides. Unset fields inherit from base.
            {overrideKeys.size > 0 && (
              <span className="ml-1 text-blue-500">({overrideKeys.size} overrides)</span>
            )}
          </p>
        )}
      </div>

      {/* Typography - shown for text-bearing nodes */}
      {isTextNode && (
        <TypographySection style={effectiveStyle} tokens={tokens} onChange={handleStyleChange} />
      )}

      {/* Size */}
      <SizingSection style={effectiveStyle} tokens={tokens} onChange={handleStyleChange} />

      {/* Spacing */}
      <SpacingSection style={effectiveStyle} tokens={tokens} onChange={handleStyleChange} />

      {/* Background & Border */}
      <AppearanceSection style={effectiveStyle} tokens={tokens} onChange={handleStyleChange} />

      {/* Effects */}
      <EffectsSection style={effectiveStyle} tokens={tokens} onChange={handleStyleChange} />

      {/* Layout - shown for containers */}
      {isContainer && (
        <LayoutSection
          style={effectiveStyle}
          tokens={tokens}
          onChange={handleStyleChange}
          isFrame={isFrame}
          autoLayout={autoLayout}
          frameDirection={nodeProps?.direction as "row" | "column" | undefined}
          onPropsChange={handlePropsChange}
        />
      )}

      {/* Position */}
      <PositionSection style={effectiveStyle} tokens={tokens} onChange={handleStyleChange} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Typography Section
// ---------------------------------------------------------------------------

function TypographySection({
  style,
  tokens,
  onChange,
}: {
  style: NodeStyle;
  tokens: DesignTokens | null;
  onChange: (prop: string, value: StyleValue | undefined) => void;
}) {
  const textStyles = getTextStyles(tokens);
  const fontFamilyTokens = getTokensForCategory("typography.fontFamily", tokens);
  const projectFonts = useEditorStore((s) => s.projectFonts);

  // Detect whether the current style matches a named text style
  const activeTextStyle = textStyles.find((ts) =>
    (!ts.fontSize || ts.fontSize === String(style.fontSize ?? "")) &&
    (!ts.fontWeight || ts.fontWeight === String(style.fontWeight ?? "")) &&
    (!ts.lineHeight || ts.lineHeight === String(style.lineHeight ?? ""))
  );

  const applyTextStyle = (name: string) => {
    const ts = textStyles.find((t) => t.name === name);
    if (!ts) return;
    if (ts.fontSize) onChange("fontSize", ts.fontSize);
    if (ts.fontWeight) onChange("fontWeight", ts.fontWeight);
    if (ts.lineHeight) onChange("lineHeight", ts.lineHeight);
    if (ts.letterSpacing) onChange("letterSpacing", ts.letterSpacing);
    if (ts.fontFamily) onChange("fontFamily", ts.fontFamily);
  };

  return (
    <StyleSection title="Typography" defaultOpen>
      {/* Text Style preset picker */}
      {textStyles.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-muted-foreground font-medium">Text Style</label>
          <select
            value={activeTextStyle?.name ?? ""}
            onChange={(e) => { if (e.target.value) applyTextStyle(e.target.value); }}
            className="w-full h-7 px-2 text-[11px] bg-background border rounded"
          >
            <option value="">Custom</option>
            {textStyles.map((ts) => (
              <option key={ts.name} value={ts.name}>
                {ts.name}{ts.fontSize ? ` — ${ts.fontSize}` : ""}{ts.fontWeight && ts.fontWeight !== "400" ? ` / ${ts.fontWeight}` : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Font Family with token picker or project fonts fallback */}
      {fontFamilyTokens.length > 0 ? (
        <TokenAwareInput
          label="Font Family"
          value={style.fontFamily as StyleValue | undefined}
          tokenCategory="typography.fontFamily"
          tokens={tokens}
          onChange={(v) => onChange("fontFamily", v)}
          renderInput={({ value: v, onChange: onC }) => (
            <input
              type="text"
              value={String(v || "")}
              onChange={(e) => onC(e.target.value)}
              placeholder="Inter, sans-serif"
              className="w-full h-7 px-2 text-[11px] bg-background border rounded"
            />
          )}
        />
      ) : (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-muted-foreground font-medium">Font Family</label>
          <select
            value={String(style.fontFamily ?? "")}
            onChange={(e) => onChange("fontFamily", e.target.value || undefined)}
            className="w-full h-7 px-2 text-[11px] bg-background border rounded"
          >
            <option value="">Default</option>
            {projectFonts.map((f) => (
              <option key={f.family} value={f.family}>{f.family}</option>
            ))}
          </select>
        </div>
      )}

      <NumberWithUnit
        label="Font Size"
        value={style.fontSize}
        tokenCategory="typography.fontSize"
        tokens={tokens}
        onChange={(v) => onChange("fontSize", v)}
        units={["px", "rem", "em"]}
      />

      <TokenAwareInput
        label="Font Weight"
        value={style.fontWeight}
        tokenCategory="typography.fontWeight"
        tokens={tokens}
        onChange={(v) => onChange("fontWeight", v)}
        renderInput={({ value: v, onChange: onC }) => (
          <select
            value={String(v || "")}
            onChange={(e) => onC(e.target.value || "")}
            className="w-full h-7 px-2 text-[11px] bg-background border rounded"
          >
            <option value="">Default</option>
            <option value="100">Thin (100)</option>
            <option value="200">Extra Light (200)</option>
            <option value="300">Light (300)</option>
            <option value="400">Normal (400)</option>
            <option value="500">Medium (500)</option>
            <option value="600">Semibold (600)</option>
            <option value="700">Bold (700)</option>
            <option value="800">Extra Bold (800)</option>
            <option value="900">Black (900)</option>
          </select>
        )}
      />

      <SegmentedSelect
        label="Font Style"
        value={style.fontStyle}
        options={[
          { value: "normal", label: "Normal" },
          { value: "italic", label: "Italic", icon: <span className="italic">I</span> },
        ]}
        onChange={(v) => onChange("fontStyle", v as StyleValue | undefined)}
      />

      <NumberWithUnit
        label="Line Height"
        value={style.lineHeight}
        tokenCategory="typography.lineHeight"
        tokens={tokens}
        onChange={(v) => onChange("lineHeight", v)}
        units={["", "px", "rem", "%"]}
        placeholder="1.5"
      />

      <NumberWithUnit
        label="Letter Spacing"
        value={style.letterSpacing}
        tokenCategory="typography.letterSpacing"
        tokens={tokens}
        onChange={(v) => onChange("letterSpacing", v)}
        units={["em", "px", "rem"]}
        placeholder="0"
      />

      <NumberWithUnit
        label="Word Spacing"
        value={style.wordSpacing}
        tokenCategory=""
        tokens={tokens}
        onChange={(v) => onChange("wordSpacing", v)}
        units={["px", "em", "rem"]}
        placeholder="normal"
      />

      <SegmentedSelect
        label="Text Align"
        value={style.textAlign}
        options={[
          { value: "left", label: "Left", icon: <AlignIcon align="left" /> },
          { value: "center", label: "Center", icon: <AlignIcon align="center" /> },
          { value: "right", label: "Right", icon: <AlignIcon align="right" /> },
          { value: "justify", label: "Justify", icon: <AlignIcon align="justify" /> },
        ]}
        onChange={(v) => onChange("textAlign", v as StyleValue | undefined)}
      />

      <SegmentedSelect
        label="Decoration"
        value={style.textDecoration}
        options={[
          { value: "none", label: "None" },
          { value: "underline", label: "Underline", icon: <span className="underline text-[10px]">U</span> },
          { value: "line-through", label: "Strikethrough", icon: <span className="line-through text-[10px]">S</span> },
        ]}
        onChange={(v) => onChange("textDecoration", v as StyleValue | undefined)}
      />

      <SegmentedSelect
        label="Transform"
        value={style.textTransform}
        options={[
          { value: "none", label: "None", icon: <span className="text-[10px]">Aa</span> },
          { value: "uppercase", label: "Uppercase", icon: <span className="text-[10px]">AA</span> },
          { value: "lowercase", label: "Lowercase", icon: <span className="text-[10px]">aa</span> },
          { value: "capitalize", label: "Capitalize", icon: <span className="text-[10px]">Ab</span> },
        ]}
        onChange={(v) => onChange("textTransform", v as StyleValue | undefined)}
      />

      <ColorInput
        label="Color"
        value={style.color}
        tokens={tokens}
        onChange={(v) => onChange("color", v)}
      />
    </StyleSection>
  );
}

// ---------------------------------------------------------------------------
// Sizing Section
// ---------------------------------------------------------------------------

const SIZING_MODE_OPTIONS = [
  { value: "fixed", label: "Fixed" },
  { value: "fill", label: "Fill" },
  { value: "hug", label: "Hug" },
];

function SizingModeField({
  label,
  mode,
  value,
  tokens,
  onModeChange,
  onValueChange,
}: {
  label: string;
  mode: "fixed" | "fill" | "hug" | undefined;
  value: StyleValue | undefined;
  tokens: DesignTokens | null;
  onModeChange: (m: "fixed" | "fill" | "hug") => void;
  onValueChange: (v: StyleValue | undefined) => void;
}) {
  const effective = mode ?? "fixed";
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-muted-foreground font-medium">{label}</label>
      <div className="flex gap-1">
        <select
          value={effective}
          onChange={(e) => onModeChange(e.target.value as "fixed" | "fill" | "hug")}
          className="h-7 px-1.5 text-[10px] bg-background border rounded w-[58px] shrink-0"
        >
          {SIZING_MODE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {effective === "fixed" && (
          <NumberWithUnit
            label=""
            value={value}
            tokenCategory="size"
            tokens={tokens}
            onChange={onValueChange}
          />
        )}
        {effective !== "fixed" && (
          <div className="flex-1 h-7 flex items-center px-2 text-[10px] text-muted-foreground bg-muted/40 border rounded">
            {effective === "fill" ? "100%" : "auto"}
          </div>
        )}
      </div>
    </div>
  );
}

function SizingSection({
  style,
  tokens,
  onChange,
}: {
  style: NodeStyle;
  tokens: DesignTokens | null;
  onChange: (prop: string, value: StyleValue | undefined) => void;
}) {
  const handleModeChange = (axis: "width" | "height", m: "fixed" | "fill" | "hug") => {
    const modeKey = axis === "width" ? "widthMode" : "heightMode";
    onChange(modeKey, m === "fixed" ? undefined : m);
    if (m !== "fixed") onChange(axis, undefined);
  };

  return (
    <StyleSection title="Size">
      <div className="grid grid-cols-2 gap-2">
        <SizingModeField
          label="Width"
          mode={style.widthMode}
          value={style.width}
          tokens={tokens}
          onModeChange={(m) => handleModeChange("width", m)}
          onValueChange={(v) => onChange("width", v)}
        />
        <SizingModeField
          label="Height"
          mode={style.heightMode}
          value={style.height}
          tokens={tokens}
          onModeChange={(m) => handleModeChange("height", m)}
          onValueChange={(v) => onChange("height", v)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberWithUnit
          label="Min W"
          value={style.minWidth}
          tokenCategory="size"
          tokens={tokens}
          onChange={(v) => onChange("minWidth", v)}
        />
        <NumberWithUnit
          label="Max W"
          value={style.maxWidth}
          tokenCategory="size"
          tokens={tokens}
          onChange={(v) => onChange("maxWidth", v)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <NumberWithUnit
          label="Min H"
          value={style.minHeight}
          tokenCategory="size"
          tokens={tokens}
          onChange={(v) => onChange("minHeight", v)}
        />
        <NumberWithUnit
          label="Max H"
          value={style.maxHeight}
          tokenCategory="size"
          tokens={tokens}
          onChange={(v) => onChange("maxHeight", v)}
        />
      </div>
    </StyleSection>
  );
}

// ---------------------------------------------------------------------------
// Spacing Section
// ---------------------------------------------------------------------------

function BoxModelDiagram({ style }: { style: NodeStyle }) {
  const val = (prop: string) => {
    const v = (style as Record<string, unknown>)[prop];
    return v ? String(v) : "–";
  };
  return (
    <div className="relative w-full max-w-[200px] mx-auto mb-2">
      {/* Margin layer */}
      <div className="border border-violet-300 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/20 rounded p-2 text-[8px]">
        <div className="text-violet-500 dark:text-violet-400 text-center mb-0.5">margin</div>
        <div className="flex justify-between text-violet-500 dark:text-violet-400 mb-0.5">
          <span>{val("marginLeft")}</span>
          <span>{val("marginTop")}</span>
          <span>{val("marginRight")}</span>
        </div>
        {/* Padding layer */}
        <div className="border border-teal-300 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-950/20 rounded p-2">
          <div className="text-teal-600 dark:text-teal-400 text-center mb-0.5">padding</div>
          <div className="flex justify-between text-teal-600 dark:text-teal-400 mb-0.5">
            <span>{val("paddingLeft")}</span>
            <span>{val("paddingTop")}</span>
            <span>{val("paddingRight")}</span>
          </div>
          {/* Content */}
          <div className="border border-indigo-300 dark:border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 rounded py-1 text-center">
            <span className="text-indigo-500 dark:text-indigo-400">
              {val("width") !== "–" || val("height") !== "–"
                ? `${val("width")} × ${val("height")}`
                : "content"}
            </span>
          </div>
          <div className="text-teal-600 dark:text-teal-400 text-center mt-0.5">{val("paddingBottom")}</div>
        </div>
        <div className="text-violet-500 dark:text-violet-400 text-center mt-0.5">{val("marginBottom")}</div>
      </div>
    </div>
  );
}

function SpacingSection({
  style,
  tokens,
  onChange,
}: {
  style: NodeStyle;
  tokens: DesignTokens | null;
  onChange: (prop: string, value: StyleValue | undefined) => void;
}) {
  return (
    <StyleSection title="Spacing">
      <BoxModelDiagram style={style} />
      <SpacingEditor
        label="Padding"
        property="padding"
        style={style as Record<string, StyleValue | undefined>}
        tokens={tokens}
        onChange={onChange}
      />
      <SpacingEditor
        label="Margin"
        property="margin"
        style={style as Record<string, StyleValue | undefined>}
        tokens={tokens}
        onChange={onChange}
      />
    </StyleSection>
  );
}

// ---------------------------------------------------------------------------
// Appearance Section (Background + Border)
// ---------------------------------------------------------------------------

function AppearanceSection({
  style,
  tokens,
  onChange,
}: {
  style: NodeStyle;
  tokens: DesignTokens | null;
  onChange: (prop: string, value: StyleValue | undefined) => void;
}) {
  return (
    <StyleSection title="Background & Border">
      <ColorInput
        label="Background"
        value={style.backgroundColor}
        tokens={tokens}
        onChange={(v) => onChange("backgroundColor", v)}
      />

      <TokenAwareInput
        label="Background Image"
        value={style.backgroundImage}
        tokenCategory=""
        tokens={tokens}
        onChange={(v) => onChange("backgroundImage", v)}
        renderInput={({ value: v, onChange: onC }) => (
          <input
            type="text"
            value={String(v || "")}
            onChange={(e) => onC(e.target.value)}
            placeholder="url(...) or linear-gradient(...)"
            className="w-full h-7 px-2 text-[11px] bg-background border rounded"
          />
        )}
      />

      <div className="grid grid-cols-2 gap-2">
        <NumberWithUnit
          label="Border Width"
          value={style.borderWidth}
          tokenCategory="size"
          tokens={tokens}
          onChange={(v) => onChange("borderWidth", v)}
          units={["px", "rem"]}
        />

        <div className="flex flex-col gap-1">
          <label className="text-[11px] text-muted-foreground font-medium">Border Style</label>
          <select
            value={style.borderStyle ?? ""}
            onChange={(e) => onChange("borderStyle", e.target.value || undefined)}
            className="h-7 px-2 text-[11px] bg-background border rounded"
          >
            <option value="">Default</option>
            <option value="none">None</option>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
        </div>
      </div>

      <ColorInput
        label="Border Color"
        value={style.borderColor}
        tokens={tokens}
        onChange={(v) => onChange("borderColor", v)}
      />

      <NumberWithUnit
        label="Border Radius"
        value={style.borderRadius}
        tokenCategory="borderRadius"
        tokens={tokens}
        onChange={(v) => onChange("borderRadius", v)}
        units={["px", "rem", "%"]}
      />

      <BorderRadiusExpanded style={style} tokens={tokens} onChange={onChange} />
    </StyleSection>
  );
}

function BorderRadiusExpanded({
  style,
  tokens,
  onChange,
}: {
  style: NodeStyle;
  tokens: DesignTokens | null;
  onChange: (prop: string, value: StyleValue | undefined) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!expanded) {
    return (
      <button
        className="text-[10px] text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded(true)}
      >
        Per-corner radius...
      </button>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberWithUnit
        label="Top Left"
        value={style.borderTopLeftRadius}
        tokenCategory="borderRadius"
        tokens={tokens}
        onChange={(v) => onChange("borderTopLeftRadius", v)}
        units={["px", "rem", "%"]}
      />
      <NumberWithUnit
        label="Top Right"
        value={style.borderTopRightRadius}
        tokenCategory="borderRadius"
        tokens={tokens}
        onChange={(v) => onChange("borderTopRightRadius", v)}
        units={["px", "rem", "%"]}
      />
      <NumberWithUnit
        label="Bottom Left"
        value={style.borderBottomLeftRadius}
        tokenCategory="borderRadius"
        tokens={tokens}
        onChange={(v) => onChange("borderBottomLeftRadius", v)}
        units={["px", "rem", "%"]}
      />
      <NumberWithUnit
        label="Bottom Right"
        value={style.borderBottomRightRadius}
        tokenCategory="borderRadius"
        tokens={tokens}
        onChange={(v) => onChange("borderBottomRightRadius", v)}
        units={["px", "rem", "%"]}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Effects Section
// ---------------------------------------------------------------------------

function EffectsSection({
  style,
  tokens,
  onChange,
}: {
  style: NodeStyle;
  tokens: DesignTokens | null;
  onChange: (prop: string, value: StyleValue | undefined) => void;
}) {
  return (
    <StyleSection title="Effects">
      <SliderInput
        label="Opacity"
        value={style.opacity}
        onChange={(v) => onChange("opacity", v)}
        min={0}
        max={1}
        step={0.01}
      />
      <ShadowEditor
        label="Box Shadow"
        value={style.boxShadow}
        tokens={tokens}
        onChange={(v) => onChange("boxShadow", v)}
      />
    </StyleSection>
  );
}

// ---------------------------------------------------------------------------
// Layout Section
// ---------------------------------------------------------------------------

function LayoutSection({
  style,
  tokens,
  onChange,
  isFrame = false,
  autoLayout = false,
  frameDirection,
  onPropsChange,
}: {
  style: NodeStyle;
  tokens: DesignTokens | null;
  onChange: (prop: string, value: StyleValue | undefined) => void;
  isFrame?: boolean;
  autoLayout?: boolean;
  frameDirection?: "row" | "column";
  onPropsChange?: (key: string, value: unknown) => void;
}) {
  return (
    <StyleSection title="Layout">
      {/* Auto Layout toggle for Frame nodes */}
      {isFrame && onPropsChange && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-medium">Auto Layout</span>
          <button
            onClick={() => {
              onPropsChange("autoLayout", !autoLayout);
              if (!autoLayout) onPropsChange("direction", frameDirection ?? "row");
            }}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              autoLayout ? "bg-blue-500" : "bg-muted"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                autoLayout ? "translate-x-[18px]" : "translate-x-[2px]"
              }`}
            />
          </button>
        </div>
      )}

      {/* Direction toggle (Frame auto-layout or style-level flexDirection) */}
      {((isFrame && autoLayout) || (!isFrame)) && (
        <SegmentedSelect
          label="Direction"
          value={isFrame ? (frameDirection ?? "row") : (style.flexDirection ?? "row")}
          options={[
            { value: "row", label: "→ Row" },
            { value: "column", label: "↓ Column" },
          ]}
          onChange={(v) => {
            if (isFrame && onPropsChange) {
              onPropsChange("direction", v);
            } else {
              onChange("flexDirection", v as StyleValue | undefined);
            }
          }}
        />
      )}

      {/* Show flex container controls only when auto-layout is active */}
      {(!isFrame || autoLayout) && (
        <>
          <SegmentedSelect
            label="Justify Content"
            value={style.justifyContent}
            options={[
              { value: "flex-start", label: "Start" },
              { value: "center", label: "Center" },
              { value: "flex-end", label: "End" },
              { value: "space-between", label: "Between" },
              { value: "space-around", label: "Around" },
            ]}
            onChange={(v) => onChange("justifyContent", v as StyleValue | undefined)}
          />

          <SegmentedSelect
            label="Align Items"
            value={style.alignItems}
            options={[
              { value: "flex-start", label: "Start" },
              { value: "center", label: "Center" },
              { value: "flex-end", label: "End" },
              { value: "stretch", label: "Stretch" },
              { value: "baseline", label: "Base" },
            ]}
            onChange={(v) => onChange("alignItems", v as StyleValue | undefined)}
          />

          <SegmentedSelect
            label="Flex Wrap"
            value={style.flexWrap}
            options={[
              { value: "nowrap", label: "No Wrap" },
              { value: "wrap", label: "Wrap" },
            ]}
            onChange={(v) => onChange("flexWrap", v as StyleValue | undefined)}
          />

          <NumberWithUnit
            label="Gap"
            value={style.gap}
            tokenCategory="spacing"
            tokens={tokens}
            onChange={(v) => onChange("gap", v)}
            units={["px", "rem", "%"]}
          />
        </>
      )}

      <SegmentedSelect
        label="Overflow"
        value={style.overflow}
        options={[
          { value: "visible", label: "Visible" },
          { value: "hidden", label: "Hidden" },
          { value: "auto", label: "Auto" },
          { value: "scroll", label: "Scroll" },
        ]}
        onChange={(v) => onChange("overflow", v as StyleValue | undefined)}
      />
    </StyleSection>
  );
}

// ---------------------------------------------------------------------------
// Position Section
// ---------------------------------------------------------------------------

function PositionSection({
  style,
  tokens,
  onChange,
}: {
  style: NodeStyle;
  tokens: DesignTokens | null;
  onChange: (prop: string, value: StyleValue | undefined) => void;
}) {
  return (
    <StyleSection title="Position">
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-muted-foreground font-medium">Position</label>
        <select
          value={style.position ?? ""}
          onChange={(e) => onChange("position", e.target.value || undefined)}
          className="h-7 px-2 text-[11px] bg-background border rounded"
        >
          <option value="">Default (static)</option>
          <option value="relative">Relative</option>
          <option value="absolute">Absolute</option>
          <option value="fixed">Fixed</option>
          <option value="sticky">Sticky</option>
        </select>
      </div>

      {style.position && style.position !== "static" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <NumberWithUnit
              label="Top"
              value={style.top}
              tokenCategory="spacing"
              tokens={tokens}
              onChange={(v) => onChange("top", v)}
            />
            <NumberWithUnit
              label="Right"
              value={style.right}
              tokenCategory="spacing"
              tokens={tokens}
              onChange={(v) => onChange("right", v)}
            />
            <NumberWithUnit
              label="Bottom"
              value={style.bottom}
              tokenCategory="spacing"
              tokens={tokens}
              onChange={(v) => onChange("bottom", v)}
            />
            <NumberWithUnit
              label="Left"
              value={style.left}
              tokenCategory="spacing"
              tokens={tokens}
              onChange={(v) => onChange("left", v)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-muted-foreground font-medium">Z-Index</label>
            <input
              type="number"
              value={style.zIndex ?? ""}
              onChange={(e) => onChange("zIndex", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="auto"
              className="h-7 px-2 text-[11px] bg-background border rounded"
            />
          </div>
        </>
      )}
    </StyleSection>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import type { Node } from "@/lib/studio/types";

function findNodeById(root: Node, id: string): Node | null {
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
}

// Simple SVG icons for text alignment
function AlignIcon({ align }: { align: "left" | "center" | "right" | "justify" }) {
  const lines = {
    left: [12, 8, 12, 10],
    center: [10, 12, 10, 12],
    right: [12, 8, 12, 10],
    justify: [12, 12, 12, 12],
  }[align];

  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="stroke-current" strokeWidth="1.5">
      {lines.map((w, i) => {
        const y = 3 + i * 2.5;
        const x = align === "right" ? 14 - w : align === "center" ? (14 - w) / 2 : 1;
        return <line key={i} x1={x} y1={y} x2={x + w} y2={y} />;
      })}
    </svg>
  );
}
