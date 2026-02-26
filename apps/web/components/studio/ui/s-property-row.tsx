"use client";

import React from "react";

interface SPropertyRowProps {
  label: string;
  children: React.ReactNode;
}

export function SPropertyRow({ label, children }: SPropertyRowProps) {
  return (
    <div className="flex items-center gap-1.5 [margin-bottom:5px]">
      <span className="[width:30px] shrink-0 [font-size:var(--s-text-xs)] [color:var(--s-text-sec)]">
        {label}
      </span>
      <div className="flex-1 flex items-center gap-1.5">
        {children}
      </div>
    </div>
  );
}
