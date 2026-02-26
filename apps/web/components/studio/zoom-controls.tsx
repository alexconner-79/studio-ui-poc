"use client";

import React from "react";
import type { CanvasControlsAPI } from "./canvas-container";

export function ZoomControls({ api }: { api: CanvasControlsAPI }) {
  const pct = Math.round(api.scale * 100);

  return (
    <div
      className="absolute bottom-4 right-4 flex items-center gap-0.5 z-20 backdrop-blur-sm"
      style={{
        background: "var(--s-bg-panel)",
        border: "1px solid var(--s-border)",
        borderRadius: "var(--s-r-lg)",
        boxShadow: "var(--s-shadow-md)",
        padding: "2px",
        fontSize: "var(--s-text-xs)",
      }}
    >
      <button
        onClick={api.zoomOut}
        className="border-none cursor-pointer font-mono"
        style={{
          padding: "4px 8px",
          borderRadius: "var(--s-r-md)",
          background: "transparent",
          color: "var(--s-text-sec)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--s-bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        title="Zoom out (Cmd+-)"
      >
        &minus;
      </button>

      <button
        onClick={api.fitToScreen}
        className="border-none cursor-pointer tabular-nums"
        style={{
          padding: "4px 8px",
          borderRadius: "var(--s-r-md)",
          background: "transparent",
          color: "var(--s-text-pri)",
          minWidth: "3.5rem",
          textAlign: "center",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--s-bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        title="Fit to screen (Cmd+0)"
      >
        {pct}%
      </button>

      <button
        onClick={api.zoomIn}
        className="border-none cursor-pointer font-mono"
        style={{
          padding: "4px 8px",
          borderRadius: "var(--s-r-md)",
          background: "transparent",
          color: "var(--s-text-sec)",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--s-bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        title="Zoom in (Cmd+=)"
      >
        +
      </button>
    </div>
  );
}
