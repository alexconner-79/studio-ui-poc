"use client";

import React from "react";
import type { CanvasControlsAPI } from "./canvas-container";

export function ZoomControls({ api }: { api: CanvasControlsAPI }) {
  const pct = Math.round(api.scale * 100);

  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-1 bg-background/90 backdrop-blur-sm border rounded-lg shadow-lg px-1 py-0.5 text-xs z-20">
      <button
        onClick={api.zoomOut}
        className="px-2 py-1 rounded hover:bg-muted transition-colors font-mono"
        title="Zoom out (Cmd+-)"
      >
        &minus;
      </button>

      <button
        onClick={api.fitToScreen}
        className="px-2 py-1 rounded hover:bg-muted transition-colors min-w-[3.5rem] text-center tabular-nums"
        title="Fit to screen (Cmd+0)"
      >
        {pct}%
      </button>

      <button
        onClick={api.zoomIn}
        className="px-2 py-1 rounded hover:bg-muted transition-colors font-mono"
        title="Zoom in (Cmd+=)"
      >
        +
      </button>
    </div>
  );
}
