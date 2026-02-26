"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";

// -------------------------------------------------------------------------
// Lazy icon module -- loaded on first open to avoid ~1500 icons at startup
// -------------------------------------------------------------------------

type LucideIconType = React.ComponentType<{ size?: number }>;
type LucideModule = Record<string, LucideIconType>;

let cachedModule: LucideModule | null = null;
let cachedNames: string[] | null = null;

async function getLucideModule(): Promise<LucideModule> {
  if (!cachedModule) {
    cachedModule = (await import("lucide-react")) as unknown as LucideModule;
    // Only include proper PascalCase icon component names (e.g. "ArrowLeft").
    // Utility exports like createLucideIcon, toCamelCase, etc. start with lowercase
    // and would crash when React tries to render them as components.
    cachedNames = Object.keys(cachedModule)
      .filter((k) => typeof cachedModule![k] === "function" && /^[A-Z][A-Za-z0-9]+$/.test(k))
      .sort();
  }
  return cachedModule;
}

// -------------------------------------------------------------------------
// Icon grid item -- renders via the already-loaded module cache
// -------------------------------------------------------------------------

function IconGridItem({
  name,
  mod,
  selected,
  onSelect,
}: {
  name: string;
  mod: LucideModule;
  selected: boolean;
  onSelect: (name: string) => void;
}) {
  const LucideIcon = mod[name];
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
  const [iconMod, setIconMod] = useState<LucideModule | null>(cachedModule);
  const [allNames, setAllNames] = useState<string[]>(cachedNames ?? []);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load the icon module when the picker is first opened
  useEffect(() => {
    if (!open || cachedModule) return;
    getLucideModule().then((mod) => {
      setIconMod(mod);
      setAllNames(cachedNames ?? []);
    });
  }, [open]);

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
    if (!search.trim()) return allNames.slice(0, 60);
    const q = search.toLowerCase();
    return allNames.filter((name) =>
      name.toLowerCase().includes(q)
    ).slice(0, 60);
  }, [search, allNames]);

  const handleSelect = useCallback(
    (name: string) => {
      onChange(name);
      setOpen(false);
      setSearch("");
    },
    [onChange]
  );

  // Render current icon preview using the cached module if available
  const CurrentIcon = value && iconMod ? iconMod[value] : null;

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
          {!iconMod ? (
            <p className="text-xs text-muted-foreground text-center py-4">Loading icons…</p>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-1 max-h-48 overflow-y-auto">
                {filtered.map((name) => (
                  <IconGridItem
                    key={name}
                    name={name}
                    mod={iconMod}
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
              {search.trim() === "" && allNames.length > 60 && (
                <p className="text-[10px] text-muted-foreground text-center">
                  Showing top 60 of {allNames.length} icons. Type to search.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
