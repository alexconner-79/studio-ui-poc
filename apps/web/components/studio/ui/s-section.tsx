"use client";

import React, { useState } from "react";

interface SSectionProps {
  title: string;
  children: React.ReactNode;
  onAdd?: () => void;
  defaultOpen?: boolean;
}

export function SSection({ title, children, onAdd, defaultOpen = true }: SSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="[border-bottom:1px_solid_var(--s-border)] [padding:10px_12px] last:border-b-0">
      <div
        className="flex items-center justify-between [margin-bottom:8px] cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <span
          className="
            [font-size:var(--s-text-xs)] [font-weight:var(--s-weight-semibold)]
            uppercase [letter-spacing:var(--s-tracking-wide)] [color:var(--s-text-ter)]
          "
        >
          {title}
        </span>
        <div className="flex items-center gap-1">
          {onAdd && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdd(); }}
              className="
                flex items-center justify-center
                [width:16px] [height:16px] [border-radius:var(--s-r-sm)]
                bg-transparent border-none cursor-pointer
                [color:var(--s-text-ter)] [font-size:14px] leading-none
                hover:[background:var(--s-bg-hover)] hover:[color:var(--s-text-pri)]
                transition-[background,color] [transition-duration:0.1s]
              "
            >
              +
            </button>
          )}
          <span className="[font-size:8px] [color:var(--s-text-ter)]">{open ? "▾" : "▸"}</span>
        </div>
      </div>
      {open && children}
    </div>
  );
}
