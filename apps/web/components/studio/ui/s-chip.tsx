"use client";

import React from "react";

interface SChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: "default" | "accent";
  children: React.ReactNode;
}

export function SChip({ active, variant = "default", children, className = "", ...props }: SChipProps) {
  const isAccent = variant === "accent";

  return (
    <button
      className={`
        flex items-center gap-[5px] cursor-pointer
        [padding:4px_10px] [border-radius:var(--s-r-md)]
        [font-size:var(--s-text-sm)] [font-weight:var(--s-weight-medium)]
        transition-[border-color,color,background] [transition-duration:0.1s]
        ${isAccent
          ? "[padding:5px_12px] [border-radius:var(--s-r-lg)] [font-size:var(--s-text-base)] [font-weight:var(--s-weight-semibold)] [background:var(--s-accent)] text-white border-none [letter-spacing:var(--s-tracking-tight)] hover:opacity-[0.88]"
          : active
            ? "[border:1px_solid_var(--s-accent)] [color:var(--s-accent)] [background:var(--s-accent-soft)]"
            : "[border:1px_solid_var(--s-border)] [color:var(--s-text-sec)] [background:var(--s-bg-base)] hover:[border-color:var(--s-border-dark)] hover:[color:var(--s-text-pri)]"
        }
        ${className}
      `.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
