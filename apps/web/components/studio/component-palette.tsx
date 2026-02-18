"use client";

import React, { useState, useEffect, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { NODE_SCHEMAS, type NodeSchema } from "@/lib/studio/node-schemas";
import { useEditorStore } from "@/lib/studio/store";

// -------------------------------------------------------------------------
// Palette item (draggable) -- built-in node types
// -------------------------------------------------------------------------

function PaletteItem({ schema }: { schema: NodeSchema }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${schema.type}`,
    data: { type: "palette", nodeType: schema.type },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm cursor-grab active:cursor-grabbing transition-colors ${
        isDragging
          ? "border-blue-500 bg-blue-50 dark:bg-blue-950 opacity-50"
          : "border-border hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      <span className="font-medium">{schema.label}</span>
      <span className="text-xs text-muted-foreground ml-auto">
        {schema.acceptsChildren ? "⊞" : "◻"}
      </span>
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
// Collapsible category section
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
        className="flex items-center gap-1.5 w-full text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 px-1 hover:text-foreground transition-colors"
      >
        <span className="w-3 h-3 flex items-center justify-center text-[10px]">
          {open ? "▾" : "▸"}
        </span>
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

const CATEGORIES = ["Layout", "Content", "Components", "Forms", "Data Display", "Feedback", "Navigation", "Surfaces", "Media"] as const;

export function ComponentPalette() {
  const schemas = Object.values(NODE_SCHEMAS);
  const customComponents = useEditorStore((s) => s.customComponents);
  const setCustomComponents = useEditorStore((s) => s.setCustomComponents);
  const removeCustomComponent = useEditorStore((s) => s.removeCustomComponent);

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
      .catch(() => {});

    fetch("/api/studio/templates")
      .then((r) => r.json())
      .then((d) => { if (d.templates) setTemplates(d.templates); })
      .catch(() => {});
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
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b font-semibold text-sm">
        Components
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {CATEGORIES.map((category) => {
          const items = schemas.filter((s) => s.category === category);
          if (items.length === 0) return null;
          return (
            <CategorySection key={category} label={category}>
              {items.map((schema) => (
                <PaletteItem key={schema.type} schema={schema} />
              ))}
            </CategorySection>
          );
        })}

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
    </div>
  );
}
