"use client";

import React, { type ReactNode } from "react";

export type DeviceFrameProps = {
  label: string;
  width: number;
  minHeight?: number;
  active?: boolean;
  children: ReactNode;
  onDoubleClickLabel?: () => void;
};

export function DeviceFrame({
  label,
  width,
  minHeight = 600,
  active = false,
  children,
  onDoubleClickLabel,
}: DeviceFrameProps) {
  return (
    <div
      data-device-frame
      className="flex flex-col"
      style={{ width }}
    >
      {/* Frame label */}
      <div
        className={`flex items-center gap-2 px-3 py-1.5 text-xs select-none ${
          active
            ? "text-blue-600 dark:text-blue-400"
            : "text-muted-foreground"
        }`}
        onDoubleClick={onDoubleClickLabel}
      >
        <span className="font-medium">{label}</span>
        <span className="opacity-50">{width}px</span>
      </div>

      {/* Frame body */}
      <div
        className={`rounded-lg border bg-white dark:bg-gray-950 shadow-lg overflow-hidden transition-shadow ${
          active
            ? "ring-2 ring-blue-400/50 shadow-blue-500/10"
            : "shadow-black/5 dark:shadow-black/30"
        }`}
        style={{ width, minHeight }}
      >
        {children}
      </div>
    </div>
  );
}
