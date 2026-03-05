"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function ColorPicker({
  value = "#000000",
  onChange,
  className,
}: {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="w-8 h-8 rounded-md border border-input shadow-sm overflow-hidden"
        style={{ background: value }}
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="opacity-0 w-full h-full cursor-pointer"
        />
      </div>
      <span className="text-sm font-mono text-muted-foreground">{value}</span>
    </div>
  );
}
