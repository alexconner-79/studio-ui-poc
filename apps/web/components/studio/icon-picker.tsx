"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { icons } from "lucide-react";

// Build a sorted list of all icon names once
const ALL_ICON_NAMES = Object.keys(icons).sort();

// -------------------------------------------------------------------------
// Icon grid item
// -------------------------------------------------------------------------

function IconGridItem({
  name,
  selected,
  onSelect,
}: {
  name: string;
  selected: boolean;
  onSelect: (name: string) => void;
}) {
  const LucideIcon = icons[name as keyof typeof icons];
  if (!LucideIcon) return null;

  return (
    <button
      onClick={() => onSelect(name)}
      className={`flex flex-col items-center justify-center p-1.5 rounded transition-colors ${
        selected
          ? "bg-blue-500/15 ring-1 ring-blue-500"
          : "hover:bg-accent"
      }`}
      title={name}
    >
      <LucideIcon size={18} />
      <span className="text-[8px] text-muted-foreground mt-0.5 truncate w-full text-center">
        {name}
      </span>
    </button>
  );
}

// -------------------------------------------------------------------------
// Icon picker popover
// -------------------------------------------------------------------------

export function IconPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as HTMLElement)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return ALL_ICON_NAMES.slice(0, 60);
    const q = search.toLowerCase();
    return ALL_ICON_NAMES.filter((name) =>
      name.toLowerCase().includes(q)
    ).slice(0, 60);
  }, [search]);

  const handleSelect = useCallback(
    (name: string) => {
      onChange(name);
      setOpen(false);
      setSearch("");
    },
    [onChange]
  );

  // Render current icon preview
  const CurrentIcon = value ? icons[value as keyof typeof icons] : null;

  return (
    <div className="space-y-1" ref={containerRef}>
      <label className="text-xs font-medium text-muted-foreground">
        Icon Name
      </label>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm border rounded-md bg-background hover:bg-accent transition-colors text-left"
      >
        {CurrentIcon ? (
          <CurrentIcon size={16} />
        ) : (
          <span className="w-4 h-4 bg-muted rounded" />
        )}
        <span className="flex-1 truncate">{value || "Select icon..."}</span>
        <span className="text-muted-foreground text-xs">▾</span>
      </button>

      {open && (
        <div className="border rounded-md bg-popover shadow-lg p-2 space-y-2 z-50">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons..."
            className="w-full px-2 py-1 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
          <div className="grid grid-cols-5 gap-1 max-h-48 overflow-y-auto">
            {filtered.map((name) => (
              <IconGridItem
                key={name}
                name={name}
                selected={name === value}
                onSelect={handleSelect}
              />
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No icons found
            </p>
          )}
          {search.trim() === "" && (
            <p className="text-[10px] text-muted-foreground text-center">
              Showing top 60 of {ALL_ICON_NAMES.length} icons. Type to search.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
