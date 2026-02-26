"use client";

import React, { useCallback, useState, useMemo } from "react";
import NextImage from "next/image";
import { useEditorStore } from "@/lib/studio/store";
import { NODE_SCHEMAS, type PropDef } from "@/lib/studio/node-schemas";
import type { Node, NodeInteractions, InteractionAction, InteractionChangeAction, VisibilityOperator, DataSource, DataSourceType } from "@/lib/studio/types";
import { IconPicker } from "./icon-picker";
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
  // Color fields for fill/stroke props
  const colorProps = ["fill", "stroke"];
  if (colorProps.includes(propKey) && def.type === "string") {
    return (
      <ColorField
        label={def.label}
        value={value !== undefined ? String(value) : String(def.defaultValue ?? "")}
        onChange={(v) => onChange(propKey, v)}
      />
    );
  }

  // Special handling for fontFamily
  if (propKey === "fontFamily") {
    return (
      <FontFamilyField
        value={value !== undefined ? String(value) : ""}
        onChange={(v) => onChange(propKey, v)}
      />
    );
  }

  // Special handling for icon name on Icon nodes
  if (propKey === "name" && nodeType === "Icon") {
    return (
      <IconPicker
        value={value !== undefined ? String(value) : String(def.defaultValue ?? "Star")}
        onChange={(v) => onChange(propKey, v)}
      />
    );
  }

  if (def.options) {
    return (
      <SelectField
        label={def.label}
        value={
          value !== undefined ? (value as string | number) : (def.defaultValue as string | number) ?? ""
        }
        options={def.options}
        onChange={(v) => onChange(propKey, v)}
      />
    );
  }

  switch (def.type) {
    case "string":
      return (
        <StringField
          label={def.label}
          value={
            value !== undefined ? String(value) : String(def.defaultValue ?? "")
          }
          onChange={(v) => onChange(propKey, v)}
        />
      );
    case "number":
      return (
        <NumberField
          label={def.label}
          value={
            value !== undefined ? Number(value) : Number(def.defaultValue ?? 0)
          }
          onChange={(v) => onChange(propKey, v)}
        />
      );
    case "boolean":
      return (
        <BooleanField
          label={def.label}
          value={
            value !== undefined
              ? Boolean(value)
              : Boolean(def.defaultValue ?? false)
          }
          onChange={(v) => onChange(propKey, v)}
        />
      );
    case "array":
      return (
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
type DsComponentProp = { name: string; type: string; default?: string | number | boolean; options?: string[]; description?: string };

function DSComponentVariantSection({
  dsComponentName,
  selectedVariants,
  onVariantChange,
}: {
  dsComponentName: string;
  selectedVariants: Record<string, string>;
  onVariantChange: (variants: Record<string, string>) => void;
}) {
  const dsComponents = useEditorStore((s) => s.dsComponents);
  const [previewState, setPreviewState] = useState<string>("default");

  const compDef = dsComponents.find((c) => c.name === dsComponentName);
  if (!compDef) return null;

  const variants = (compDef.variants ?? []) as VariantGroup[];
  const states = (compDef.states ?? []) as DsComponentState[];
  const typedProps = (compDef.props ?? []) as DsComponentProp[];

  if (variants.length === 0 && states.length === 0 && typedProps.length === 0) return null;

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

      {/* Typed props reference */}
      {typedProps.length > 0 && (
        <div className="flex flex-col [gap:4px]">
          <div className="[font-size:var(--s-text-xs)] [font-weight:var(--s-weight-medium)] [color:var(--s-text-sec)]">Props</div>
          <div className="flex flex-col [gap:3px]">
            {typedProps.map((prop) => (
              <div key={prop.name} className="flex items-center justify-between [padding:2px_0]">
                <span className="[font-size:var(--s-text-xs)] [color:var(--s-text-sec)] truncate">
                  {prop.name}
                  <span className="ml-1 [font-size:var(--s-text-2xs)] [color:var(--s-text-ter)] font-mono">:{prop.type}</span>
                </span>
                <span className="[font-size:var(--s-text-2xs)] [color:var(--s-text-ter)] font-mono ml-2 shrink-0">
                  {String(prop.default ?? "—")}
                </span>
              </div>
            ))}
          </div>
        </div>
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
  const removeNode = useEditorStore((s) => s.removeNode);
  const lockedNodeIds = useEditorStore((s) => s.lockedNodeIds);
  const toggleNodeCompile = useEditorStore((s) => s.toggleNodeCompile);
  const groupSelectedIntoFrame = useEditorStore((s) => s.groupSelectedIntoFrame);
  const designTokens = useEditorStore((s) => s.designTokens);

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

        {/* Props section */}
        {Object.keys(propDefs).length > 0 && (
          <div className="[padding:10px_12px] [border-bottom:1px_solid_var(--s-border)] flex flex-col [gap:8px]">
            {Object.entries(propDefs).map(([key, def]) => (
              <PropField
                key={key}
                propKey={key}
                def={def}
                value={nodeProps[key]}
                onChange={handlePropChange}
                nodeType={selectedNode.type}
              />
            ))}
          </div>
        )}

        {Object.keys(propDefs).length === 0 && (
          <div className="[padding:10px_12px] [border-bottom:1px_solid_var(--s-border)]">
            <p className="[font-size:var(--s-text-sm)] [color:var(--s-text-ter)]">
              This component has no editable props.
            </p>
          </div>
        )}

        {/* DS Component variant + state picker (0.10.4) */}
        {typeof nodeProps.dsComponentName === "string" && nodeProps.dsComponentName && (
          <DSComponentVariantSection
            dsComponentName={nodeProps.dsComponentName as string}
            selectedVariants={(nodeProps.selectedVariants as Record<string, string>) ?? {}}
            onVariantChange={(variants) => {
              if (selectedNodeId) updateNodeProps(selectedNodeId, { selectedVariants: variants });
            }}
          />
        )}

        {/* Interactions section (hidden for Image, Divider, Spacer) */}
        {!["Image", "Divider", "Spacer"].includes(selectedNode.type) && (
          <InteractionsSection
            interactions={selectedNode.interactions}
            onChange={handleInteractionsChange}
          />
        )}

        {/* Data binding section (hidden for Text/Heading/Image -- not data-driven types) */}
        {!["Text", "Heading", "Image", "Divider", "Spacer"].includes(selectedNode.type) && (
          <DataBindingSection
            dataSource={selectedNode.dataSource}
            onChange={handleDataSourceChange}
            nodeType={selectedNode.type}
          />
        )}

        {/* Style sections */}
        <StylePanel nodeId={selectedNode.id} nodeType={selectedNode.type} />

        {/* Constraints (shown when parent Frame has autoLayout off) */}
        <ConstraintWidget />
      </div>

      {/* Compile Health (structure linter) */}
      <CompileHealthSection />

      {/* Delete button */}
      {spec && selectedNode.id !== spec.tree.id && (
        <div className="[padding:8px_12px] [border-top:1px_solid_var(--s-border)]">
          <button
            onClick={() => removeNode(selectedNode.id)}
            disabled={isLocked}
            className={`w-full [padding:5px_10px] [font-size:var(--s-text-sm)] [border-radius:var(--s-r-md)] transition-colors ${
              isLocked
                ? "[color:var(--s-text-ter)] [border:1px_solid_var(--s-border)] cursor-not-allowed"
                : "[color:var(--s-danger)] [border:1px_solid_var(--s-danger-soft)] hover:[background:var(--s-danger-soft)]"
            }`}
          >
            Delete {selectedNode.type}
          </button>
        </div>
      )}
    </div>
  );
}
