"use client";

import React, { useContext, useRef, useCallback, type ReactNode } from "react";
import { CanvasControlsContext } from "./canvas-container";

export type DeviceFrameProps = {
  label: string;
  width?: number;
  minHeight?: number;
  active?: boolean;
  isSelected?: boolean;
  children: ReactNode;
  onDoubleClickLabel?: () => void;
  onLabelClick?: () => void;
  /** Called while dragging the right-edge handle to update the artboard width. */
  onWidthChange?: (newWidth: number) => void;
};

export function DeviceFrame({
  label,
  width,
  minHeight = 600,
  active = false,
  isSelected = false,
  children,
  onDoubleClickLabel,
  onLabelClick,
  onWidthChange,
}: DeviceFrameProps) {
  const { scale } = useContext(CanvasControlsContext);
  const inv = 1 / (scale || 1);
  const isFull = !width;

  // Drag-to-resize — right edge handle
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const [dragPreview, setDragPreview] = React.useState<number | null>(null);

  const handleDragMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!onWidthChange || isFull) return;
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = width ?? 0;

      const onMove = (me: MouseEvent) => {
        if (!isDraggingRef.current) return;
        // Delta is scaled by canvas zoom so 1 CSS px = 1 logical px
        const delta = (me.clientX - startXRef.current) / (scale || 1);
        const next = Math.round(Math.max(200, Math.min(3840, startWidthRef.current + delta)));
        setDragPreview(next);
        onWidthChange(next);
      };

      const onUp = () => {
        isDraggingRef.current = false;
        setDragPreview(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [onWidthChange, isFull, width, scale],
  );

  const displayWidth = dragPreview ?? width;

  return (
    <div
      data-device-frame
      className="flex flex-col"
      style={{ width: isFull ? "100%" : displayWidth, position: "relative" }}
    >
      {/* Frame label — clicking selects the artboard */}
      <div
        className={`flex items-center select-none ${onLabelClick ? "cursor-default hover:opacity-80" : ""}`}
        style={{
          color: isSelected ? "var(--s-accent)" : active ? "var(--s-accent)" : "var(--s-text-ter)",
          fontSize: `${11 * inv}px`,
          gap: `${6 * inv}px`,
          padding: `${6 * inv}px ${10 * inv}px`,
        }}
        onClick={onLabelClick}
        onDoubleClick={onDoubleClickLabel}
      >
        <span style={{ fontWeight: "var(--s-weight-medium)" as unknown as number }}>{label}</span>
        <span className="opacity-50">
          {isFull ? "100%" : `${dragPreview ?? width}px`}
        </span>
      </div>

      {/* Frame body */}
      <div
        className="overflow-hidden transition-shadow"
        style={{
          width: isFull ? "100%" : displayWidth,
          minHeight,
          borderRadius: 0,
          border: isSelected ? `1.5px solid var(--s-accent)` : `1px solid var(--s-border)`,
          background: "var(--s-bg-base)",
          boxShadow: isSelected ? "0 0 0 2px var(--s-accent,#3b82f6)33" : "var(--s-shadow-sm)",
        }}
      >
        {children}
      </div>

      {/* Right-edge drag handle — only shown for fixed-width artboards */}
      {!isFull && onWidthChange && (
        <div
          onMouseDown={handleDragMouseDown}
          title="Drag to resize artboard"
          style={{
            position: "absolute",
            right: -5,
            top: "24px", // below the label
            bottom: 0,
            width: 10,
            cursor: "col-resize",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Visual pill */}
          <div
            style={{
              width: 3,
              height: 32,
              borderRadius: 3,
              background: isDraggingRef.current
                ? "var(--s-accent)"
                : "var(--s-border)",
              transition: "background 0.1s",
            }}
            className="group-hover:opacity-100 opacity-0 hover:opacity-100"
          />
        </div>
      )}
    </div>
  );
}
