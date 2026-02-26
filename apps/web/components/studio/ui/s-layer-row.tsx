"use client";

import React from "react";

interface SLayerRowProps {
  name: string;
  icon?: React.ReactNode;
  depth?: number;
  selected?: boolean;
  expanded?: boolean;
  hasChildren?: boolean;
  onSelect?: () => void;
  onToggleExpand?: () => void;
  onToggleVisibility?: () => void;
}

export function SLayerRow({
  name,
  icon,
  depth = 0,
  selected,
  expanded,
  hasChildren,
  onSelect,
  onToggleExpand,
  onToggleVisibility,
}: SLayerRowProps) {
  const indent = 12 + depth * 14;

  return (
    <div
      onClick={onSelect}
      className={`
        group flex items-center gap-[5px] cursor-pointer
        [border-radius:var(--s-r-md)] [margin:0_4px]
        [font-size:var(--s-text-sm)] [color:var(--s-text-sec)]
        transition-[background,color] [transition-duration:0.08s]
        ${selected
          ? "[background:var(--s-accent-soft)] [color:var(--s-accent)]"
          : "hover:[background:var(--s-bg-hover)] hover:[color:var(--s-text-pri)]"
        }
      `.trim()}
      style={{ padding: `3px 10px 3px ${indent}px` }}
    >
      <span
        className="[width:10px] shrink-0 [font-size:7px] [color:var(--s-text-ter)] cursor-pointer"
        onClick={(e) => { e.stopPropagation(); onToggleExpand?.(); }}
      >
        {hasChildren ? (expanded ? "▾" : "▸") : "—"}
      </span>
      <span className={`[width:14px] shrink-0 [font-size:10px] opacity-60 ${selected ? "opacity-100" : ""}`}>
        {icon ?? "□"}
      </span>
      <span className="flex-1 whitespace-nowrap overflow-hidden text-ellipsis">
        {name}
      </span>
      <span
        className="opacity-0 group-hover:opacity-100 [font-size:10px] [color:var(--s-text-ter)] cursor-pointer"
        onClick={(e) => { e.stopPropagation(); onToggleVisibility?.(); }}
      >
        ◉
      </span>
    </div>
  );
}

export function SLayerGroupLabel({ label, onAdd }: { label: string; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between [padding:10px_12px_3px] [font-size:var(--s-text-xs)] [font-weight:var(--s-weight-semibold)] uppercase [letter-spacing:var(--s-tracking-wide)] [color:var(--s-text-ter)]">
      {label}
      {onAdd && (
        <span
          className="[color:var(--s-text-ter)] cursor-pointer [font-size:13px] leading-none hover:[color:var(--s-accent)]"
          onClick={onAdd}
        >
          +
        </span>
      )}
    </div>
  );
}
