"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { NODE_SCHEMAS } from "@/lib/studio/node-schemas";

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

type CommandItem = {
  id: string;
  label: string;
  shortcut?: string;
  category: "action" | "insert" | "screen";
  action: () => void;
};

type CommandPaletteProps = {
  onClose: () => void;
  actions: {
    undo: () => void;
    redo: () => void;
    copyNode: () => void;
    pasteNode: () => void;
    duplicateNode: () => void;
    deleteNode: () => void;
    groupIntoStack: () => void;
    renameNode: () => void;
    createComponent: () => void;
    importDesignSystem: () => void;
    createDesignSystem: () => void;
    openThemeEditor: () => void;
    openA11yPanel: () => void;
    save: () => void;
    insertNode: (nodeType: string) => void;
    navigateToScreen: (screen: string) => void;
  };
  hasSelection: boolean;
  isRoot: boolean;
};

// -------------------------------------------------------------------------
// Category badges
// -------------------------------------------------------------------------

const CATEGORY_STYLES: Record<string, string> = {
  action:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  insert:
    "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
  screen:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
};

// -------------------------------------------------------------------------
// Command palette component
// -------------------------------------------------------------------------

export function CommandPalette({
  onClose,
  actions,
  hasSelection,
  isRoot,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [screens, setScreens] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch screens list on mount
  useEffect(() => {
    fetch("/api/studio/screens")
      .then((res) => res.json())
      .then((data) => {
        if (data.screens) {
          setScreens(
            (data.screens as Array<{ name: string }>).map((s) => s.name)
          );
        }
      })
      .catch(() => {});
  }, []);

  // Build the full command list
  const allItems: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      // Actions
      { id: "undo", label: "Undo", shortcut: "Ctrl+Z", category: "action", action: actions.undo },
      { id: "redo", label: "Redo", shortcut: "Ctrl+Shift+Z", category: "action", action: actions.redo },
      { id: "copy", label: "Copy", shortcut: "Ctrl+C", category: "action", action: actions.copyNode },
      { id: "paste", label: "Paste Below", shortcut: "Ctrl+V", category: "action", action: actions.pasteNode },
      { id: "duplicate", label: "Duplicate", shortcut: "D", category: "action", action: actions.duplicateNode },
      { id: "delete", label: "Delete", shortcut: "Del", category: "action", action: actions.deleteNode },
      { id: "group", label: "Group into Stack", shortcut: "G", category: "action", action: actions.groupIntoStack },
      { id: "rename", label: "Rename", shortcut: "R", category: "action", action: actions.renameNode },
      { id: "create-component", label: "Create Component", category: "action", action: actions.createComponent },
      { id: "import-ds", label: "Import Design System", category: "action", action: actions.importDesignSystem },
      { id: "create-ds", label: "Create Design System", category: "action", action: actions.createDesignSystem },
      { id: "theme-editor", label: "Theme Editor", category: "action", action: actions.openThemeEditor },
      { id: "a11y-check", label: "Accessibility Checker", category: "action", action: actions.openA11yPanel },
      { id: "save", label: "Save & Compile", shortcut: "Cmd+S", category: "action", action: actions.save },
    ];

    // Insert node types
    for (const [key, schema] of Object.entries(NODE_SCHEMAS)) {
      items.push({
        id: `insert-${key}`,
        label: `Insert ${schema.label}`,
        category: "insert",
        action: () => actions.insertNode(key),
      });
    }

    // Screens
    for (const screen of screens) {
      items.push({
        id: `screen-${screen}`,
        label: `Go to: ${screen}`,
        category: "screen",
        action: () => actions.navigateToScreen(screen),
      });
    }

    return items;
  }, [actions, screens]);

  // Filter items by query
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.shortcut && item.shortcut.toLowerCase().includes(q))
    );
  }, [allItems, query]);

  // Keep highlight in bounds
  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  // Scroll highlighted item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const highlighted = list.children[highlightIndex] as HTMLElement | undefined;
    highlighted?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  const execute = useCallback(
    (item: CommandItem) => {
      onClose();
      // Defer action so the palette closes first
      requestAnimationFrame(() => {
        item.action();
      });
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[highlightIndex]) {
          execute(filtered[highlightIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, highlightIndex, execute, onClose]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-background border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-muted-foreground flex-shrink-0"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
          <kbd className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No matching commands
            </div>
          )}
          {filtered.map((item, idx) => {
            const isDisabled =
              (!hasSelection &&
                ["copy", "duplicate", "delete", "group", "rename", "create-component"].includes(item.id)) ||
              (isRoot &&
                ["duplicate", "delete", "group", "rename", "create-component"].includes(item.id));

            return (
              <button
                key={item.id}
                className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
                  idx === highlightIndex
                    ? "bg-accent"
                    : "hover:bg-accent/50"
                } ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
                onClick={() => {
                  if (!isDisabled) execute(item);
                }}
                onMouseEnter={() => setHighlightIndex(idx)}
                disabled={isDisabled}
              >
                {/* Category badge */}
                <span
                  className={`text-[9px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded ${
                    CATEGORY_STYLES[item.category] ?? ""
                  }`}
                >
                  {item.category === "insert"
                    ? "Insert"
                    : item.category === "screen"
                    ? "Screen"
                    : "Action"}
                </span>

                {/* Label */}
                <span className="flex-1 truncate">{item.label}</span>

                {/* Shortcut hint */}
                {item.shortcut && (
                  <kbd className="text-[10px] text-muted-foreground border rounded px-1.5 py-0.5 flex-shrink-0">
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
