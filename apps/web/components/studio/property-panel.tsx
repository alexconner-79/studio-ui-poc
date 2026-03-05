"use client";

import React, { useCallback, useState, useMemo } from "react";
import NextImage from "next/image";
import { useEditorStore, generateId, cloneWithNewIds } from "@/lib/studio/store";
import { NODE_SCHEMAS, type PropDef, type PropGroup } from "@/lib/studio/node-schemas";
import type { Node, NodeInteractions, InteractionAction, InteractionChangeAction, VisibilityOperator, DataSource, DataSourceType } from "@/lib/studio/types";
import { IconPicker } from "./icon-picker";
import { toast } from "@/lib/studio/toast";
import { StylePanel } from "./style-sections";
import { ConstraintWidget } from "./spacing-overlay";
import { lintTree, type LintWarning } from "@/lib/studio/structure-linter";
import {
  computeAlignment,
  computeDistribution,
  getNodeBBoxes,
  type AlignDirection,
  type DistributeAxis,
} from "@/lib/studio/geometry";
import { getTextStyles } from "@/lib/studio/resolve-token";

// -------------------------------------------------------------------------
// Find node helper
// -------------------------------------------------------------------------

function findNode(root: Node, id: string): Node | null {
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

// -------------------------------------------------------------------------
// Field components
// -------------------------------------------------------------------------

function StringField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col [gap:3px]">
      <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col [gap:3px]">
      <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | number;
  options: { label: string; value: string | number | boolean }[];
  onChange: (v: string | number) => void;
}) {
  return (
    <div className="flex flex-col [gap:3px]">
      <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">
        {label}
      </label>
      <select
        value={String(value)}
        onChange={(e) => {
          const opt = options.find((o) => String(o.value) === e.target.value);
          if (opt) {
            onChange(
              typeof opt.value === "number" ? opt.value : String(opt.value)
            );
          }
        }}
        className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)] cursor-pointer"
      >
        {options.map((opt) => (
          <option key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function BooleanField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between [padding:3px_0]">
      <label className="[font-size:var(--s-text-sm)] [color:var(--s-text-sec)]">
        {label}
      </label>
      <div
        onClick={() => onChange(!value)}
        className={`
          relative cursor-pointer shrink-0
          [width:28px] [height:15px] [border-radius:8px]
          transition-colors [transition-duration:0.15s]
          ${value ? "[background:var(--s-accent)]" : "[background:var(--s-border-dark)]"}
          after:content-[''] after:absolute after:[width:11px] after:[height:11px]
          after:rounded-full after:bg-white after:[top:2px]
          after:[box-shadow:0_1px_3px_rgba(0,0,0,0.15)]
          after:transition-[left] after:[transition-duration:0.15s]
          ${value ? "after:[left:15px]" : "after:[left:2px]"}
        `.trim()}
      />
    </div>
  );
}

function ArrayField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: unknown[];
  onChange: (v: unknown[]) => void;
}) {
  const text = (value || []).map(String).join("\n");
  return (
    <div className="flex flex-col [gap:3px]">
      <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">
        {label} (one per line)
      </label>
      <textarea
        value={text}
        onChange={(e) => {
          const items = e.target.value
            .split("\n")
            .filter((line) => line.length > 0);
          onChange(items);
        }}
        rows={4}
        className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)] resize-y"
      />
    </div>
  );
}

// -------------------------------------------------------------------------
// Font family field (special dropdown that reads project fonts from store)
// -------------------------------------------------------------------------

function FontFamilyField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const projectFonts = useEditorStore((s) => s.projectFonts);

  return (
    <div className="flex flex-col [gap:3px]">
      <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">
        Font Family
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)] cursor-pointer"
      >
        <option value="">Default (inherit)</option>
        {projectFonts.map((font) => (
          <option key={font.family} value={font.family}>
            {font.family} ({font.source})
          </option>
        ))}
      </select>
      {projectFonts.length === 0 && (
        <p className="[font-size:var(--s-text-2xs)] [color:var(--s-text-ter)]">
          Add fonts via the Fonts panel in the left sidebar
        </p>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Prop field renderer
// -------------------------------------------------------------------------

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col [gap:3px]">
      <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">{label}</label>
      <div className="flex items-center [gap:6px]">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="[width:28px] [height:28px] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-sm)] cursor-pointer p-0 [background:transparent]"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
        />
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// findNodeById helper (local — avoids import from style-sections)
// -------------------------------------------------------------------------

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

// -------------------------------------------------------------------------
// PositionSizeWidget — compact X/Y/W/H grid shown near the top of the panel
// -------------------------------------------------------------------------

type SizeMode = "fixed" | "fill" | "hug";

const HUG_WIDTH_TYPES = new Set([
  "Button", "Badge", "Chip", "Icon", "Image", "Avatar", "Spinner",
  "Switch", "Heading", "Text", "Link", "Label",
  "ComponentInstance", "ExternalComponent",
]);

function inferDefaultSizeMode(
  nodeType: string,
  axis: "width" | "height",
  isRoot: boolean,
  style: Record<string, unknown>,
): SizeMode {
  if (isRoot) return "fixed";
  const modeKey = axis === "width" ? "widthMode" : "heightMode";
  if (style[modeKey]) return style[modeKey] as SizeMode;
  const dimVal = style[axis];
  if (dimVal != null && dimVal !== "") return "fixed";
  if (axis === "height") return "hug";
  return HUG_WIDTH_TYPES.has(nodeType) ? "hug" : "fill";
}

function SizeDimension({
  label,
  mode,
  value,
  onModeChange,
  onValueChange,
}: {
  label: string;
  mode: SizeMode;
  value: number;
  onModeChange: (m: SizeMode) => void;
  onValueChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col [gap:3px]">
      <div className="flex items-center justify-between">
        <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">
          {label}
        </label>
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as SizeMode)}
          className="[font-size:var(--s-text-2xs)] [color:var(--s-text-ter)] [background:transparent] border-none outline-none cursor-pointer"
        >
          <option value="fixed">Fixed</option>
          <option value="fill">Fill</option>
          <option value="hug">Hug</option>
        </select>
      </div>
      {mode === "fixed" ? (
        <input
          type="number"
          value={value}
          min={1}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (!isNaN(n) && n >= 1) onValueChange(n);
          }}
          className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
        />
      ) : (
        <div className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-ter)]">
          {mode === "fill" ? "100%" : "auto"}
        </div>
      )}
    </div>
  );
}

function PositionSizeWidget() {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const spec = useEditorStore((s) => s.spec);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);

  if (!selectedNodeId || !spec) return null;
  const node = findNodeById(spec.tree, selectedNodeId);
  if (!node) return null;

  const isRoot = selectedNodeId === spec.tree.id;
  const style = node.style ?? {};
  const isAbsolute = style.position === "absolute" || style.position === "fixed";

  const pxVal = (v: unknown): number => {
    const n = parseFloat(String(v ?? ""));
    return isNaN(n) ? 0 : Math.round(n);
  };

  const setPos = (prop: string, raw: number) => {
    updateNodeStyle(selectedNodeId, { [prop]: `${raw}px` } as Record<string, string>);
  };

  const handleModeChange = (axis: "width" | "height", m: SizeMode) => {
    const modeKey = axis === "width" ? "widthMode" : "heightMode";
    if (m === "fixed") {
      const el = document.querySelector(`[data-studio-node="${selectedNodeId}"]`) as HTMLElement | null;
      const rect = el?.getBoundingClientRect();
      const t = el?.closest("[data-canvas-transform]") as HTMLElement | null;
      const scaleMatch = t?.style.transform.match(/scale\(([\d.]+)\)/);
      const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
      const measured = axis === "width"
        ? Math.round((rect?.width ?? 100) / scale)
        : Math.round((rect?.height ?? 50) / scale);
      updateNodeStyle(selectedNodeId, {
        [modeKey]: undefined,
        [axis]: `${measured}px`,
      } as Record<string, string | undefined>);
    } else {
      updateNodeStyle(selectedNodeId, { [modeKey]: m, [axis]: undefined } as Record<string, string | undefined>);
    }
  };

  const handleSizeChange = (axis: "width" | "height", v: number) => {
    updateNodeStyle(selectedNodeId, { [axis]: `${v}px` } as Record<string, string>);
  };

  const wMode = inferDefaultSizeMode(node.type, "width", isRoot, style);
  const hMode = inferDefaultSizeMode(node.type, "height", isRoot, style);

  return (
    <div className="[padding:10px_12px] [border-bottom:1px_solid_var(--s-border)]">
      <div className="flex items-center justify-between [margin-bottom:8px]">
        <span className="[font-size:var(--s-text-2xs)] [font-weight:var(--s-weight-semibold)] [color:var(--s-text-ter)] uppercase tracking-wider">
          Position &amp; Size
        </span>
        {!isRoot && (
          <span className={`[font-size:var(--s-text-2xs)] [padding:1px_6px] [border-radius:var(--s-r-sm)] ${isAbsolute ? "[background:var(--s-accent)] text-white" : "[background:var(--s-bg-subtle)] [color:var(--s-text-ter)]"}`}>
            {style.position === "fixed" ? "Fixed" : isAbsolute ? "Absolute" : "Flow"}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {!isRoot && isAbsolute && (
          <>
            <NumberField label="X" value={pxVal(style.left)} onChange={(v) => setPos("left", v)} />
            <NumberField label="Y" value={pxVal(style.top)} onChange={(v) => setPos("top", v)} />
          </>
        )}
        {!isRoot && !isAbsolute && (
          <div className="col-span-2 [font-size:var(--s-text-2xs)] [color:var(--s-text-ter)] [padding:4px_0]">
            Set position to Absolute to use X/Y
          </div>
        )}
        <SizeDimension
          label="W"
          mode={wMode}
          value={pxVal(style.width)}
          onModeChange={(m) => handleModeChange("width", m)}
          onValueChange={(v) => handleSizeChange("width", v)}
        />
        <SizeDimension
          label="H"
          mode={hMode}
          value={pxVal(style.height)}
          onModeChange={(m) => handleModeChange("height", m)}
          onValueChange={(v) => handleSizeChange("height", v)}
        />
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// ColorTokenField — DS colour token selector for Component props
// -------------------------------------------------------------------------

function ColorTokenField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const designTokens = useEditorStore((s) => s.designTokens);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const colorEntries: Array<{ name: string; hex: string }> = React.useMemo(() => {
    if (!designTokens?.color) return [];
    return Object.entries(designTokens.color).map(([name, token]) => ({
      name,
      hex: String(token.value),
    }));
  }, [designTokens]);

  const currentEntry = colorEntries.find((e) => e.name === value);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Element)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="flex flex-col [gap:3px]">
      <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">
        {label}
      </label>
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none cursor-pointer text-left"
        >
          <span
            className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
            style={{
              background: currentEntry ? currentEntry.hex : "transparent",
              border: currentEntry ? "1px solid rgba(0,0,0,0.1)" : "1px dashed var(--s-border)",
            }}
          />
          <span className="flex-1 truncate">{currentEntry?.name || "None"}</span>
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50 [background:var(--s-bg-panel)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] shadow-lg overflow-hidden">
            <div className="max-h-48 overflow-y-auto py-1">
              <button
                type="button"
                onClick={() => { onChange(""); setOpen(false); }}
                className={`w-full flex items-center gap-2 [padding:4px_10px] [font-size:var(--s-text-sm)] text-left hover:[background:var(--s-bg-subtle)] ${!value ? "[background:var(--s-accent-soft)] [color:var(--s-accent)]" : "[color:var(--s-text-pri)]"}`}
              >
                <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ border: "1px dashed var(--s-border)" }} />
                <span>None</span>
              </button>
              {colorEntries.map((entry) => (
                <button
                  key={entry.name}
                  type="button"
                  onClick={() => { onChange(entry.name); setOpen(false); }}
                  className={`w-full flex items-center gap-2 [padding:4px_10px] [font-size:var(--s-text-sm)] text-left hover:[background:var(--s-bg-subtle)] ${value === entry.name ? "[background:var(--s-accent-soft)] [color:var(--s-accent)]" : "[color:var(--s-text-pri)]"}`}
                >
                  <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ background: entry.hex, border: "1px solid rgba(0,0,0,0.1)" }} />
                  <span className="flex-1 truncate">{entry.name}</span>
                  <span className="[font-size:var(--s-text-2xs)] [color:var(--s-text-ter)] font-mono">{entry.hex}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PropField({
  propKey,
  def,
  value,
  onChange,
  nodeType,
}: {
  propKey: string;
  def: PropDef;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  nodeType?: string;
}) {
  const isModified = value !== undefined && value !== def.defaultValue;

  // Wrap the field in a row that shows a reset button on hover when modified
  const wrap = (field: React.ReactNode) => (
    <div className="group relative" title={def.description}>
      {field}
      {isModified && def.defaultValue !== undefined && (
        <button
          onClick={() => onChange(propKey, def.defaultValue)}
          title="Reset to default"
          className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity [font-size:var(--s-text-2xs)] [color:var(--s-text-ter)] hover:[color:var(--s-accent)] px-0.5"
        >
          ↺
        </button>
      )}
    </div>
  );

  // Color fields for fill/stroke props
  const colorProps = ["fill", "stroke"];
  if (colorProps.includes(propKey) && def.type === "string") {
    return wrap(
      <ColorField
        label={def.label}
        value={value !== undefined ? String(value) : String(def.defaultValue ?? "")}
        onChange={(v) => onChange(propKey, v)}
      />
    );
  }

  // DS colour token selector
  if (def.type === "colorToken") {
    return wrap(<ColorTokenField label={def.label} value={value !== undefined ? String(value) : ""} onChange={(v) => onChange(propKey, v)} />);
  }

  // Special handling for icon name on Icon nodes
  if (propKey === "name" && nodeType === "Icon") {
    return wrap(
      <IconPicker
        value={value !== undefined ? String(value) : String(def.defaultValue ?? "Star")}
        onChange={(v) => onChange(propKey, v)}
      />
    );
  }

  if (def.options) {
    return wrap(
      <SelectField
        label={def.label}
        value={value !== undefined ? (value as string | number) : (def.defaultValue as string | number) ?? ""}
        options={def.options}
        onChange={(v) => onChange(propKey, v)}
      />
    );
  }

  switch (def.type) {
    case "string":
      return wrap(
        <StringField
          label={def.label}
          value={value !== undefined ? String(value) : String(def.defaultValue ?? "")}
          onChange={(v) => onChange(propKey, v)}
        />
      );
    case "number":
      return wrap(
        <NumberField
          label={def.label}
          value={value !== undefined ? Number(value) : Number(def.defaultValue ?? 0)}
          onChange={(v) => onChange(propKey, v)}
        />
      );
    case "boolean":
      return wrap(
        <BooleanField
          label={def.label}
          value={value !== undefined ? Boolean(value) : Boolean(def.defaultValue ?? false)}
          onChange={(v) => onChange(propKey, v)}
        />
      );
    case "array":
      return wrap(
        <ArrayField
          label={def.label}
          value={Array.isArray(value) ? value : (def.defaultValue as unknown[]) ?? []}
          onChange={(v) => onChange(propKey, v)}
        />
      );
    default:
      return null;
  }
}

// Group order for the prop panel sections
const GROUP_ORDER: PropGroup[] = ["Content", "Style", "Layout", "Behaviour", "Advanced"];

function PropsPanel({
  propDefs,
  nodeProps,
  nodeType,
  onChange,
}: {
  propDefs: Record<string, PropDef>;
  nodeProps: Record<string, unknown>;
  nodeType: string;
  onChange: (key: string, value: unknown) => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Separate hidden props → Advanced group; visible props by group
  const grouped = useMemo(() => {
    const buckets: Record<string, Array<[string, PropDef]>> = {
      ungrouped: [],
      Content: [],
      Style: [],
      Layout: [],
      Behaviour: [],
      Advanced: [],
    };
    for (const [key, def] of Object.entries(propDefs)) {
      if (def.hidden) {
        buckets.Advanced.push([key, def]);
      } else if (def.group) {
        buckets[def.group].push([key, def]);
      } else {
        buckets.ungrouped.push([key, def]);
      }
    }
    return buckets;
  }, [propDefs]);

  const renderPairs = (pairs: Array<[string, PropDef]>) =>
    pairs.map(([key, def]) => (
      <PropField
        key={key}
        propKey={key}
        def={def}
        value={nodeProps[key]}
        onChange={onChange}
        nodeType={nodeType}
      />
    ));

  return (
    <div className="flex flex-col">
      {/* Ungrouped props (legacy / no group set) */}
      {grouped.ungrouped.length > 0 && (
        <div className="[padding:10px_12px] [border-bottom:1px_solid_var(--s-border)] flex flex-col [gap:8px]">
          <div className="[font-size:var(--s-text-2xs)] [font-weight:var(--s-weight-semibold)] [color:var(--s-text-ter)] uppercase tracking-wider">
            Component
          </div>
          {renderPairs(grouped.ungrouped)}
        </div>
      )}

      {/* Grouped sections */}
      {GROUP_ORDER.filter((g) => g !== "Advanced").map((group) => {
        const pairs = grouped[group];
        if (!pairs || pairs.length === 0) return null;
        return (
          <PropGroupSection key={group} title={group} defaultOpen={group === "Content" || group === "Style"}>
            {renderPairs(pairs)}
          </PropGroupSection>
        );
      })}

      {/* Advanced section (hidden props) — collapsed by default */}
      {grouped.Advanced.length > 0 && (
        <div className="[border-top:1px_solid_var(--s-border)] [padding:8px_12px]">
          <button
            onClick={() => setAdvancedOpen(!advancedOpen)}
            className="flex items-center justify-between w-full [font-size:var(--s-text-2xs)] [font-weight:var(--s-weight-semibold)] [color:var(--s-text-ter)] uppercase tracking-wider"
          >
            <span>Advanced</span>
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: advancedOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
              <polyline points="3,2 7,5 3,8" />
            </svg>
          </button>
          {advancedOpen && (
            <div className="flex flex-col [gap:8px] mt-2">
              {renderPairs(grouped.Advanced)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PropGroupSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="[border-top:1px_solid_var(--s-border)] [padding:8px_12px]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full [margin-bottom:6px] [font-size:var(--s-text-2xs)] [font-weight:var(--s-weight-semibold)] [color:var(--s-text-ter)] uppercase tracking-wider"
      >
        <span>{title}</span>
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
          <polyline points="3,2 7,5 3,8" />
        </svg>
      </button>
      {open && <div className="flex flex-col [gap:8px]">{children}</div>}
    </div>
  );
}

// -------------------------------------------------------------------------
// Interactions section (7.5)
// -------------------------------------------------------------------------

function InteractionsSection({
  interactions,
  onChange,
}: {
  interactions: NodeInteractions | undefined;
  onChange: (interactions: NodeInteractions | undefined) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const i = interactions ?? {};

  const updateOnClick = (field: string, value: string) => {
    const onClick = { ...i.onClick, action: (i.onClick?.action ?? "navigate") as InteractionAction, [field]: value };
    onChange({ ...i, onClick });
  };

  const updateOnChange = (field: string, value: string) => {
    const oc = { ...i.onChange, action: (i.onChange?.action ?? "setState") as InteractionChangeAction, [field]: value };
    onChange({ ...i, onChange: oc });
  };

  const updateVisibleWhen = (field: string, value: string) => {
    const vw = {
      state: i.visibleWhen?.state ?? "",
      operator: (i.visibleWhen?.operator ?? "truthy") as VisibilityOperator,
      value: i.visibleWhen?.value,
      [field]: value,
    };
    onChange({ ...i, visibleWhen: vw });
  };

  const clearInteractions = () => onChange(undefined);

  return (
    <div className="[border-top:1px_solid_var(--s-border)] [padding:10px_12px]">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between cursor-pointer select-none [margin-bottom:8px]"
      >
        <span className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-semibold)] uppercase [letter-spacing:var(--s-tracking-wide)] [color:var(--s-text-ter)]">
          Interactions
        </span>
        <span className="[font-size:8px] [color:var(--s-text-ter)]">{expanded ? "▾" : "▸"}</span>
      </div>
      {expanded && (
        <div className="flex flex-col [gap:8px]">
          {/* onClick */}
          <div className="flex flex-col [gap:3px]">
            <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">onClick</label>
            <select
              value={i.onClick?.action ?? ""}
              onChange={(e) => {
                if (!e.target.value) {
                  const { onClick: _, ...rest } = i;
                  onChange(Object.keys(rest).length > 0 ? rest : undefined);
                } else {
                  updateOnClick("action", e.target.value);
                }
              }}
              className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
            >
              <option value="">None</option>
              <option value="navigate">Navigate to URL</option>
              <option value="toggleVisibility">Toggle visibility</option>
              <option value="custom">Custom code</option>
            </select>
            {i.onClick?.action === "navigate" && (
              <input
                type="text"
                value={i.onClick.target ?? ""}
                onChange={(e) => updateOnClick("target", e.target.value)}
                placeholder="/page-url"
                className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
              />
            )}
            {i.onClick?.action === "toggleVisibility" && (
              <input
                type="text"
                value={i.onClick.target ?? ""}
                onChange={(e) => updateOnClick("target", e.target.value)}
                placeholder="State variable name"
                className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
              />
            )}
            {i.onClick?.action === "custom" && (
              <textarea
                value={i.onClick.code ?? ""}
                onChange={(e) => updateOnClick("code", e.target.value)}
                placeholder="console.log('clicked')"
                rows={2}
                className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] font-mono [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)] resize-y"
              />
            )}
          </div>

          {/* onChange */}
          <div className="flex flex-col [gap:3px]">
            <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">onChange</label>
            <select
              value={i.onChange?.action ?? ""}
              onChange={(e) => {
                if (!e.target.value) {
                  const { onChange: _, ...rest } = i;
                  onChange(Object.keys(rest).length > 0 ? rest : undefined);
                } else {
                  updateOnChange("action", e.target.value);
                }
              }}
              className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
            >
              <option value="">None</option>
              <option value="setState">Set state</option>
              <option value="custom">Custom code</option>
            </select>
            {i.onChange?.action === "setState" && (
              <input
                type="text"
                value={i.onChange.target ?? ""}
                onChange={(e) => updateOnChange("target", e.target.value)}
                placeholder="State variable name"
                className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
              />
            )}
            {i.onChange?.action === "custom" && (
              <textarea
                value={i.onChange.code ?? ""}
                onChange={(e) => updateOnChange("code", e.target.value)}
                placeholder="console.log(e.target.value)"
                rows={2}
                className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] font-mono [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)] resize-y"
              />
            )}
          </div>

          {/* visibleWhen */}
          <div className="flex flex-col [gap:3px]">
            <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">Visible when</label>
            <input
              type="text"
              value={i.visibleWhen?.state ?? ""}
              onChange={(e) => updateVisibleWhen("state", e.target.value)}
              placeholder="State variable name"
              className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
            />
            {i.visibleWhen?.state && (
              <div className="flex gap-1">
                <select
                  value={i.visibleWhen.operator ?? "truthy"}
                  onChange={(e) => updateVisibleWhen("operator", e.target.value)}
                  className="flex-1 [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
                >
                  <option value="truthy">is truthy</option>
                  <option value="eq">equals</option>
                  <option value="neq">not equals</option>
                </select>
                {(i.visibleWhen.operator === "eq" || i.visibleWhen.operator === "neq") && (
                  <input
                    type="text"
                    value={i.visibleWhen.value ?? ""}
                    onChange={(e) => updateVisibleWhen("value", e.target.value)}
                    placeholder="value"
                    className="flex-1 [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
                  />
                )}
              </div>
            )}
          </div>

          {interactions && (
            <button
              onClick={clearInteractions}
              className="[font-size:var(--s-text-xs)] [color:var(--s-danger)] hover:underline bg-transparent border-none cursor-pointer [padding:0]"
            >
              Clear all interactions
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Data binding section (7.6)
// -------------------------------------------------------------------------

const MOCK_DATA_TEMPLATES: Record<string, unknown[]> = {
  users: [
    { name: "Alice Johnson", email: "alice@example.com", role: "Admin" },
    { name: "Bob Smith", email: "bob@example.com", role: "User" },
    { name: "Carol White", email: "carol@example.com", role: "Editor" },
    { name: "David Brown", email: "david@example.com", role: "User" },
  ],
  products: [
    { name: "Widget A", price: "$29.99", category: "Tools" },
    { name: "Widget B", price: "$49.99", category: "Electronics" },
    { name: "Widget C", price: "$19.99", category: "Tools" },
  ],
  orders: [
    { id: "#1001", customer: "Alice", amount: "$150.00", status: "Shipped" },
    { id: "#1002", customer: "Bob", amount: "$89.00", status: "Pending" },
    { id: "#1003", customer: "Carol", amount: "$210.00", status: "Delivered" },
  ],
};

function DataBindingSection({
  dataSource,
  onChange,
  nodeType,
}: {
  dataSource: DataSource | undefined;
  onChange: (ds: DataSource | undefined) => void;
  nodeType: string;
}) {
  const [expanded, setExpanded] = useState(false);

  // Only show for List and DataTable
  if (nodeType !== "List" && nodeType !== "DataTable") return null;

  const ds = dataSource ?? { type: "static" as DataSourceType };

  const updateField = (field: string, value: unknown) => {
    onChange({ ...ds, [field]: value });
  };

  return (
    <div className="[border-top:1px_solid_var(--s-border)] [padding:10px_12px]">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between cursor-pointer select-none [margin-bottom:8px]"
      >
        <span className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-semibold)] uppercase [letter-spacing:var(--s-tracking-wide)] [color:var(--s-text-ter)]">
          Data Source
        </span>
        <span className="[font-size:8px] [color:var(--s-text-ter)]">{expanded ? "▾" : "▸"}</span>
      </div>
      {expanded && (
        <div className="flex flex-col [gap:8px]">
          <select
            value={ds.type}
            onChange={(e) => {
              const newType = e.target.value as DataSourceType;
              if (newType === "mock") {
                onChange({ type: "mock", data: MOCK_DATA_TEMPLATES.users });
              } else {
                onChange({ ...ds, type: newType });
              }
            }}
            className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)] cursor-pointer"
          >
            <option value="static">Static data</option>
            <option value="mock">Mock data</option>
            <option value="api">API endpoint</option>
          </select>

          {ds.type === "static" && (
            <div className="flex flex-col [gap:3px]">
              <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">JSON data array</label>
              <textarea
                value={JSON.stringify(ds.data ?? [], null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    if (Array.isArray(parsed)) updateField("data", parsed);
                  } catch { /* ignore parse errors while typing */ }
                }}
                rows={5}
                className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] font-mono [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)] resize-y"
              />
            </div>
          )}

          {ds.type === "mock" && (
            <div className="flex flex-col [gap:3px]">
              <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">Template</label>
              <select
                onChange={(e) => {
                  const template = MOCK_DATA_TEMPLATES[e.target.value];
                  if (template) onChange({ ...ds, data: template });
                }}
                className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
              >
                <option value="users">Users</option>
                <option value="products">Products</option>
                <option value="orders">Orders</option>
              </select>
              <pre className="[font-size:var(--s-text-2xs)] font-mono [background:var(--s-bg-subtle)] [padding:6px] [border-radius:var(--s-r-md)] max-h-20 overflow-y-auto [color:var(--s-text-sec)]">
                {JSON.stringify(ds.data ?? [], null, 2)}
              </pre>
            </div>
          )}

          {ds.type === "api" && (
            <div className="flex flex-col [gap:3px]">
              <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">API URL</label>
              <input
                type="text"
                value={ds.url ?? ""}
                onChange={(e) => updateField("url", e.target.value)}
                placeholder="https://api.example.com/data"
                className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
              />
            </div>
          )}

          {dataSource && (
            <button
              onClick={() => onChange(undefined)}
              className="[font-size:var(--s-text-xs)] [color:var(--s-danger)] hover:underline bg-transparent border-none cursor-pointer [padding:0]"
            >
              Remove data source
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Alignment button
// -------------------------------------------------------------------------

const ALIGN_ICONS: Record<string, React.ReactNode> = {
  "align-left": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="1" x2="1" y2="13" /><rect x="3" y="3" width="8" height="3" rx="0.5" /><rect x="3" y="8" width="5" height="3" rx="0.5" />
    </svg>
  ),
  "align-center-h": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="7" y1="1" x2="7" y2="13" strokeDasharray="1.5 1.5" /><rect x="2" y="3" width="10" height="3" rx="0.5" /><rect x="3.5" y="8" width="7" height="3" rx="0.5" />
    </svg>
  ),
  "align-right": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="13" y1="1" x2="13" y2="13" /><rect x="3" y="3" width="8" height="3" rx="0.5" /><rect x="6" y="8" width="5" height="3" rx="0.5" />
    </svg>
  ),
  "align-top": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="1" x2="13" y2="1" /><rect x="3" y="3" width="3" height="8" rx="0.5" /><rect x="8" y="3" width="3" height="5" rx="0.5" />
    </svg>
  ),
  "align-center-v": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="7" x2="13" y2="7" strokeDasharray="1.5 1.5" /><rect x="3" y="2" width="3" height="10" rx="0.5" /><rect x="8" y="3.5" width="3" height="7" rx="0.5" />
    </svg>
  ),
  "align-bottom": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="13" x2="13" y2="13" /><rect x="3" y="3" width="3" height="8" rx="0.5" /><rect x="8" y="6" width="3" height="5" rx="0.5" />
    </svg>
  ),
  "distribute-h": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="1" x2="1" y2="13" /><line x1="13" y1="1" x2="13" y2="13" /><rect x="4" y="4" width="2.5" height="6" rx="0.5" /><rect x="7.5" y="4" width="2.5" height="6" rx="0.5" />
    </svg>
  ),
  "distribute-v": (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="1" y1="1" x2="13" y2="1" /><line x1="1" y1="13" x2="13" y2="13" /><rect x="4" y="4" width="6" height="2.5" rx="0.5" /><rect x="4" y="7.5" width="6" height="2.5" rx="0.5" />
    </svg>
  ),
};

function AlignButton({
  label,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center justify-center gap-1.5 [padding:5px_6px] [font-size:var(--s-text-2xs)] [border-radius:var(--s-r-md)] [border:1px_solid_var(--s-border)] transition-colors ${
        disabled
          ? "[color:var(--s-text-ter)] cursor-not-allowed [opacity:0.5]"
          : "[color:var(--s-text-sec)] hover:[background:var(--s-accent-soft)] hover:[color:var(--s-accent)] cursor-pointer"
      }`}
    >
      {ALIGN_ICONS[icon]}
      <span className="truncate">{label}</span>
    </button>
  );
}

// -------------------------------------------------------------------------
// Compile Health (structure linter)
// -------------------------------------------------------------------------

function CompileHealthSection() {
  const spec = useEditorStore((s) => s.spec);
  const updateNode = useEditorStore((s) => s.updateNode);
  const groupIntoStack = useEditorStore((s) => s.groupIntoStack);
  const selectNode = useEditorStore((s) => s.selectNode);
  const [open, setOpen] = useState(false);

  const warnings = useMemo<LintWarning[]>(() => {
    if (!spec) return [];
    return lintTree(spec.tree);
  }, [spec]);

  if (warnings.length === 0) return null;

  return (
    <div className="[border-bottom:1px_solid_var(--s-border)]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between [padding:8px_12px] [font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-warning)] [background:transparent] border-none cursor-pointer hover:[background:var(--s-bg-hover)]"
      >
        <span>Compile Health ({warnings.length})</span>
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="flex flex-col [gap:1px] [padding:0_12px_8px]">
          {warnings.map((w, i) => (
            <div key={i} className="flex flex-col [gap:4px] [padding:6px_8px] [background:var(--s-bg-subtle)] [border-radius:var(--s-r-sm)]">
              <div className="flex items-start [gap:6px]">
                <span className="[font-size:10px] mt-0.5">{w.severity === "warning" ? "⚠" : "ℹ"}</span>
                <div className="flex-1 [font-size:var(--s-text-xs)] [color:var(--s-text-sec)]">
                  <span className="[font-weight:var(--s-weight-medium)] [color:var(--s-text-pri)] cursor-pointer hover:underline" onClick={() => selectNode(w.nodeId)}>
                    {w.nodeName}
                  </span>
                  <span className="ml-1">{w.message}</span>
                </div>
              </div>
              <button
                onClick={() => {
                  selectNode(w.nodeId);
                  if (w.fixAction === "wrap-in-frame") groupIntoStack();
                  else if (w.fixAction === "convert-type" && w.fixPayload?.targetType) {
                    updateNode(w.nodeId, { type: w.fixPayload.targetType as string });
                  }
                }}
                className="self-end [padding:2px_8px] [font-size:10px] [color:var(--s-accent)] [background:var(--s-accent-soft)] border-none [border-radius:var(--s-r-sm)] cursor-pointer hover:opacity-80"
              >
                {w.fixLabel}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// DS Component Variant + State section (0.10.4)
// -------------------------------------------------------------------------

type VariantGroup = { name: string; options: string[]; default: string };
type DsComponentState = "default" | "hover" | "pressed" | "focus" | "disabled";
type DsComponentProp = { name: string; label?: string; type: string; default?: string | number | boolean; options?: string[]; description?: string };

function DSComponentVariantSection({
  dsComponentName,
  selectedVariants,
  componentProps = {},
  importPath,
  hasChildren,
  onVariantChange,
  onPropChange,
  onRestoreTemplate,
  onDetach,
}: {
  dsComponentName: string;
  selectedVariants: Record<string, string>;
  componentProps?: Record<string, unknown>;
  importPath?: string;
  hasChildren?: boolean;
  onVariantChange: (variants: Record<string, string>) => void;
  onPropChange?: (key: string, value: unknown) => void;
  onRestoreTemplate?: (children: unknown[]) => void;
  onDetach?: () => void;
}) {
  const dsComponents = useEditorStore((s) => s.dsComponents);
  const [previewState, setPreviewState] = useState<string>("default");
  const [restoring, setRestoring] = useState(false);

  const compDef = dsComponents.find((c) => c.name === dsComponentName);
  if (!compDef) return null;

  const variants = (compDef.variants ?? []) as VariantGroup[];
  const states = (compDef.states ?? []) as DsComponentState[];
  const typedProps = (compDef.props ?? []) as DsComponentProp[];

  if (variants.length === 0 && states.length === 0 && typedProps.length === 0) return null;

  const handleRestoreTemplate = async () => {
    if (!onRestoreTemplate || restoring) return;
    setRestoring(true);
    try {
      // 1. Try the stored defaultTemplate (available when starter was re-applied after v0.10.4)
      if (compDef.defaultTemplate) {
        const tpl = compDef.defaultTemplate as Record<string, unknown>;
        const children = Array.isArray(tpl.children) ? tpl.children : [];
        if (children.length > 0) { onRestoreTemplate(children); return; }
      }

      // 2. Fetch from starter spec — scoped by importPath if available, else search all starters
      const params = new URLSearchParams({ component: dsComponentName });
      // Also try compDef.importPath as fallback when the node itself has no importPath
      const resolvedImportPath = importPath ?? (compDef.importPath as string | undefined);
      if (resolvedImportPath) params.set("importPath", resolvedImportPath);

      const res = await fetch(`/api/studio/ds-starters?${params.toString()}`);
      if (res.ok) {
        const data = await res.json() as { defaultTemplate?: Record<string, unknown> | null };
        const tpl = data.defaultTemplate;
        const children = tpl && Array.isArray(tpl.children) ? tpl.children : [];
        if (children.length > 0) { onRestoreTemplate(children); return; }
      }

      toast.error(`No default template found for "${dsComponentName}"`);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="[border-top:1px_solid_var(--s-border)] [padding:10px_12px] flex flex-col [gap:10px]">
      <div className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-semibold)] uppercase [letter-spacing:var(--s-tracking-wide)] [color:var(--s-text-ter)]">
        Component · {dsComponentName}
      </div>

      {/* Variant groups */}
      {variants.map((group) => (
        <div key={group.name} className="flex flex-col [gap:4px]">
          <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">
            {group.name}
          </label>
          <div className="flex flex-wrap [gap:4px]">
            {group.options.map((opt) => {
              const isActive = (selectedVariants[group.name] ?? group.default) === opt;
              return (
                <button
                  key={opt}
                  onClick={() => onVariantChange({ ...selectedVariants, [group.name]: opt })}
                  className={`[padding:2px_8px] [font-size:var(--s-text-xs)] [border-radius:var(--s-r-sm)] border transition-colors cursor-pointer ${
                    isActive
                      ? "[background:var(--s-accent)] text-white border-transparent [font-weight:var(--s-weight-medium)]"
                      : "[background:transparent] [color:var(--s-text-sec)] [border-color:var(--s-border)] hover:[background:var(--s-bg-hover)]"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* State preview (editor-only, not persisted) */}
      {states.length > 0 && (
        <div className="flex flex-col [gap:4px]">
          <label className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">
            Preview state
          </label>
          <select
            value={previewState}
            onChange={(e) => setPreviewState(e.target.value)}
            className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)] cursor-pointer"
          >
            <option value="default">default</option>
            {states.filter((s) => s !== "default").map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <p className="[font-size:var(--s-text-2xs)] [color:var(--s-text-ter)]">
            State preview is editor-only and not saved to the spec
          </p>
        </div>
      )}

      {/* Typed props — editable inputs when onPropChange is provided, read-only reference otherwise */}
      {typedProps.filter((p) => p.type !== "node").length > 0 && (
        <div className="flex flex-col [gap:6px]">
          <div className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">Props</div>
          <div className="flex flex-col [gap:6px]">
            {typedProps.filter((p) => p.type !== "node").map((prop) => {
              const currentValue = componentProps[prop.name] ?? prop.default;
              if (!onPropChange) {
                return (
                  <div key={prop.name} className="flex items-center justify-between [padding:2px_0]">
                    <span className="[font-size:var(--s-text-xs)] [color:var(--s-text-sec)] truncate">
                      {prop.label ?? prop.name}
                      <span className="ml-1 [font-size:var(--s-text-2xs)] [color:var(--s-text-ter)] font-mono">:{prop.type}</span>
                    </span>
                    <span className="[font-size:var(--s-text-2xs)] [color:var(--s-text-ter)] font-mono ml-2 shrink-0">
                      {String(prop.default ?? "—")}
                    </span>
                  </div>
                );
              }
              // Editable mode
              if (prop.type === "boolean") {
                return (
                  <div key={prop.name} className="flex items-center justify-between">
                    <label className="[font-size:var(--s-text-xs)] [color:var(--s-text-sec)]">{prop.label ?? prop.name}</label>
                    <input
                      type="checkbox"
                      checked={Boolean(currentValue)}
                      onChange={(e) => onPropChange(prop.name, e.target.checked)}
                      className="cursor-pointer accent-[var(--s-accent)]"
                    />
                  </div>
                );
              }
              if (prop.options && prop.options.length > 0) {
                return (
                  <div key={prop.name} className="flex flex-col [gap:3px]">
                    <label className="[font-size:var(--s-text-xs)] [color:var(--s-text-sec)]">{prop.label ?? prop.name}</label>
                    <select
                      value={String(currentValue ?? "")}
                      onChange={(e) => onPropChange(prop.name, e.target.value)}
                      className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)] cursor-pointer"
                    >
                      {prop.options.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                );
              }
              if (prop.type === "number") {
                return (
                  <div key={prop.name} className="flex flex-col [gap:3px]">
                    <label className="[font-size:var(--s-text-xs)] [color:var(--s-text-sec)]">{prop.label ?? prop.name}</label>
                    <input
                      type="number"
                      value={currentValue != null ? Number(currentValue) : ""}
                      onChange={(e) => onPropChange(prop.name, e.target.value === "" ? undefined : Number(e.target.value))}
                      className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
                    />
                  </div>
                );
              }
              // string / default
              return (
                <div key={prop.name} className="flex flex-col [gap:3px]">
                  <label className="[font-size:var(--s-text-xs)] [color:var(--s-text-sec)]">{prop.label ?? prop.name}</label>
                  <input
                    type="text"
                    value={String(currentValue ?? "")}
                    onChange={(e) => onPropChange(prop.name, e.target.value)}
                    placeholder={String(prop.default ?? "")}
                    className="w-full [padding:4px_7px] [font-size:var(--s-text-sm)] [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-md)] [color:var(--s-text-pri)] outline-none focus:[border-color:var(--s-accent)]"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Restore default structure */}
      {onRestoreTemplate && (
        <button
          onClick={() => {
            if (hasChildren) {
              if (!confirm("Replace current children with the default template? This cannot be undone.")) return;
            }
            handleRestoreTemplate();
          }}
          disabled={restoring}
          className="w-full [padding:5px_10px] [font-size:var(--s-text-xs)] [border-radius:var(--s-r-md)] [border:1px_dashed_var(--s-accent)] [color:var(--s-accent)] [background:transparent] hover:[background:var(--s-accent)]/10 transition-colors cursor-pointer disabled:opacity-50"
        >
          {restoring ? "Restoring…" : "Reset to default structure"}
        </button>
      )}

      {/* Detach instance */}
      {onDetach && (
        <button
          onClick={() => {
            if (confirm("Detach this instance? It will become a plain Frame and lose its component binding. This cannot be undone.")) {
              onDetach();
            }
          }}
          className="w-full [padding:5px_10px] [font-size:var(--s-text-xs)] [border-radius:var(--s-r-md)] [border:1px_solid_var(--s-border)] [color:var(--s-text-ter)] [background:transparent] hover:[background:var(--s-bg-hover)] hover:[color:var(--s-text-sec)] transition-colors cursor-pointer"
        >
          Detach instance
        </button>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Property panel
// -------------------------------------------------------------------------

// -------------------------------------------------------------------------
// No-selection panel: token quick-reference
// -------------------------------------------------------------------------

function NoSelectionPanel() {
  const designTokens = useEditorStore((s) => s.designTokens);

  const colorTokens = designTokens?.color ? Object.entries(designTokens.color).slice(0, 8) : [];
  const spacingTokens = designTokens?.spacing ? Object.entries(designTokens.spacing).slice(0, 6) : [];

  return (
    <div className="flex flex-col h-full">
      <div className="[padding:10px_12px] [border-bottom:1px_solid_var(--s-border)] [font-size:var(--s-text-sm)] [font-weight:var(--s-weight-semibold)] [color:var(--s-text-pri)]">
        Design
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="[padding:10px_12px]">
          <p className="[font-size:var(--s-text-xs)] [color:var(--s-text-ter)] mb-3">
            Select a node to edit its properties
          </p>
          {(colorTokens.length > 0 || spacingTokens.length > 0) && (
            <>
              <p className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)] mb-2 uppercase tracking-wide">
                Design Tokens
              </p>
              {colorTokens.length > 0 && (
                <div className="mb-3">
                  <p className="[font-size:var(--s-text-2xs)] [color:var(--s-text-ter)] mb-1.5">Colors</p>
                  <div className="flex flex-wrap gap-1.5">
                    {colorTokens.map(([name, token]) => (
                      <div
                        key={name}
                        className="flex items-center gap-1 [padding:2px_6px_2px_4px] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-full)] [font-size:var(--s-text-2xs)] [color:var(--s-text-sec)]"
                        title={`${name}: ${token.value}`}
                      >
                        <div className="w-3 h-3 rounded-full border border-black/10" style={{ background: token.value }} />
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {spacingTokens.length > 0 && (
                <div>
                  <p className="[font-size:var(--s-text-2xs)] [color:var(--s-text-ter)] mb-1.5">Spacing</p>
                  <div className="flex flex-wrap gap-1.5">
                    {spacingTokens.map(([name, token]) => (
                      <div
                        key={name}
                        className="[padding:2px_6px] [border:1px_solid_var(--s-border)] [border-radius:var(--s-r-full)] [font-size:var(--s-text-2xs)] [color:var(--s-text-sec)] font-mono"
                        title={`${name}: ${token.value}`}
                      >
                        {name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------

export function PropertyPanel() {
  const spec = useEditorStore((s) => s.spec);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const selectedNodeIds = useEditorStore((s) => s.selectedNodeIds);
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const updateNode = useEditorStore((s) => s.updateNode);
  const lockedNodeIds = useEditorStore((s) => s.lockedNodeIds);
  const toggleNodeCompile = useEditorStore((s) => s.toggleNodeCompile);
  const groupSelectedIntoFrame = useEditorStore((s) => s.groupSelectedIntoFrame);
  const designTokens = useEditorStore((s) => s.designTokens);
  const dsComponents = useEditorStore((s) => s.dsComponents);

  const allSelectedIds = useMemo(() => {
    const ids: string[] = [];
    if (selectedNodeId) ids.push(selectedNodeId);
    selectedNodeIds.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    return ids;
  }, [selectedNodeId, selectedNodeIds]);

  const isMultiSelect = allSelectedIds.length >= 2;

  const selectedNode =
    spec && selectedNodeId ? findNode(spec.tree, selectedNodeId) : null;

  const isLocked = selectedNodeId ? lockedNodeIds.has(selectedNodeId) : false;
  const isDesignOnly = selectedNode?.compile === false;

  const handlePropChange = useCallback(
    (key: string, value: unknown) => {
      if (!selectedNodeId) return;
      updateNodeProps(selectedNodeId, { [key]: value });

      // Auto-apply matching DS text style when Heading level changes
      // level prop is a number (1-6), so build e.g. "H1", "H2"
      if (key === "level" && selectedNode?.type === "Heading") {
        const tsName = `H${Number(value)}`;
        const textStyles = getTextStyles(designTokens);
        const ts = textStyles.find((t) => t.name === tsName);
        if (ts) {
          const styleUpdate: Record<string, string> = {};
          if (ts.fontSize) styleUpdate.fontSize = ts.fontSize;
          if (ts.fontWeight) styleUpdate.fontWeight = ts.fontWeight;
          if (ts.lineHeight) styleUpdate.lineHeight = ts.lineHeight;
          if (ts.letterSpacing) styleUpdate.letterSpacing = ts.letterSpacing;
          if (ts.fontFamily) styleUpdate.fontFamily = ts.fontFamily;
          if (Object.keys(styleUpdate).length > 0) {
            updateNodeStyle(selectedNodeId, styleUpdate);
          }
        }
      }
    },
    [selectedNodeId, selectedNode?.type, designTokens, updateNodeProps, updateNodeStyle]
  );

  const handleInteractionsChange = useCallback(
    (interactions: NodeInteractions | undefined) => {
      if (!selectedNodeId) return;
      updateNode(selectedNodeId, { interactions });
    },
    [selectedNodeId, updateNode]
  );

  const handleDataSourceChange = useCallback(
    (dataSource: DataSource | undefined) => {
      if (!selectedNodeId) return;
      updateNode(selectedNodeId, { dataSource });
    },
    [selectedNodeId, updateNode]
  );

  const handleAlign = useCallback(
    (direction: AlignDirection) => {
      if (!isMultiSelect) return;
      const canvasEl = document.querySelector("[data-canvas-root]") as HTMLElement | null;
      if (!canvasEl) return;
      const t = canvasEl.closest("[data-canvas-transform]") as HTMLElement | null;
      const scaleMatch = t?.style.transform.match(/scale\(([\d.]+)\)/);
      const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
      const boxes = getNodeBBoxes(allSelectedIds, canvasEl, scale);
      if (boxes.length < 2) return;
      const adjustments = computeAlignment(boxes, direction);
      for (const [nodeId, pos] of adjustments) {
        const style: Record<string, string> = {};
        if (pos.left !== undefined) style.left = `${Math.round(pos.left)}px`;
        if (pos.top !== undefined) style.top = `${Math.round(pos.top)}px`;
        updateNodeStyle(nodeId, style);
      }
    },
    [isMultiSelect, allSelectedIds, updateNodeStyle],
  );

  const handleDistribute = useCallback(
    (axis: DistributeAxis) => {
      if (!isMultiSelect) return;
      const canvasEl = document.querySelector("[data-canvas-root]") as HTMLElement | null;
      if (!canvasEl) return;
      const t = canvasEl.closest("[data-canvas-transform]") as HTMLElement | null;
      const scaleMatch = t?.style.transform.match(/scale\(([\d.]+)\)/);
      const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
      const boxes = getNodeBBoxes(allSelectedIds, canvasEl, scale);
      if (boxes.length < 3) return;
      const adjustments = computeDistribution(boxes, axis);
      for (const [nodeId, pos] of adjustments) {
        const style: Record<string, string> = {};
        if (pos.left !== undefined) style.left = `${Math.round(pos.left)}px`;
        if (pos.top !== undefined) style.top = `${Math.round(pos.top)}px`;
        updateNodeStyle(nodeId, style);
      }
    },
    [isMultiSelect, allSelectedIds, updateNodeStyle],
  );

  // Multi-select panel
  if (isMultiSelect) {
    return (
      <div className="flex flex-col h-full">
        <div className="[padding:10px_12px] [border-bottom:1px_solid_var(--s-border)]">
          <div className="[font-size:var(--s-text-sm)] [font-weight:var(--s-weight-semibold)] [color:var(--s-text-pri)]">
            Multi-Select
          </div>
          <div className="[font-size:var(--s-text-xs)] [color:var(--s-text-ter)] mt-0.5">
            {allSelectedIds.length} nodes selected
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Align section */}
          <div className="[padding:10px_12px] [border-bottom:1px_solid_var(--s-border)]">
            <div className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-semibold)] [color:var(--s-text-sec)] mb-2">
              Align
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <AlignButton label="Left" icon="align-left" onClick={() => handleAlign("left")} />
              <AlignButton label="Center H" icon="align-center-h" onClick={() => handleAlign("center-h")} />
              <AlignButton label="Right" icon="align-right" onClick={() => handleAlign("right")} />
              <AlignButton label="Top" icon="align-top" onClick={() => handleAlign("top")} />
              <AlignButton label="Center V" icon="align-center-v" onClick={() => handleAlign("center-v")} />
              <AlignButton label="Bottom" icon="align-bottom" onClick={() => handleAlign("bottom")} />
            </div>
          </div>

          {/* Distribute section */}
          <div className="[padding:10px_12px] [border-bottom:1px_solid_var(--s-border)]">
            <div className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-semibold)] [color:var(--s-text-sec)] mb-2">
              Distribute
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <AlignButton
                label="Horizontally"
                icon="distribute-h"
                onClick={() => handleDistribute("horizontal")}
                disabled={allSelectedIds.length < 3}
              />
              <AlignButton
                label="Vertically"
                icon="distribute-v"
                onClick={() => handleDistribute("vertical")}
                disabled={allSelectedIds.length < 3}
              />
            </div>
          </div>

          {/* Group section */}
          <div className="[padding:10px_12px] [border-bottom:1px_solid_var(--s-border)]">
            <button
              onClick={groupSelectedIntoFrame}
              className="w-full [padding:6px_10px] [font-size:var(--s-text-sm)] [font-weight:var(--s-weight-medium)] [color:var(--s-accent)] [background:var(--s-accent-soft)] [border:1px_solid_var(--s-accent-soft)] [border-radius:var(--s-r-md)] cursor-pointer hover:[background:var(--s-accent)] hover:text-white transition-colors"
            >
              Group into Frame
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedNode) {
    return <NoSelectionPanel />;
  }

  const schema = NODE_SCHEMAS[selectedNode.type];
  const propDefs = schema?.props ?? {};
  const nodeProps = selectedNode.props ?? {};

  return (
    <div className="flex flex-col h-full">
      <div className="[padding:10px_12px] [border-bottom:1px_solid_var(--s-border)]">
        <div className="flex items-center justify-between gap-2">
          <div className="[font-size:var(--s-text-sm)] [font-weight:var(--s-weight-semibold)] [color:var(--s-text-pri)] flex items-center gap-1.5">
            Design
            {isLocked && (
              <span className="[font-size:var(--s-text-2xs)] [background:var(--s-warning)] text-white [padding:1px_6px] [border-radius:var(--s-r-full)] [font-weight:var(--s-weight-medium)]">
                Locked
              </span>
            )}
          </div>
          {/* Compile flag toggle -- prominently in header */}
          {selectedNodeId && spec && selectedNodeId !== spec.tree.id && (
            <button
              onClick={() => toggleNodeCompile(selectedNodeId)}
              title={isDesignOnly ? "Design only (click to include in compile)" : "Included in compile (click to mark as design only)"}
              className={`flex items-center gap-1 [padding:2px_7px] [border-radius:var(--s-r-full)] [font-size:var(--s-text-2xs)] [font-weight:var(--s-weight-medium)] border transition-colors ${
                isDesignOnly
                  ? "[background:var(--s-warning)] text-white border-transparent"
                  : "[background:transparent] [color:var(--s-text-ter)] [border-color:var(--s-border)] hover:[color:var(--s-text-pri)]"
              }`}
            >
              {isDesignOnly ? (
                <>
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="1" y="1" width="8" height="8" rx="1.5"/><line x1="3.5" y1="5" x2="6.5" y2="5"/></svg>
                  Design only
                </>
              ) : (
                <>
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="2,5 4,8 8,2"/></svg>
                  Build
                </>
              )}
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          {/* Node type badge -- actionable (opens convert picker via context menu) */}
          <span
            className="[font-size:var(--s-text-xs)] font-mono [background:var(--s-accent-soft)] [color:var(--s-accent)] [padding:1px_6px] [border-radius:var(--s-r-sm)] cursor-default"
            title="Node type"
          >
            {selectedNode.type}
          </span>
          <span className="[font-size:var(--s-text-2xs)] [color:var(--s-text-ter)] truncate">
            #{selectedNode.id}
          </span>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto ${isLocked ? "opacity-50 pointer-events-none" : ""}`}>
        {/* Image preview thumbnail */}
        {selectedNode.type === "Image" && typeof nodeProps.src === "string" && nodeProps.src && (
          <div className="[padding:8px_12px] [border-bottom:1px_solid_var(--s-border)]">
            <div className="relative [border-radius:var(--s-r-md)] overflow-hidden [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)] [max-height:120px]">
              <NextImage
                src={nodeProps.src as string}
                alt={typeof nodeProps.alt === "string" ? nodeProps.alt : "Preview"}
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          </div>
        )}

        {/* Props section — grouped by Content / Style / Layout / Behaviour / Advanced */}
        {Object.keys(propDefs).length > 0 && (
          <div className="[border-bottom:1px_solid_var(--s-border)]">
            <PropsPanel
              propDefs={propDefs}
              nodeProps={nodeProps}
              nodeType={selectedNode.type}
              onChange={handlePropChange}
            />
          </div>
        )}


        {/* DS Component variant + state picker — legacy Frame+dsComponentName nodes */}
        {typeof nodeProps.dsComponentName === "string" && nodeProps.dsComponentName && (
          <DSComponentVariantSection
            dsComponentName={nodeProps.dsComponentName as string}
            selectedVariants={(nodeProps.selectedVariants as Record<string, string>) ?? {}}
            onVariantChange={(variants) => {
              if (selectedNodeId) updateNodeProps(selectedNodeId, { selectedVariants: variants });
            }}
          />
        )}

        {/* ComponentInstance props + variants (0.10.4.6) */}
        {selectedNode.type === "ComponentInstance" &&
          typeof nodeProps.componentName === "string" && nodeProps.componentName && (
          <DSComponentVariantSection
            dsComponentName={nodeProps.componentName as string}
            selectedVariants={(nodeProps.selectedVariants as Record<string, string>) ?? {}}
            componentProps={(nodeProps.componentProps as Record<string, unknown>) ?? {}}
            importPath={typeof nodeProps.importPath === "string" ? nodeProps.importPath : undefined}
            hasChildren={(selectedNode.children ?? []).length > 0}
            onVariantChange={(variants) => {
              if (selectedNodeId) updateNodeProps(selectedNodeId, { selectedVariants: variants });
            }}
            onPropChange={(key, value) => {
              if (selectedNodeId) {
                const existing = (nodeProps.componentProps as Record<string, unknown>) ?? {};
                updateNodeProps(selectedNodeId, { componentProps: { ...existing, [key]: value } });
              }
            }}
            onRestoreTemplate={(children) => {
              if (selectedNodeId && children.length > 0) {
                // cloneWithNewIds ensures every node in the tree gets a fresh unique ID
                const freshChildren = (children as Node[]).map((n) =>
                  cloneWithNewIds({ id: n.id ?? generateId(), ...n } as Node)
                );
                updateNode(selectedNodeId, { children: freshChildren });
              }
            }}
            onDetach={() => {
              if (!selectedNodeId) return;
              // Convert ComponentInstance → Frame, strip component-specific props
              const { componentName: _cn, importPath: _ip, componentProps: _cp, selectedVariants: _sv, ...restProps } = nodeProps as Record<string, unknown>;
              void _cn; void _ip; void _cp; void _sv;
              updateNode(selectedNodeId, { type: "Frame", props: restProps as Record<string, unknown> });
            }}
          />
        )}

        {/* Position & Size widget */}
        <PositionSizeWidget />

        {/* Style sections — contextual per node type */}
        <StylePanel nodeId={selectedNode.id} nodeType={selectedNode.type} />

        {/* Interactions section (hidden for Image, Divider, Spacer) */}
        {!["Image", "Divider", "Spacer"].includes(selectedNode.type) && (
          <InteractionsSection
            interactions={selectedNode.interactions}
            onChange={handleInteractionsChange}
          />
        )}

        {/* Data binding section (List/DataTable only) */}
        {!["Text", "Heading", "Image", "Divider", "Spacer"].includes(selectedNode.type) && (
          <DataBindingSection
            dataSource={selectedNode.dataSource}
            onChange={handleDataSourceChange}
            nodeType={selectedNode.type}
          />
        )}

        {/* Constraints (shown when parent Frame has autoLayout off) */}
        <ConstraintWidget />
      </div>

      {/* Compile Health (structure linter) */}
      <CompileHealthSection />
    </div>
  );
}
