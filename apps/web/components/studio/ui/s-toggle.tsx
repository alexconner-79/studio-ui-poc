"use client";

import React from "react";

interface SToggleProps {
  label?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function SToggle({ label, checked, onChange }: SToggleProps) {
  return (
    <div className="flex items-center justify-between [padding:3px_0]">
      {label && (
        <span className="[font-size:var(--s-text-sm)] [color:var(--s-text-sec)]">{label}</span>
      )}
      <div
        onClick={() => onChange(!checked)}
        className={`
          relative cursor-pointer shrink-0
          [width:28px] [height:15px] [border-radius:8px]
          transition-colors [transition-duration:0.15s]
          ${checked ? "[background:var(--s-accent)]" : "[background:var(--s-border-dark)]"}
          after:content-[''] after:absolute after:[width:11px] after:[height:11px]
          after:rounded-full after:bg-white after:[top:2px]
          after:[box-shadow:0_1px_3px_rgba(0,0,0,0.15)]
          after:transition-[left] after:[transition-duration:0.15s]
          ${checked ? "after:[left:15px]" : "after:[left:2px]"}
        `.trim()}
      />
    </div>
  );
}
