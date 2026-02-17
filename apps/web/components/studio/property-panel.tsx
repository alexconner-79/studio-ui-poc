"use client";

import React, { useCallback, useState } from "react";
import { useEditorStore } from "@/lib/studio/store";
import { NODE_SCHEMAS, type PropDef } from "@/lib/studio/node-schemas";
import type { Node, NodeInteractions, InteractionAction, InteractionChangeAction, VisibilityOperator, DataSource, DataSourceType } from "@/lib/studio/types";
import { IconPicker } from "./icon-picker";
import { StylePanel } from "./style-sections";

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
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
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
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
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
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
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
        className="w-full px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
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
    <div className="flex items-center justify-between py-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          value ? "bg-blue-500" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-4.5" : "translate-x-0.5"
          }`}
        />
      </button>
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
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
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
        className="w-full px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-y"
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
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        Font Family
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">Default (inherit)</option>
        {projectFonts.map((font) => (
          <option key={font.family} value={font.family}>
            {font.family} ({font.source})
          </option>
        ))}
      </select>
      {projectFonts.length === 0 && (
        <p className="text-[10px] text-muted-foreground">
          Add fonts via the Fonts panel in the left sidebar
        </p>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Prop field renderer
// -------------------------------------------------------------------------

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
    <div className="border-t pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
      >
        Interactions
        <span className="text-[10px] font-normal">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <div className="space-y-3">
          {/* onClick */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">onClick</label>
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
              className="w-full px-2 py-1 text-xs border rounded bg-background"
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
                className="w-full px-2 py-1 text-xs border rounded bg-background"
              />
            )}
            {i.onClick?.action === "toggleVisibility" && (
              <input
                type="text"
                value={i.onClick.target ?? ""}
                onChange={(e) => updateOnClick("target", e.target.value)}
                placeholder="State variable name"
                className="w-full px-2 py-1 text-xs border rounded bg-background"
              />
            )}
            {i.onClick?.action === "custom" && (
              <textarea
                value={i.onClick.code ?? ""}
                onChange={(e) => updateOnClick("code", e.target.value)}
                placeholder="console.log('clicked')"
                rows={2}
                className="w-full px-2 py-1 text-xs font-mono border rounded bg-background resize-y"
              />
            )}
          </div>

          {/* onChange */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">onChange</label>
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
              className="w-full px-2 py-1 text-xs border rounded bg-background"
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
                className="w-full px-2 py-1 text-xs border rounded bg-background"
              />
            )}
            {i.onChange?.action === "custom" && (
              <textarea
                value={i.onChange.code ?? ""}
                onChange={(e) => updateOnChange("code", e.target.value)}
                placeholder="console.log(e.target.value)"
                rows={2}
                className="w-full px-2 py-1 text-xs font-mono border rounded bg-background resize-y"
              />
            )}
          </div>

          {/* visibleWhen */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Visible when</label>
            <input
              type="text"
              value={i.visibleWhen?.state ?? ""}
              onChange={(e) => updateVisibleWhen("state", e.target.value)}
              placeholder="State variable name"
              className="w-full px-2 py-1 text-xs border rounded bg-background"
            />
            {i.visibleWhen?.state && (
              <div className="flex gap-1">
                <select
                  value={i.visibleWhen.operator ?? "truthy"}
                  onChange={(e) => updateVisibleWhen("operator", e.target.value)}
                  className="flex-1 px-2 py-1 text-xs border rounded bg-background"
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
                    className="flex-1 px-2 py-1 text-xs border rounded bg-background"
                  />
                )}
              </div>
            )}
          </div>

          {interactions && (
            <button
              onClick={clearInteractions}
              className="text-xs text-destructive hover:underline"
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
    <div className="border-t pt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
      >
        Data Source
        <span className="text-[10px] font-normal">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && (
        <div className="space-y-3">
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
            className="w-full px-2 py-1 text-xs border rounded bg-background"
          >
            <option value="static">Static data</option>
            <option value="mock">Mock data</option>
            <option value="api">API endpoint</option>
          </select>

          {ds.type === "static" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">JSON data array</label>
              <textarea
                value={JSON.stringify(ds.data ?? [], null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    if (Array.isArray(parsed)) updateField("data", parsed);
                  } catch { /* ignore parse errors while typing */ }
                }}
                rows={5}
                className="w-full px-2 py-1 text-xs font-mono border rounded bg-background resize-y"
              />
            </div>
          )}

          {ds.type === "mock" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Template</label>
              <select
                onChange={(e) => {
                  const template = MOCK_DATA_TEMPLATES[e.target.value];
                  if (template) onChange({ ...ds, data: template });
                }}
                className="w-full px-2 py-1 text-xs border rounded bg-background"
              >
                <option value="users">Users</option>
                <option value="products">Products</option>
                <option value="orders">Orders</option>
              </select>
              <pre className="text-[10px] font-mono bg-muted/30 p-2 rounded max-h-20 overflow-y-auto">
                {JSON.stringify(ds.data ?? [], null, 2)}
              </pre>
            </div>
          )}

          {ds.type === "api" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">API URL</label>
              <input
                type="text"
                value={ds.url ?? ""}
                onChange={(e) => updateField("url", e.target.value)}
                placeholder="https://api.example.com/data"
                className="w-full px-2 py-1 text-xs border rounded bg-background"
              />
            </div>
          )}

          {dataSource && (
            <button
              onClick={() => onChange(undefined)}
              className="text-xs text-destructive hover:underline"
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
// Property panel
// -------------------------------------------------------------------------

export function PropertyPanel() {
  const spec = useEditorStore((s) => s.spec);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const updateNode = useEditorStore((s) => s.updateNode);
  const removeNode = useEditorStore((s) => s.removeNode);
  const lockedNodeIds = useEditorStore((s) => s.lockedNodeIds);

  const selectedNode =
    spec && selectedNodeId ? findNode(spec.tree, selectedNodeId) : null;

  const isLocked = selectedNodeId ? lockedNodeIds.has(selectedNodeId) : false;

  const handlePropChange = useCallback(
    (key: string, value: unknown) => {
      if (!selectedNodeId) return;
      updateNodeProps(selectedNodeId, { [key]: value });
    },
    [selectedNodeId, updateNodeProps]
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

  if (!selectedNode) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b font-semibold text-sm">
          Properties
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4 text-center">
          Select a node on the canvas to edit its properties
        </div>
      </div>
    );
  }

  const schema = NODE_SCHEMAS[selectedNode.type];
  const propDefs = schema?.props ?? {};
  const nodeProps = selectedNode.props ?? {};

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b">
        <div className="font-semibold text-sm flex items-center gap-2">
          Properties
          {isLocked && (
            <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-normal">
              Locked
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs font-mono bg-accent px-1.5 py-0.5 rounded">
            {selectedNode.type}
          </span>
          <span className="text-xs text-muted-foreground">
            #{selectedNode.id}
          </span>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${isLocked ? "opacity-50 pointer-events-none" : ""}`}>
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

        {Object.keys(propDefs).length === 0 && (
          <p className="text-sm text-muted-foreground">
            This component has no editable props.
          </p>
        )}

        {/* Interactions section */}
        <InteractionsSection
          interactions={selectedNode.interactions}
          onChange={handleInteractionsChange}
        />

        {/* Data binding section */}
        <DataBindingSection
          dataSource={selectedNode.dataSource}
          onChange={handleDataSourceChange}
          nodeType={selectedNode.type}
        />

        {/* Style sections */}
        <StylePanel nodeId={selectedNode.id} nodeType={selectedNode.type} />
      </div>

      {/* Delete button */}
      {spec && selectedNode.id !== spec.tree.id && (
        <div className="p-4 border-t">
          <button
            onClick={() => removeNode(selectedNode.id)}
            disabled={isLocked}
            className={`w-full px-3 py-2 text-sm border rounded-md transition-colors ${
              isLocked
                ? "text-muted-foreground border-muted cursor-not-allowed"
                : "text-destructive border-destructive/30 hover:bg-destructive/10"
            }`}
          >
            Delete {selectedNode.type}
          </button>
        </div>
      )}
    </div>
  );
}
