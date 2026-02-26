"use client";

import React from "react";

interface SPropertyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function SPropertyInput({ label, className = "", ...props }: SPropertyInputProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <input
        className={`
          w-full outline-none
          [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)]
          [border-radius:var(--s-r-md)] [color:var(--s-text-pri)]
          [padding:4px_7px] [font-size:var(--s-text-sm)]
          transition-[border-color,background] [transition-duration:0.1s]
          focus:[border-color:var(--s-accent)] focus:[background:var(--s-bg-base)]
          ${className}
        `.trim()}
        {...props}
      />
      {label && (
        <span className="[font-size:var(--s-text-2xs)] [color:var(--s-text-ter)] text-center">
          {label}
        </span>
      )}
    </div>
  );
}

export function SPropertySelect({
  label,
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <select
        className={`
          w-full outline-none appearance-none cursor-pointer
          [background:var(--s-bg-subtle)] [border:1px_solid_var(--s-border)]
          [border-radius:var(--s-r-md)] [color:var(--s-text-pri)]
          [padding:4px_7px] [font-size:var(--s-text-sm)]
          transition-[border-color,background] [transition-duration:0.1s]
          focus:[border-color:var(--s-accent)] focus:[background:var(--s-bg-base)]
          ${className}
        `.trim()}
        {...props}
      >
        {children}
      </select>
      {label && (
        <span className="[font-size:var(--s-text-2xs)] [color:var(--s-text-ter)] text-center">
          {label}
        </span>
      )}
    </div>
  );
}
