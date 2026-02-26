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
  Badge: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="12" height="6" rx="3"/></svg>,
  Divider: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="8" x2="14" y2="8"/></svg>,
  Button: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="12" height="6" rx="2"/><line x1="6" y1="8" x2="10" y2="8"/></svg>,
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

// Layout = containers you drag onto the canvas. Content = primitive elements. Components and below = higher-order.
// Shapes are handled by the drawing toolbar (Rectangle/Ellipse/Line/Frame tools).
const GRID_CATEGORIES = ["Layout", "Content"] as const;
const LIST_CATEGORIES = ["Components", "Forms", "Data Display", "Feedback", "Navigation", "Surfaces", "Media"] as const;
const ALL_CATEGORIES = [...GRID_CATEGORIES, ...LIST_CATEGORIES] as const;

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
  const dsId = useEditorStore((s) => s.dsId);
  const dsName = useEditorStore((s) => s.dsName);
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

      {/* List sections: Components and below — collapsed by default */}
      {LIST_CATEGORIES.map((category) => {
        const items = schemas.filter((s) => mapCategory(s.category) === category);
        if (items.length === 0) return null;
        return (
          <CategorySection key={category} label={category} defaultOpen={false}>
            {items.map((schema) => (
              <PaletteItem key={schema.type} schema={schema} dimmed={hoverTargetIsNonContainer && !schema.acceptsChildren} />
            ))}
          </CategorySection>
        );
      })}

      {/* DS Components — from linked Design System */}
      {(dsComponents.length > 0 || dsId) && (
        <CategorySection
          label="From Design System"
          count={dsComponents.filter((c) =>
            !lowerFilter || c.name.toLowerCase().includes(lowerFilter) || (c.category ?? "").toLowerCase().includes(lowerFilter)
          ).length}
          defaultOpen
        >
          {dsComponents.length === 0 ? (
            <div style={{
              padding: "10px 12px",
              fontSize: "11px",
              color: "var(--color-text-secondary, #8a8a8a)",
              lineHeight: "1.5",
            }}>
              <div style={{ fontWeight: 500, marginBottom: "4px", color: "var(--color-text-secondary, #8a8a8a)" }}>
                No components in {dsName ? `"${dsName}"` : "this design system"} yet.
              </div>
              Add components in the DS workspace to make them available here.
            </div>
          ) : (
            dsComponents
              .filter((c) =>
                !lowerFilter || c.name.toLowerCase().includes(lowerFilter) || (c.category ?? "").toLowerCase().includes(lowerFilter)
              )
              .map((comp) => (
                <CompositeItem
                  key={comp.name}
                  name={comp.name}
                  description={comp.description}
                  tree={{
                    id: `ds-${comp.name.toLowerCase().replace(/\s+/g, "-")}-1`,
                    type: "DSComponent",
                    label: comp.name,
                    props: {
                      dsComponentName: comp.name,
                      selectedVariants: {},
                    },
                    style: {},
                    children: [],
                  }}
                  dragType="template-component"
                />
              ))
          )}
        </CategorySection>
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
