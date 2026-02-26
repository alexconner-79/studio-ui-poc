"use client";

import React from "react";

interface SAlignButtonProps {
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
  title?: string;
}

function SAlignButton({ icon, active, onClick, title }: SAlignButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`
        flex-1 flex items-center justify-center
        [height:25px] [font-size:10px] cursor-pointer
        [border-radius:var(--s-r-sm)]
        transition-[background,color,border-color] [transition-duration:0.08s]
        ${active
          ? "[background:var(--s-accent-soft)] [color:var(--s-accent)] [border:1px_solid_var(--s-accent-mid)]"
          : "[background:var(--s-bg-subtle)] [color:var(--s-text-sec)] [border:1px_solid_var(--s-border)] hover:[background:var(--s-bg-active)] hover:[color:var(--s-text-pri)]"
        }
      `.trim()}
    >
      {icon}
    </button>
  );
}

interface SAlignGroupProps {
  items: { icon: React.ReactNode; active?: boolean; onClick?: () => void; title?: string }[];
}

export function SAlignGroup({ items }: SAlignGroupProps) {
  return (
    <div className="flex gap-0.5">
      {items.map((item, i) => (
        <SAlignButton key={i} {...item} />
      ))}
    </div>
  );
}
