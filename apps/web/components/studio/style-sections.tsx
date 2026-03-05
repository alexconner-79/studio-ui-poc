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
import {
  getConstraints,
  isSectionSupported,
  isEffectSupported,
  isFillTypeSupported,
  isStrokePositionSupported,
  getHiddenSummary,
} from "@/lib/studio/framework-constraints";
import type { EffectType, FillType, StrokePosition } from "@/lib/studio/framework-constraints";
import { GradientEditor, type GradientValue } from "./gradient-editor";

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
        <svg
          width="10" height="10" viewBox="0 0 10 10"
          fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round"
          className="[color:var(--s-text-ter)]"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}
        >
          <polyline points="3,2 7,5 3,8" />
        </svg>
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

  // For array-typed style properties (effects, fills, strokes, cssFilters)
  const handleComplexChange = useCallback(
    (prop: string, value: unknown) => {
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
  const projectFramework = useEditorStore((s) => s.projectFramework) || "nextjs";

  const isTextNode = TEXT_BEARING_TYPES.has(nodeType);
  const isContainer = CONTAINER_TYPES.has(nodeType);
  const isFrame = nodeType === "Frame";
  const isDivider = nodeType === "Divider";
  const isSpacer = nodeType === "Spacer";
  const isImage = nodeType === "Image";
  const nodeProps = node?.props as Record<string, unknown> | undefined;
  const autoLayout = isFrame ? (nodeProps?.autoLayout !== false) : false;
  const hiddenSummary = getHiddenSummary(projectFramework);

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

      {/* Layout — containers only, shown first */}
      {isContainer && !isDivider && !isSpacer && (
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

      {/* Typography — text-bearing nodes only */}
      {isTextNode && (
        <TypographySection style={effectiveStyle} tokens={tokens} onChange={handleStyleChange} />
      )}

      {/* Size — all except Spacer (its only property is size, handled by PositionSizeWidget) */}
      {!isSpacer && (
      <SizingSection style={effectiveStyle} tokens={tokens} onChange={handleStyleChange} />
      )}

      {/* Spacing — not for Divider, Spacer, or Image */}
      {!isDivider && !isSpacer && !isImage && (
      <SpacingSection style={effectiveStyle} tokens={tokens} onChange={handleStyleChange} />
      )}

      {/* Fills — not for Spacer or Divider */}
      {!isSpacer && !isDivider && isSectionSupported(projectFramework, "fills") && (
        <FillsSection style={effectiveStyle} onComplexChange={handleComplexChange} framework={projectFramework} />
      )}

      {/* Background & Border — not for Spacer */}
      {!isSpacer && (
      <AppearanceSection style={effectiveStyle} tokens={tokens} onChange={handleStyleChange} />
      )}

      {/* Strokes — not for Spacer or Divider */}
      {!isSpacer && !isDivider && isSectionSupported(projectFramework, "strokes") && (
        <StrokesSection style={effectiveStyle} onComplexChange={handleComplexChange} framework={projectFramework} />
      )}

      {/* Effects — not for Divider or Spacer */}
      {!isDivider && !isSpacer && isSectionSupported(projectFramework, "effects") && (
        <EffectsSection style={effectiveStyle} tokens={tokens} onChange={handleStyleChange} onComplexChange={handleComplexChange} framework={projectFramework} />
      )}

      {/* CSS Filters — not for Divider or Spacer; web frameworks only */}
      {!isDivider && !isSpacer && isSectionSupported(projectFramework, "cssFilters") && (
        <CSSFiltersSection style={effectiveStyle} onComplexChange={handleComplexChange} />
      )}

      {/* Transform — not for Divider or Spacer */}
      {!isDivider && !isSpacer && (
        <TransformSection style={effectiveStyle} onChange={handleStyleChange} />
      )}

      {/* Position — not for Divider or Spacer */}
      {!isDivider && !isSpacer && (
      <PositionSection style={effectiveStyle} tokens={tokens} onChange={handleStyleChange} />
      )}

      {/* Framework constraints disclosure */}
      {hiddenSummary && (
        <div className="px-3 py-2 text-[10px] [color:var(--s-text-ter)] flex items-start gap-1.5">
          <span className="shrink-0 w-3.5 h-3.5 rounded-full border [border-color:var(--s-text-ter)] flex items-center justify-center text-[9px] font-bold mt-px">?</span>
          <span>Some options are hidden because they are not supported by {projectFramework === "expo" ? "React Native (Expo)" : projectFramework}. Switch to a web framework to access all options.</span>
        </div>
      )}
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

      <SegmentedSelect
        label="Text Align"
        value={style.textAlign}
        options={[
          { value: "left", label: "Left", icon: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="3" x2="14" y2="3"/><line x1="2" y1="7" x2="10" y2="7"/><line x1="2" y1="11" x2="14" y2="11"/></svg> },
          { value: "center", label: "Centre", icon: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="3" x2="14" y2="3"/><line x1="4" y1="7" x2="12" y2="7"/><line x1="2" y1="11" x2="14" y2="11"/></svg> },
          { value: "right", label: "Right", icon: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="3" x2="14" y2="3"/><line x1="6" y1="7" x2="14" y2="7"/><line x1="2" y1="11" x2="14" y2="11"/></svg> },
          { value: "justify", label: "Justify", icon: <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="3" x2="14" y2="3"/><line x1="2" y1="7" x2="14" y2="7"/><line x1="2" y1="11" x2="14" y2="11"/></svg> },
        ]}
        onChange={(v) => onChange("textAlign", v as StyleValue | undefined)}
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
// Effects Section (stackable effects + opacity + blend mode)
// ---------------------------------------------------------------------------

type EffectEntry = NonNullable<NodeStyle["effects"]>[number];

const EFFECT_TYPE_LABELS: Record<EffectEntry["type"], string> = {
  "drop-shadow": "Drop Shadow",
  "inner-shadow": "Inner Shadow",
  "layer-blur": "Layer Blur",
  "background-blur": "BG Blur",
  "glass": "Glass",
};

const EFFECT_DEFAULTS: Record<EffectEntry["type"], Omit<EffectEntry, "type">> = {
  "drop-shadow": { x: 2, y: 4, blur: 8, spread: 0, color: "#000000", opacity: 0.2 } as Omit<Extract<EffectEntry, { type: "drop-shadow" }>, "type">,
  "inner-shadow": { x: 0, y: 2, blur: 4, spread: 0, color: "#000000", opacity: 0.15 } as Omit<Extract<EffectEntry, { type: "inner-shadow" }>, "type">,
  "layer-blur": { radius: 4 } as Omit<Extract<EffectEntry, { type: "layer-blur" }>, "type">,
  "background-blur": { radius: 8 } as Omit<Extract<EffectEntry, { type: "background-blur" }>, "type">,
  "glass": { blurRadius: 12, backgroundOpacity: 0.15 } as Omit<Extract<EffectEntry, { type: "glass" }>, "type">,
};

function EffectEntryEditor({ effect, onUpdate }: { effect: EffectEntry; onUpdate: (e: EffectEntry) => void }) {
  if (effect.type === "drop-shadow" || effect.type === "inner-shadow") {
    return (
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          {(["x", "y", "blur", "spread"] as const).map((k) => (
            <div key={k} className="flex flex-col gap-0.5">
              <label className="text-[10px] [color:var(--s-text-ter)] capitalize">{k}</label>
              <input type="number" value={(effect as Record<string, unknown>)[k] as number}
                onChange={(e) => onUpdate({ ...effect, [k]: Number(e.target.value) })}
                className="h-6 px-1.5 text-[11px] bg-background border rounded w-full" />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 items-end">
          <div className="flex flex-col gap-0.5 flex-1">
            <label className="text-[10px] [color:var(--s-text-ter)]">Color</label>
            <input type="color" value={effect.color}
              onChange={(e) => onUpdate({ ...effect, color: e.target.value })}
              className="h-6 w-full rounded border cursor-pointer" />
          </div>
          <div className="flex flex-col gap-0.5 flex-1">
            <label className="text-[10px] [color:var(--s-text-ter)]">Opacity</label>
            <input type="number" value={Math.round(effect.opacity * 100)} min={0} max={100} step={1}
              onChange={(e) => onUpdate({ ...effect, opacity: Number(e.target.value) / 100 })}
              className="h-6 px-1.5 text-[11px] bg-background border rounded w-full" />
          </div>
        </div>
      </div>
    );
  }
  if (effect.type === "layer-blur" || effect.type === "background-blur") {
    return (
      <div className="flex flex-col gap-0.5">
        <label className="text-[10px] [color:var(--s-text-ter)]">Radius (px)</label>
        <input type="number" value={effect.radius} min={0}
          onChange={(e) => onUpdate({ ...effect, radius: Number(e.target.value) })}
          className="h-6 px-1.5 text-[11px] bg-background border rounded w-full" />
      </div>
    );
  }
  if (effect.type === "glass") {
    return (
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] [color:var(--s-text-ter)]">Blur (px)</label>
          <input type="number" value={effect.blurRadius} min={0}
            onChange={(e) => onUpdate({ ...effect, blurRadius: Number(e.target.value) })}
            className="h-6 px-1.5 text-[11px] bg-background border rounded w-full" />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] [color:var(--s-text-ter)]">BG Opacity (%)</label>
          <input type="number" value={Math.round(effect.backgroundOpacity * 100)} min={0} max={100}
            onChange={(e) => onUpdate({ ...effect, backgroundOpacity: Number(e.target.value) / 100 })}
            className="h-6 px-1.5 text-[11px] bg-background border rounded w-full" />
        </div>
      </div>
    );
  }
  return null;
}

function EffectRow({
  effect,
  onUpdate,
  onRemove,
  onToggle,
}: {
  effect: EffectEntry;
  onUpdate: (updated: EffectEntry) => void;
  onRemove: () => void;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const enabled = effect.enabled !== false;
  return (
    <div className="rounded [border:1px_solid_var(--s-border)]">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          onClick={onToggle}
          className={`w-3 h-3 rounded-full border-[1.5px] shrink-0 transition-colors ${enabled ? "[background:var(--s-accent)] [border-color:var(--s-accent)]" : "[border-color:var(--s-text-ter)]"}`}
        />
        <span className="flex-1 text-[11px] cursor-pointer" onClick={() => setExpanded(!expanded)}>
          {EFFECT_TYPE_LABELS[effect.type]}
        </span>
        <button onClick={() => setExpanded(!expanded)} className="[color:var(--s-text-ter)]">
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.1s" }}>
            <polyline points="3,2 7,5 3,8" />
          </svg>
        </button>
        <button onClick={onRemove} className="[color:var(--s-text-ter)] hover:[color:var(--s-text-pri)]">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="2" y1="2" x2="8" y2="8" /><line x1="8" y1="2" x2="2" y2="8" />
          </svg>
        </button>
      </div>
      {expanded && (
        <div className="px-2 pb-2 [border-top:1px_solid_var(--s-border)] pt-1.5">
          <EffectEntryEditor effect={effect} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

function EffectsSection({
  style,
  tokens,
  onChange,
  onComplexChange,
  framework = "nextjs",
}: {
  style: NodeStyle;
  tokens: DesignTokens | null;
  onChange: (prop: string, value: StyleValue | undefined) => void;
  onComplexChange: (prop: string, value: unknown) => void;
  framework?: string;
}) {
  const effects = style.effects ?? [];
  const showBlendMode = isSectionSupported(framework, "blendMode");
  const availableEffectTypes = (Object.keys(EFFECT_TYPE_LABELS) as EffectEntry["type"][]).filter(
    (t) => isEffectSupported(framework, t as EffectType)
  );

  const updateEffects = useCallback((updated: NonNullable<NodeStyle["effects"]>) => {
    onComplexChange("effects", updated.length > 0 ? updated : undefined);
  }, [onComplexChange]);

  return (
    <StyleSection title="Effects">
      <SliderInput
        label="Opacity"
        value={style.opacity}
        onChange={(v) => onChange("opacity", v)}
        min={0} max={1} step={0.01}
      />

      {showBlendMode && (
        <div className="flex flex-col gap-1">
          <label className="text-[11px] [color:var(--s-text-ter)] font-medium">Blend Mode</label>
          <select
            value={style.mixBlendMode ?? "normal"}
            onChange={(e) => onChange("mixBlendMode", e.target.value === "normal" ? undefined : e.target.value as StyleValue)}
            className="h-7 px-2 text-[11px] bg-background border rounded"
          >
            {["normal","multiply","screen","overlay","darken","lighten","color-dodge","color-burn","hard-light","soft-light","difference","exclusion","hue","saturation","color","luminosity"].map((v) => (
              <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1).replace(/-/g, " ")}</option>
            ))}
          </select>
        </div>
      )}

      {effects.length > 0 && (
        <div className="space-y-1">
          {effects.map((effect, i) => (
            <EffectRow
              key={i}
              effect={effect}
              onToggle={() => updateEffects(effects.map((e, idx) => idx === i ? { ...e, enabled: !(e.enabled !== false) } : e))}
              onUpdate={(updated) => updateEffects(effects.map((e, idx) => idx === i ? updated : e))}
              onRemove={() => updateEffects(effects.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>
      )}

      <select
        className="w-full h-7 px-2 text-[10px] bg-background border rounded [color:var(--s-text-ter)]"
        value=""
        onChange={(e) => {
          if (!e.target.value) return;
          const type = e.target.value as EffectEntry["type"];
          updateEffects([...effects, { type, ...EFFECT_DEFAULTS[type] } as EffectEntry]);
        }}
      >
        <option value="">+ Add effect</option>
        {availableEffectTypes.map((t) => (
          <option key={t} value={t}>{EFFECT_TYPE_LABELS[t]}</option>
        ))}
      </select>
    </StyleSection>
  );
}

// ---------------------------------------------------------------------------
// Transform Section
// ---------------------------------------------------------------------------

function TransformSection({
  style,
  onChange,
}: {
  style: NodeStyle;
  onChange: (prop: string, value: StyleValue | undefined) => void;
}) {
  return (
    <StyleSection title="Transform">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] [color:var(--s-text-ter)] font-medium">Rotation (°)</label>
          <input
            type="number"
            value={style.rotation ?? ""}
            onChange={(e) => onChange("rotation", e.target.value !== "" ? Number(e.target.value) : undefined)}
            placeholder="0"
            className="h-7 px-2 text-[11px] bg-background border rounded"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] [color:var(--s-text-ter)] font-medium">Flip</label>
          <div className="flex gap-1">
            <button
              onClick={() => onChange("scaleX", style.scaleX === -1 ? undefined : -1)}
              className={`flex-1 h-7 text-[10px] border rounded transition-colors ${style.scaleX === -1 ? "[background:var(--s-accent)] text-white border-transparent" : "bg-background"}`}
            >H</button>
            <button
              onClick={() => onChange("scaleY", style.scaleY === -1 ? undefined : -1)}
              className={`flex-1 h-7 text-[10px] border rounded transition-colors ${style.scaleY === -1 ? "[background:var(--s-accent)] text-white border-transparent" : "bg-background"}`}
            >V</button>
          </div>
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] [color:var(--s-text-ter)] font-medium">Scale X</label>
          <input
            type="number"
            value={style.scaleX !== undefined && style.scaleX !== -1 ? style.scaleX : ""}
            onChange={(e) => onChange("scaleX", e.target.value !== "" ? Number(e.target.value) : undefined)}
            placeholder="1" step={0.1}
            className="h-7 px-2 text-[11px] bg-background border rounded"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] [color:var(--s-text-ter)] font-medium">Scale Y</label>
          <input
            type="number"
            value={style.scaleY !== undefined && style.scaleY !== -1 ? style.scaleY : ""}
            onChange={(e) => onChange("scaleY", e.target.value !== "" ? Number(e.target.value) : undefined)}
            placeholder="1" step={0.1}
            className="h-7 px-2 text-[11px] bg-background border rounded"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] [color:var(--s-text-ter)] font-medium">Skew X (°)</label>
          <input
            type="number"
            value={style.skewX ?? ""}
            onChange={(e) => onChange("skewX", e.target.value !== "" ? Number(e.target.value) : undefined)}
            placeholder="0"
            className="h-7 px-2 text-[11px] bg-background border rounded"
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] [color:var(--s-text-ter)] font-medium">Skew Y (°)</label>
          <input
            type="number"
            value={style.skewY ?? ""}
            onChange={(e) => onChange("skewY", e.target.value !== "" ? Number(e.target.value) : undefined)}
            placeholder="0"
            className="h-7 px-2 text-[11px] bg-background border rounded"
          />
        </div>
      </div>
    </StyleSection>
  );
}

// ---------------------------------------------------------------------------
// CSS Filters Section
// ---------------------------------------------------------------------------

type CSSFilterEntry = NonNullable<NodeStyle["cssFilters"]>[number];

const CSS_FILTER_META: Record<CSSFilterEntry["type"], { label: string; unit: string; min: number; max: number; defaultVal: number }> = {
  brightness:   { label: "Brightness",  unit: "%",  min: 0,    max: 200,  defaultVal: 100 },
  contrast:     { label: "Contrast",    unit: "%",  min: 0,    max: 200,  defaultVal: 100 },
  saturate:     { label: "Saturation",  unit: "%",  min: 0,    max: 200,  defaultVal: 100 },
  "hue-rotate": { label: "Hue Rotate",  unit: "°",  min: -180, max: 180,  defaultVal: 0 },
  grayscale:    { label: "Grayscale",   unit: "%",  min: 0,    max: 100,  defaultVal: 0 },
  sepia:        { label: "Sepia",       unit: "%",  min: 0,    max: 100,  defaultVal: 0 },
  invert:       { label: "Invert",      unit: "%",  min: 0,    max: 100,  defaultVal: 0 },
};

function CSSFiltersSection({
  style,
  onComplexChange,
}: {
  style: NodeStyle;
  onComplexChange: (prop: string, value: unknown) => void;
}) {
  const filters = style.cssFilters ?? [];

  const update = useCallback((updated: NonNullable<NodeStyle["cssFilters"]>) => {
    onComplexChange("cssFilters", updated.length > 0 ? updated : undefined);
  }, [onComplexChange]);

  return (
    <StyleSection title="CSS Filters">
      {filters.map((f, i) => {
        const meta = CSS_FILTER_META[f.type];
        return (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[10px] [color:var(--s-text-ter)] w-[68px] shrink-0">{meta.label}</span>
            <input
              type="range" min={meta.min} max={meta.max} step={1}
              value={f.value}
              onChange={(e) => update(filters.map((x, idx) => idx === i ? { ...x, value: Number(e.target.value) } : x))}
              className="flex-1 h-1 accent-[var(--s-accent)]"
            />
            <span className="text-[10px] [color:var(--s-text-ter)] w-[34px] text-right shrink-0">{f.value}{meta.unit}</span>
            <button
              onClick={() => update(filters.filter((_, idx) => idx !== i))}
              className="[color:var(--s-text-ter)] hover:[color:var(--s-text-pri)] shrink-0"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="2" y1="2" x2="8" y2="8" /><line x1="8" y1="2" x2="2" y2="8" />
              </svg>
            </button>
          </div>
        );
      })}
      <select
        className="w-full h-7 px-2 text-[10px] bg-background border rounded [color:var(--s-text-ter)]"
        value=""
        onChange={(e) => {
          if (!e.target.value) return;
          const type = e.target.value as CSSFilterEntry["type"];
          update([...filters, { type, value: CSS_FILTER_META[type].defaultVal }]);
        }}
      >
        <option value="">+ Add filter</option>
        {(Object.keys(CSS_FILTER_META) as CSSFilterEntry["type"][]).map((t) => (
          <option key={t} value={t}>{CSS_FILTER_META[t].label}</option>
        ))}
      </select>
    </StyleSection>
  );
}

// ---------------------------------------------------------------------------
// Fills Section (multiple fills stack)
// ---------------------------------------------------------------------------

type FillEntry = NonNullable<NodeStyle["fills"]>[number];

function FillRow({
  fill,
  onUpdate,
  onRemove,
}: {
  fill: FillEntry;
  onUpdate: (updated: FillEntry) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded [border:1px_solid_var(--s-border)]">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        {/* Color swatch */}
        <div className="w-4 h-4 rounded shrink-0 border [border-color:var(--s-border)]"
          style={{ background: fill.type === "solid" ? fill.color : fill.type === "linear-gradient" ? `linear-gradient(${fill.angle}deg, ${fill.stops.map((s) => `${s.color} ${s.position * 100}%`).join(",")})` : fill.type === "radial-gradient" ? `radial-gradient(circle, ${fill.stops.map((s) => `${s.color} ${s.position * 100}%`).join(",")})` : "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 8px 8px" }}
        />
        <span className="flex-1 text-[11px] cursor-pointer" onClick={() => setExpanded(!expanded)}>
          {fill.type === "solid" ? fill.color : fill.type === "linear-gradient" ? `Linear ${fill.angle}°` : fill.type === "radial-gradient" ? "Radial" : fill.src}
        </span>
        <button onClick={() => setExpanded(!expanded)} className="[color:var(--s-text-ter)]">
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.1s" }}>
            <polyline points="3,2 7,5 3,8" />
          </svg>
        </button>
        <button onClick={onRemove} className="[color:var(--s-text-ter)] hover:[color:var(--s-text-pri)]">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="2" y1="2" x2="8" y2="8" /><line x1="8" y1="2" x2="2" y2="8" />
          </svg>
        </button>
      </div>
      {expanded && (
        <div className="px-2 pb-2 [border-top:1px_solid_var(--s-border)] pt-1.5 space-y-1.5">
          <FillEditor fill={fill} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

function FillEditor({ fill, onUpdate }: { fill: FillEntry; onUpdate: (updated: FillEntry) => void }) {
  if (fill.type === "solid") {
    return (
      <>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] [color:var(--s-text-ter)]">Color</label>
          <input type="color" value={fill.color} onChange={(e) => onUpdate({ ...fill, color: e.target.value })}
            className="h-7 w-full rounded border cursor-pointer" />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] [color:var(--s-text-ter)] w-14 shrink-0">Opacity (%)</label>
          <input type="number" value={Math.round((fill.opacity ?? 1) * 100)} min={0} max={100}
            onChange={(e) => onUpdate({ ...fill, opacity: Number(e.target.value) / 100 })}
            className="flex-1 h-6 px-1.5 text-[11px] bg-background border rounded" />
        </div>
      </>
    );
  }
  if (fill.type === "linear-gradient") {
    return (
      <GradientEditor
        value={fill}
        onChange={(updated) => onUpdate(updated as FillEntry)}
      />
    );
  }
  if (fill.type === "radial-gradient") {
    return (
      <GradientEditor
        value={fill}
        onChange={(updated) => onUpdate(updated as FillEntry)}
      />
    );
  }
  if (fill.type === "image") {
    return (
      <>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] [color:var(--s-text-ter)]">URL</label>
          <input type="text" value={fill.src} onChange={(e) => onUpdate({ ...fill, src: e.target.value })}
            placeholder="https://..." className="h-6 px-1.5 text-[11px] bg-background border rounded w-full" />
        </div>
        <div className="flex flex-col gap-0.5">
          <label className="text-[10px] [color:var(--s-text-ter)]">Size</label>
          <select value={fill.size} onChange={(e) => onUpdate({ ...fill, size: e.target.value as "cover" | "contain" | "custom" })}
            className="h-6 px-1.5 text-[11px] bg-background border rounded">
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </>
    );
  }
  return null;
}

function FillsSection({
  style,
  onComplexChange,
  framework = "nextjs",
}: {
  style: NodeStyle;
  onComplexChange: (prop: string, value: unknown) => void;
  framework?: string;
}) {
  const fills = style.fills ?? [];
  const fillTypeOptions: { value: FillEntry["type"]; label: string }[] = [
    { value: "solid", label: "Solid" },
    { value: "linear-gradient", label: "Linear Gradient" },
    { value: "radial-gradient", label: "Radial Gradient" },
    { value: "image", label: "Image" },
  ].filter((o) => isFillTypeSupported(framework, o.value as FillType));

  const updateFills = useCallback((updated: NonNullable<NodeStyle["fills"]>) => {
    onComplexChange("fills", updated.length > 0 ? updated : undefined);
  }, [onComplexChange]);

  return (
    <StyleSection title="Fills">
      {fills.length > 0 && (
        <div className="space-y-1">
          {fills.map((fill, i) => (
            <FillRow
              key={i}
              fill={fill}
              onUpdate={(updated) => updateFills(fills.map((f, idx) => idx === i ? updated : f))}
              onRemove={() => updateFills(fills.filter((_, idx) => idx !== i))}
            />
          ))}
        </div>
      )}
      <select
        className="w-full h-7 px-2 text-[10px] bg-background border rounded [color:var(--s-text-ter)]"
        value=""
        onChange={(e) => {
          if (!e.target.value) return;
          const type = e.target.value as FillEntry["type"];
          const newFill: FillEntry = type === "solid"
            ? { type: "solid", color: "#000000", opacity: 1 }
            : type === "linear-gradient"
            ? { type: "linear-gradient", angle: 90, stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 1 }] }
            : type === "radial-gradient"
            ? { type: "radial-gradient", center: { x: 0.5, y: 0.5 }, stops: [{ color: "#000000", position: 0 }, { color: "#ffffff", position: 1 }] }
            : { type: "image", src: "", size: "cover" };
          updateFills([...fills, newFill]);
        }}
      >
        <option value="">+ Add fill</option>
        {fillTypeOptions.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </StyleSection>
  );
}

// ---------------------------------------------------------------------------
// Strokes Section (multiple strokes stack)
// ---------------------------------------------------------------------------

type StrokeEntry = NonNullable<NodeStyle["strokes"]>[number];

function StrokeRow({
  stroke,
  onUpdate,
  onRemove,
  positionOptions,
}: {
  stroke: StrokeEntry;
  onUpdate: (updated: StrokeEntry) => void;
  onRemove: () => void;
  positionOptions?: { value: StrokeEntry["position"]; label: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded [border:1px_solid_var(--s-border)]">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <div className="w-4 h-4 rounded shrink-0 border-2" style={{ borderColor: stroke.color }} />
        <span className="flex-1 text-[11px] cursor-pointer" onClick={() => setExpanded(!expanded)}>
          {stroke.color} · {stroke.width}px · {stroke.position}
        </span>
        <button onClick={() => setExpanded(!expanded)} className="[color:var(--s-text-ter)]">
          <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.1s" }}>
            <polyline points="3,2 7,5 3,8" />
          </svg>
        </button>
        <button onClick={onRemove} className="[color:var(--s-text-ter)] hover:[color:var(--s-text-pri)]">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="2" y1="2" x2="8" y2="8" /><line x1="8" y1="2" x2="2" y2="8" />
          </svg>
        </button>
      </div>
      {expanded && (
        <div className="px-2 pb-2 [border-top:1px_solid_var(--s-border)] pt-1.5 space-y-1.5">
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] [color:var(--s-text-ter)]">Color</label>
            <input type="color" value={stroke.color} onChange={(e) => onUpdate({ ...stroke, color: e.target.value })}
              className="h-7 w-full rounded border cursor-pointer" />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] [color:var(--s-text-ter)]">Width (px)</label>
              <input type="number" value={stroke.width} min={1}
                onChange={(e) => onUpdate({ ...stroke, width: Number(e.target.value) })}
                className="h-6 px-1.5 text-[11px] bg-background border rounded" />
            </div>
            <div className="flex flex-col gap-0.5">
              <label className="text-[10px] [color:var(--s-text-ter)]">Position</label>
              <select value={stroke.position} onChange={(e) => onUpdate({ ...stroke, position: e.target.value as StrokeEntry["position"] })}
                className="h-6 px-1 text-[11px] bg-background border rounded">
                {(positionOptions ?? [
                  { value: "center" as const, label: "Center" },
                  { value: "inside" as const, label: "Inside" },
                  { value: "outside" as const, label: "Outside" },
                ]).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] [color:var(--s-text-ter)] w-14 shrink-0">Opacity (%)</label>
            <input type="number" value={Math.round((stroke.opacity ?? 1) * 100)} min={0} max={100}
              onChange={(e) => onUpdate({ ...stroke, opacity: Number(e.target.value) / 100 })}
              className="flex-1 h-6 px-1.5 text-[11px] bg-background border rounded" />
          </div>
        </div>
      )}
    </div>
  );
}

function StrokesSection({
  style,
  onComplexChange,
  framework = "nextjs",
}: {
  style: NodeStyle;
  onComplexChange: (prop: string, value: unknown) => void;
  framework?: string;
}) {
  const strokes = style.strokes ?? [];
  const positionOptions: { value: StrokeEntry["position"]; label: string }[] = [
    { value: "center", label: "Center" },
    { value: "inside", label: "Inside" },
    { value: "outside", label: "Outside" },
  ].filter((o) => isStrokePositionSupported(framework, o.value as StrokePosition));

  const updateStrokes = useCallback((updated: NonNullable<NodeStyle["strokes"]>) => {
    onComplexChange("strokes", updated.length > 0 ? updated : undefined);
  }, [onComplexChange]);

  return (
    <StyleSection title="Strokes">
      {strokes.length > 0 && (
        <div className="space-y-1">
          {strokes.map((stroke, i) => (
            <StrokeRow
              key={i}
              stroke={stroke}
              onUpdate={(updated) => updateStrokes(strokes.map((s, idx) => idx === i ? updated : s))}
              onRemove={() => updateStrokes(strokes.filter((_, idx) => idx !== i))}
              positionOptions={positionOptions}
            />
          ))}
        </div>
      )}
      <button
        onClick={() => updateStrokes([...strokes, { color: "#000000", width: 1, position: "center", opacity: 1 }])}
        className="w-full h-7 text-[10px] [color:var(--s-text-ter)] bg-background border rounded hover:[color:var(--s-text-pri)] transition-colors"
      >
        + Add stroke
      </button>
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
