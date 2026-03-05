"use client";

import React, { useState, useEffect, useRef } from "react";
import { useDraggable, useDndContext } from "@dnd-kit/core";
import { NODE_SCHEMAS, type NodeSchema } from "@/lib/studio/node-schemas";
import { useEditorStore } from "@/lib/studio/store";
import { toast } from "@/lib/studio/toast";
import { CONTAINER_TYPES } from "@/lib/studio/types";

// -------------------------------------------------------------------------
// SVG icons for palette items
// -------------------------------------------------------------------------

const PALETTE_ICONS: Record<string, React.ReactNode> = {
  // Canvas primitives
  Frame: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1"/></svg>,
  Stack: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="4" rx="0.5"/><rect x="2" y="10" width="12" height="4" rx="0.5"/></svg>,
  Grid: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="0.5"/><rect x="9" y="2" width="5" height="5" rx="0.5"/><rect x="2" y="9" width="5" height="5" rx="0.5"/><rect x="9" y="9" width="5" height="5" rx="0.5"/></svg>,
  Section: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="3" rx="0.5"/><rect x="2" y="7" width="12" height="7" rx="0.5"/></svg>,
  Container: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1.5" y="1.5" width="13" height="13" rx="1" strokeDasharray="3 2"/></svg>,
  ScrollArea: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="10" height="12" rx="1"/><line x1="14" y1="4" x2="14" y2="7"/><line x1="13" y1="4" x2="15" y2="4"/><line x1="13" y1="7" x2="15" y2="7"/></svg>,
  Box: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1" strokeDasharray="2 1.5"/></svg>,
  Spacer: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="8" y1="2" x2="8" y2="14"/><line x1="4" y1="2" x2="12" y2="2"/><line x1="4" y1="14" x2="12" y2="14"/></svg>,
  Heading: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="3" y1="4" x2="3" y2="12"/><line x1="13" y1="4" x2="13" y2="12"/><line x1="3" y1="8" x2="13" y2="8"/></svg>,
  Text: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="3" y1="5" x2="13" y2="5"/><line x1="3" y1="8" x2="13" y2="8"/><line x1="3" y1="11" x2="9" y2="11"/></svg>,
  Image: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1"/><circle cx="5.5" cy="6.5" r="1"/><polyline points="2,11 5.5,7.5 8,10 11,7 14,11"/></svg>,
  Link: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 8a3 3 0 0 0 3 3h1a3 3 0 0 0 0-6H9"/><path d="M10 8a3 3 0 0 0-3-3H6a3 3 0 0 0 0 6h1"/></svg>,
  Icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="8,2 9.8,6 14,6.4 11,9.1 11.9,13.2 8,11 4.1,13.2 5,9.1 2,6.4 6.2,6"/></svg>,
  Divider: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="8" x2="14" y2="8"/></svg>,
  // DS components — Primitives
  Button: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="12" height="6" rx="2"/><line x1="6" y1="8" x2="10" y2="8"/></svg>,
  Badge: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="12" height="6" rx="3"/></svg>,
  Input: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="12" height="6" rx="1"/><line x1="5" y1="8" x2="7" y2="8"/></svg>,
  Textarea: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1"/><line x1="4" y1="6" x2="12" y2="6"/><line x1="4" y1="9" x2="9" y2="9"/></svg>,
  Select: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="12" height="6" rx="1"/><polyline points="10,7 12,8 10,9"/></svg>,
  Checkbox: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="10" height="10" rx="1.5"/><polyline points="5,8 7,10 11,6"/></svg>,
  Switch: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="12" height="6" rx="3"/><circle cx="11" cy="8" r="2" fill="currentColor" stroke="none"/></svg>,
  Slider: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="8" x2="14" y2="8"/><circle cx="9" cy="8" r="2.5" fill="currentColor" stroke="none"/></svg>,
  Avatar: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="6" r="2"/><path d="M3.5 13.5a5 5 0 0 1 9 0"/></svg>,
  Card: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><line x1="2" y1="6" x2="14" y2="6"/></svg>,
  Separator: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="8" x2="14" y2="8" strokeDasharray="2 1.5"/></svg>,
  Skeleton: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="12" height="3" rx="1" strokeDasharray="2 1"/><rect x="2" y="9" width="8" height="3" rx="1" strokeDasharray="2 1"/></svg>,
  Tooltip: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="2" width="10" height="7" rx="1"/><polyline points="6,9 8,12 10,9"/></svg>,
  Popover: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="10" height="8" rx="1"/><polyline points="6,11 8,14 10,11"/></svg>,
  Alert: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="12" height="8" rx="1"/><line x1="8" y1="7" x2="8" y2="9"/><circle cx="8" cy="10.5" r="0.5" fill="currentColor"/></svg>,
  // DS components — Forms
  Label: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="5" x2="8" y2="5"/></svg>,
  RadioGroup: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/></svg>,
  // DS components — Navigation
  Tabs: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="4" rx="0.5"/><rect x="9" y="2" width="5" height="4" rx="0.5"/><rect x="2" y="8" width="12" height="6" rx="0.5"/></svg>,
  Breadcrumb: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="8" x2="5" y2="8"/><line x1="6" y1="6" x2="8" y2="8"/><line x1="6" y1="10" x2="8" y2="8"/><line x1="9" y1="8" x2="12" y2="8"/><line x1="13" y1="6" x2="15" y2="8"/><line x1="13" y1="10" x2="15" y2="8"/></svg>,
  Pagination: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="6" y="5" width="4" height="6" rx="0.5"/><polyline points="4,7 2,8 4,9"/><polyline points="12,7 14,8 12,9"/></svg>,
  Navbar: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="2" width="14" height="5" rx="0.5"/><line x1="3" y1="4.5" x2="6" y2="4.5"/><line x1="10" y1="4.5" x2="13" y2="4.5"/></svg>,
  Sidebar: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="2" width="14" height="12" rx="1"/><line x1="6" y1="2" x2="6" y2="14"/><line x1="8" y1="5" x2="13" y2="5"/><line x1="8" y1="8" x2="13" y2="8"/></svg>,
  // DS components — Overlays
  Dialog: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><line x1="2" y1="7" x2="14" y2="7"/><line x1="11" y1="5" x2="13" y2="5"/></svg>,
  Drawer: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="2" width="14" height="12" rx="1"/><rect x="8" y="2" width="7" height="12" rx="0"/></svg>,
  Sheet: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="2" width="14" height="12" rx="1"/><rect x="9" y="2" width="6" height="12"/></svg>,
  DropdownMenu: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="2" width="10" height="5" rx="1"/><rect x="3" y="9" width="10" height="5" rx="1" strokeDasharray="2 1"/><polyline points="6,4 8,5.5 10,4"/></svg>,
  // DS components — SaaS
  DataGrid: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1"/><line x1="2" y1="6" x2="14" y2="6"/><line x1="2" y1="10" x2="14" y2="10"/><line x1="6" y1="6" x2="6" y2="14"/></svg>,
  EmptyState: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1" strokeDasharray="2 2"/><line x1="8" y1="5" x2="8" y2="11"/><line x1="5" y1="8" x2="11" y2="8"/></svg>,
  // DS components — Website
  Hero: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="2" width="14" height="8" rx="1"/><line x1="4" y1="5" x2="10" y2="5"/><line x1="4" y1="7" x2="8" y2="7"/><rect x="4" y="12" width="4" height="2" rx="1"/></svg>,
  // DS components — Layout/Structure
  PageHeader: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="2" width="14" height="5" rx="0.5"/><line x1="3" y1="4" x2="9" y2="4"/><line x1="11" y1="4" x2="14" y2="4"/></svg>,
};

const DEFAULT_ICON = <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="10" height="10" rx="1"/></svg>;

// -------------------------------------------------------------------------
// Palette item — grid cell (used for Layout + Content)
// -------------------------------------------------------------------------

function PaletteGridItem({ schema, dimmed }: { schema: NodeSchema; dimmed?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${schema.type}`,
    data: { type: "palette", nodeType: schema.type },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={schema.description}
      className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border text-[10px] font-medium cursor-grab active:cursor-grabbing transition-colors select-none ${
        isDragging
          ? "border-[var(--s-accent)] bg-[var(--s-accent)]/10 opacity-50"
          : dimmed
          ? "border-border opacity-30 pointer-events-none"
          : "border-border hover:border-[var(--s-accent)]/50 hover:bg-accent text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className="text-foreground/70">{PALETTE_ICONS[schema.type] ?? DEFAULT_ICON}</span>
      <span className="leading-none text-center">{schema.label}</span>
    </div>
  );
}

// -------------------------------------------------------------------------
// Palette item — text row (used for Components and below)
// -------------------------------------------------------------------------

function PaletteItem({ schema, dimmed }: { schema: NodeSchema; dimmed?: boolean }) {
  const [hovered, setHovered] = React.useState(false);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${schema.type}`,
    data: { type: "palette", nodeType: schema.type },
  });

  // Find the first prop with options to show as variant pills (prefer "variant" or "style")
  const variantProp = React.useMemo(() => {
    const preferred = ["variant", "intent", "type", "size"];
    for (const key of preferred) {
      const def = schema.props[key];
      if (def?.options && def.options.length > 1) return { key, def };
    }
    // fallback: first prop with options
    for (const [key, def] of Object.entries(schema.props)) {
      if (def.options && def.options.length > 1) return { key, def };
    }
    return null;
  }, [schema.props]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        title={schema.description}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] cursor-grab active:cursor-grabbing transition-colors ${
          isDragging
            ? "bg-[var(--s-accent)]/10 opacity-50"
            : dimmed
            ? "opacity-30 pointer-events-none"
            : "hover:bg-accent text-foreground/80 hover:text-foreground"
        }`}
      >
        <span className="text-muted-foreground shrink-0">{PALETTE_ICONS[schema.type] ?? DEFAULT_ICON}</span>
        <span className="font-medium truncate">{schema.label}</span>
        {variantProp && (
          <span className="ml-auto [font-size:10px] [color:var(--s-text-ter)] shrink-0">
            {variantProp.def.options!.length} styles
          </span>
        )}
      </div>

      {/* Variant pills — shown on hover if the component has variant options */}
      {hovered && variantProp && !dimmed && (
        <div className="px-2.5 pb-1.5 flex flex-wrap gap-1">
          {variantProp.def.options!.slice(0, 6).map((opt) => (
            <VariantPill
              key={String(opt.value)}
              schema={schema}
              variantKey={variantProp.key}
              variantValue={String(opt.value)}
              label={opt.label}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VariantPill({
  schema,
  variantKey,
  variantValue,
  label,
}: {
  schema: NodeSchema;
  variantKey: string;
  variantValue: string;
  label: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${schema.type}-${variantKey}-${variantValue}`,
    data: {
      type: "palette",
      nodeType: schema.type,
      initialProps: { [variantKey]: variantValue },
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={`Drag to add ${schema.label} — ${label}`}
      className={`px-1.5 py-0.5 [font-size:10px] rounded border cursor-grab active:cursor-grabbing transition-colors select-none ${
        isDragging
          ? "[border-color:var(--s-accent)] [background:var(--s-accent-soft)] [color:var(--s-accent)] opacity-50"
          : "[border-color:var(--s-border)] [color:var(--s-text-sec)] hover:[border-color:var(--s-accent)] hover:[color:var(--s-accent)] hover:[background:var(--s-accent-soft)]"
      }`}
    >
      {label}
    </div>
  );
}

// -------------------------------------------------------------------------
// DS palette grid item — same 2-col grid style as PaletteGridItem but for
// DS components (uses template-component drag type and tree data)
// -------------------------------------------------------------------------

function DSPaletteGridItem({
  name,
  description,
  tree,
}: {
  name: string;
  description?: string;
  tree: unknown;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `template-component-${name}`,
    data: { type: "template-component", name, tree },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      title={description || name}
      className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg border text-[10px] font-medium cursor-grab active:cursor-grabbing transition-colors select-none ${
        isDragging
          ? "border-[var(--s-accent)] bg-[var(--s-accent)]/10 opacity-50"
          : "border-border hover:border-[var(--s-accent)]/50 hover:bg-accent text-muted-foreground hover:text-foreground"
      }`}
    >
      <span className="text-foreground/70">{PALETTE_ICONS[name] ?? DEFAULT_ICON}</span>
      <span className="leading-none text-center">{name}</span>
    </div>
  );
}

// -------------------------------------------------------------------------
// Composite item (draggable) -- custom components + templates
// -------------------------------------------------------------------------

function CompositeItem({
  name,
  description,
  tree,
  dragType,
  onDelete,
}: {
  name: string;
  description?: string;
  tree: unknown;
  dragType: "custom-component" | "template-component";
  onDelete?: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${dragType}-${name}`,
    data: { type: dragType, name, tree },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`group flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-grab active:cursor-grabbing transition-colors ${
        isDragging
          ? "border-purple-500 bg-purple-50 dark:bg-purple-950 opacity-50"
          : "border-border hover:bg-accent hover:text-accent-foreground"
      }`}
      title={description || name}
    >
      <span className="font-medium truncate">{name}</span>
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDelete();
          }}
          className="ml-auto text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
          title="Delete component"
        >
          &times;
        </button>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// Collapsible category section (SVG rotating chevron, Figma-style)
// -------------------------------------------------------------------------

function CategorySection({
  label,
  children,
  defaultOpen = true,
  count,
}: {
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1 px-1 hover:text-foreground transition-colors h-7"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
            flexShrink: 0,
          }}
        >
          <polyline points="4,2 8,6 4,10" />
        </svg>
        {label}
        {count !== undefined && count > 0 && (
          <span className="ml-auto text-[10px] font-normal">{count}</span>
        )}
      </button>
      {open && <div className="space-y-1.5">{children}</div>}
    </div>
  );
}

// -------------------------------------------------------------------------
// Palette panel
// -------------------------------------------------------------------------

// Layout = containers you drag onto the canvas. Content = primitive elements.
// Shapes are handled by the drawing toolbar (Rectangle/Ellipse/Line/Frame tools).
const GRID_CATEGORIES = ["Layout", "Content"] as const;

// DS component categories that should be expanded by default
const DS_DEFAULT_OPEN_CATEGORIES = new Set(["Primitives", "Forms"]);

// Rename DS categories that clash with canvas primitive section names
const DS_CATEGORY_DISPLAY: Record<string, string> = {
  Layout: "Structure",
};

function mapCategory(cat: string | undefined): string {
  // Legacy "Structure" maps to "Layout"
  if (cat === "Structure" || cat === "Layout") return "Layout";
  return cat ?? "Content";
}

export function ComponentPalette({ filterText }: { filterText?: string } = {}) {
  const allSchemas = Object.values(NODE_SCHEMAS);
  const lowerFilter = (filterText ?? "").toLowerCase().trim();

  // Filter schemas -- exclude Shapes category entirely
  const schemas = allSchemas.filter((s) => {
    if (s.category === "Shapes") return false;
    if (lowerFilter) {
      return s.type.toLowerCase().includes(lowerFilter) || (s.category ?? "").toLowerCase().includes(lowerFilter);
    }
    return true;
  });

  const customComponents = useEditorStore((s) => s.customComponents);
  const setCustomComponents = useEditorStore((s) => s.setCustomComponents);
  const removeCustomComponent = useEditorStore((s) => s.removeCustomComponent);
  const dsComponents = useEditorStore((s) => s.dsComponents);
  const spec = useEditorStore((s) => s.spec);

  // Container validation hints: detect active drag target
  const { over, active } = useDndContext();
  const isDragging = !!active;
  const overTarget = over?.data.current;
  const hoverTargetIsNonContainer = isDragging && overTarget?.type === "canvas" && overTarget?.nodeId
    ? !CONTAINER_TYPES.has(overTarget.nodeId as string) && spec?.tree.id !== overTarget.nodeId
    : false;

  // Templates (fetched from API)
  const [templates, setTemplates] = useState<
    Array<{ name: string; description: string; tree: unknown }>
  >([]);

  // Load custom components and templates on mount
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    fetch("/api/studio/components")
      .then((r) => r.json())
      .then((d) => { if (d.components) setCustomComponents(d.components); })
      .catch(() => { toast.error("Failed to load components"); });

    fetch("/api/studio/templates")
      .then((r) => r.json())
      .then((d) => { if (d.templates) setTemplates(d.templates); })
      .catch(() => { toast.error("Failed to load templates"); });
  }, [setCustomComponents]);

  const handleDeleteComponent = async (name: string) => {
    try {
      await fetch(`/api/studio/components?name=${encodeURIComponent(name)}`, { method: "DELETE" });
      removeCustomComponent(name);
    } catch {
      // silently fail
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {/* Grid sections: Layout and Content */}
      {GRID_CATEGORIES.map((category) => {
        const items = schemas.filter((s) => mapCategory(s.category) === category);
        if (items.length === 0) return null;
        return (
          <CategorySection key={category} label={category} defaultOpen>
            <div className="grid grid-cols-2 gap-1.5">
              {items.map((schema) => (
                <PaletteGridItem key={schema.type} schema={schema} dimmed={hoverTargetIsNonContainer && !schema.acceptsChildren} />
              ))}
            </div>
          </CategorySection>
        );
      })}

      {/* DS component sections — grouped by category, sorted A-Z within each */}
      {dsComponents.length > 0 ? (() => {
        const filtered = dsComponents.filter((c) =>
          !lowerFilter || c.name.toLowerCase().includes(lowerFilter) || (c.category ?? "").toLowerCase().includes(lowerFilter)
        );

        // Group by category, preserving insertion order for consistent sequencing
        const dsByCategory = new Map<string, typeof dsComponents>();
        for (const c of filtered) {
          const cat = c.category ?? "Other";
          if (!dsByCategory.has(cat)) dsByCategory.set(cat, []);
          dsByCategory.get(cat)!.push(c);
        }
        // Sort A-Z within each category
        for (const arr of dsByCategory.values()) {
          arr.sort((a, b) => a.name.localeCompare(b.name));
        }

        return Array.from(dsByCategory.entries()).map(([category, comps]) => {
          const displayLabel = DS_CATEGORY_DISPLAY[category] ?? category;
          return (
            <CategorySection
              key={category}
              label={displayLabel}
              count={comps.length}
              defaultOpen={DS_DEFAULT_OPEN_CATEGORIES.has(category)}
            >
              <div className="grid grid-cols-2 gap-1.5">
                {comps.map((comp) => {
                  const baseId = `ds-${comp.name.toLowerCase().replace(/\s+/g, "-")}-1`;
                  const template = comp.defaultTemplate as Record<string, unknown> | null | undefined;
                  const tree = template
                    ? { ...template, id: baseId }
                    : {
                        id: baseId,
                        type: "ComponentInstance",
                        name: comp.name,
                        props: {
                          componentName: comp.name,
                          ...(comp.importPath ? { importPath: comp.importPath } : {}),
                          selectedVariants: {},
                        },
                        style: {},
                        children: [],
                      };
                  return (
                    <DSPaletteGridItem
                      key={comp.name}
                      name={comp.name}
                      description={comp.description}
                      tree={tree}
                    />
                  );
                })}
              </div>
            </CategorySection>
          );
        });
      })() : (
        <div className="[padding:10px_12px] [font-size:var(--s-text-xs)] [color:var(--s-text-ter)] [line-height:1.5]">
          <div className="[font-weight:var(--s-weight-medium)] [margin-bottom:4px] [color:var(--s-text-sec)]">
            No design system active
          </div>
          Open the DS workspace to choose a component library and unlock the full palette.
        </div>
      )}

      {/* Custom composites */}
      {customComponents.length > 0 && (
        <CategorySection label="Custom" count={customComponents.length}>
          {customComponents.map((comp) => (
            <CompositeItem
              key={comp.name}
              name={comp.name}
              description={comp.description}
              tree={comp.tree}
              dragType="custom-component"
              onDelete={() => handleDeleteComponent(comp.name)}
            />
          ))}
        </CategorySection>
      )}

      {/* Templates */}
      {templates.length > 0 && (
        <CategorySection label="Templates" count={templates.length} defaultOpen={false}>
          {templates.map((t) => (
            <CompositeItem
              key={t.name}
              name={t.name}
              description={t.description}
              tree={t.tree}
              dragType="template-component"
            />
          ))}
        </CategorySection>
      )}
    </div>
  );
}
