"use client";

import React from "react";

interface SPanelTabProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function SPanelTab({ label, active, onClick }: SPanelTabProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex-1 border-none cursor-pointer bg-transparent
        [padding:9px_8px] [font-size:var(--s-text-sm)] [font-weight:var(--s-weight-medium)]
        [border-bottom:2px_solid_transparent] [margin-bottom:-1px]
        transition-colors [transition-duration:0.1s]
        ${active
          ? "[color:var(--s-accent)] ![border-bottom-color:var(--s-accent)]"
          : "[color:var(--s-text-ter)] hover:[color:var(--s-text-sec)]"
        }
      `.trim()}
    >
      {label}
    </button>
  );
}

export function SPanelTabStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center [padding:0_6px] [border-bottom:1px_solid_var(--s-border)]">
      {children}
    </div>
  );
}
