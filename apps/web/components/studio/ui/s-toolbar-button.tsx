"use client";

import React from "react";

interface SToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon: React.ReactNode;
}

export function SToolbarButton({ active, icon, className = "", ...props }: SToolbarButtonProps) {
  return (
    <button
      className={`
        flex items-center justify-center shrink-0 border-none cursor-pointer
        transition-[background,color]
        [width:var(--s-toolbar-btn)] [height:var(--s-toolbar-btn)]
        [border-radius:var(--s-r-md)]
        [font-size:var(--s-text-sm)]
        ${active
          ? "[background:var(--s-accent-soft)] [color:var(--s-accent)]"
          : "[background:transparent] [color:var(--s-text-sec)] hover:[background:var(--s-bg-hover)] hover:[color:var(--s-text-pri)]"
        }
        [transition-duration:0.1s]
        ${className}
      `.trim()}
      {...props}
    >
      {icon}
    </button>
  );
}
