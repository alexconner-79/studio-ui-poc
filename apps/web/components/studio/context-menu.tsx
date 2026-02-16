"use client";

import React, { useEffect, useRef } from "react";
import { useEditorStore } from "@/lib/studio/store";
import type { Node } from "@/lib/studio/types";

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

type MenuItem = {
  label: string;
  shortcut?: string;
  action: () => void;
  disabled?: boolean;
  danger?: boolean;
};

export function ContextMenu({
  x,
  y,
  onClose,
}: {
  x: number;
  y: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const spec = useEditorStore((s) => s.spec);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const clipboard = useEditorStore((s) => s.clipboard);
  const copyNode = useEditorStore((s) => s.copyNode);
  const pasteNode = useEditorStore((s) => s.pasteNode);
  const duplicateNode = useEditorStore((s) => s.duplicateNode);
  const moveNodeUp = useEditorStore((s) => s.moveNodeUp);
  const moveNodeDown = useEditorStore((s) => s.moveNodeDown);
  const removeNode = useEditorStore((s) => s.removeNode);

  const lockedNodeIds = useEditorStore((s) => s.lockedNodeIds);
  const isRoot = selectedNodeId === spec?.tree.id;
  const isLocked = selectedNodeId ? lockedNodeIds.has(selectedNodeId) : false;

  // Close on click outside or Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const items: MenuItem[] = [
    {
      label: "Copy",
      shortcut: "Ctrl+C",
      action: () => { copyNode(); onClose(); },
      disabled: !selectedNodeId,
    },
    {
      label: "Paste Below",
      shortcut: "Ctrl+V",
      action: () => { pasteNode(); onClose(); },
      disabled: !clipboard,
    },
    {
      label: "Duplicate",
      shortcut: "Ctrl+D",
      action: () => { duplicateNode(); onClose(); },
      disabled: !selectedNodeId || isRoot || isLocked,
    },
    {
      label: "Move Up",
      action: () => { moveNodeUp(); onClose(); },
      disabled: !selectedNodeId || isRoot || isLocked,
    },
    {
      label: "Move Down",
      action: () => { moveNodeDown(); onClose(); },
      disabled: !selectedNodeId || isRoot || isLocked,
    },
    {
      label: "Delete",
      shortcut: "Del",
      action: () => {
        if (selectedNodeId && !isRoot && !isLocked) removeNode(selectedNodeId);
        onClose();
      },
      disabled: !selectedNodeId || isRoot || isLocked,
      danger: true,
    },
    {
      label: "Create Component",
      action: () => {
        if (selectedNodeId && !isRoot) {
          const name = window.prompt("Component name:");
          if (name && name.trim()) {
            // Find the selected node subtree and save as component
            const tree = spec ? findNode(spec.tree, selectedNodeId) : null;
            if (tree) {
              fetch("/api/studio/components", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), description: "", tree }),
              })
                .then((res) => res.json())
                .then((data) => {
                  if (data.component) {
                    useEditorStore.getState().addCustomComponent(data.component);
                  }
                })
                .catch(() => {});
            }
          }
        }
        onClose();
      },
      disabled: !selectedNodeId || isRoot,
    },
  ];

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-popover border rounded-lg shadow-lg py-1 min-w-[180px] text-sm"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          disabled={item.disabled}
          onClick={item.action}
          className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-4 transition-colors ${
            item.disabled
              ? "text-muted-foreground cursor-not-allowed opacity-50"
              : item.danger
              ? "hover:bg-destructive/10 text-destructive"
              : "hover:bg-accent"
          }`}
        >
          <span>{item.label}</span>
          {item.shortcut && (
            <span className="text-[10px] text-muted-foreground">
              {item.shortcut}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
