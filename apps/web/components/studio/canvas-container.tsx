"use client";

import React, {
  useRef,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type CanvasTransform = {
  scale: number;
  translateX: number;
  translateY: number;
};

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.1;
const ZOOM_SENSITIVITY = 0.002;

// Context for zoom controls
export type CanvasControlsAPI = {
  scale: number;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (s: number) => void;
  fitToScreen: () => void;
};

export const CanvasControlsContext = React.createContext<CanvasControlsAPI>({
  scale: 1,
  zoomIn: () => {},
  zoomOut: () => {},
  zoomTo: () => {},
  fitToScreen: () => {},
});

/**
 * Zoomable, pannable canvas container with controls context.
 */
export function CanvasContainerWithControls({
  children,
  controls,
}: {
  children: ReactNode;
  controls?: (api: CanvasControlsAPI) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<CanvasTransform>({
    scale: 0.7,
    translateX: 0,
    translateY: 0,
  });
  const [, forceUpdate] = useState(0);
  const isPanningRef = useRef(false);
  const isSpacebarRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });

  const applyTransform = useCallback(() => {
    forceUpdate((n) => n + 1);
  }, []);

  const clampScaleFn = (s: number) =>
    Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s));

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const t = transformRef.current;

      if (e.ctrlKey || e.metaKey) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;
        const prevScale = t.scale;
        const newScale = clampScaleFn(
          prevScale - e.deltaY * ZOOM_SENSITIVITY
        );
        const ratio = newScale / prevScale;
        transformRef.current = {
          scale: newScale,
          translateX: cursorX - ratio * (cursorX - t.translateX),
          translateY: cursorY - ratio * (cursorY - t.translateY),
        };
      } else {
        transformRef.current = {
          ...t,
          translateX: t.translateX - e.deltaX,
          translateY: t.translateY - e.deltaY,
        };
      }
      applyTransform();
    },
    [applyTransform]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !e.repeat &&
        !(
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        )
      ) {
        e.preventDefault();
        isSpacebarRef.current = true;
        if (containerRef.current)
          containerRef.current.style.cursor = "grab";
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpacebarRef.current = false;
        isPanningRef.current = false;
        if (containerRef.current)
          containerRef.current.style.cursor = "";
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isSpacebarRef.current || e.button === 1) {
      isPanningRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      if (containerRef.current)
        containerRef.current.style.cursor = "grabbing";
      e.preventDefault();
    }
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanningRef.current) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      const t = transformRef.current;
      transformRef.current = {
        ...t,
        translateX: t.translateX + dx,
        translateY: t.translateY + dy,
      };
      applyTransform();
    },
    [applyTransform]
  );

  const handlePointerUp = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      if (containerRef.current)
        containerRef.current.style.cursor = isSpacebarRef.current
          ? "grab"
          : "";
    }
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const zoomTo = useCallback(
    (newScale: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const t = transformRef.current;
      const prevScale = t.scale;
      const clamped = clampScaleFn(newScale);
      const ratio = clamped / prevScale;
      transformRef.current = {
        scale: clamped,
        translateX: cx - ratio * (cx - t.translateX),
        translateY: cy - ratio * (cy - t.translateY),
      };
      applyTransform();
    },
    [applyTransform]
  );

  const zoomIn = useCallback(
    () => zoomTo(transformRef.current.scale + ZOOM_STEP),
    [zoomTo]
  );
  const zoomOut = useCallback(
    () => zoomTo(transformRef.current.scale - ZOOM_STEP),
    [zoomTo]
  );

  const fitToScreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const transformLayer = container.querySelector<HTMLElement>(
      "[data-canvas-transform]"
    );
    if (!transformLayer) return;

    const frames = transformLayer.querySelectorAll<HTMLElement>(
      "[data-device-frame]"
    );
    if (frames.length === 0) {
      transformRef.current = { scale: 0.7, translateX: 0, translateY: 0 };
      applyTransform();
      return;
    }

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    frames.forEach((frame) => {
      const left = frame.offsetLeft;
      const top = frame.offsetTop;
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, left + frame.offsetWidth);
      maxY = Math.max(maxY, top + frame.offsetHeight);
    });

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const padding = 64;
    const cW = container.clientWidth - padding * 2;
    const cH = container.clientHeight - padding * 2;
    const scale = clampScaleFn(Math.min(cW / contentW, cH / contentH));
    const translateX =
      (container.clientWidth - contentW * scale) / 2 - minX * scale;
    const translateY =
      (container.clientHeight - contentH * scale) / 2 - minY * scale;
    transformRef.current = { scale, translateX, translateY };
    applyTransform();
  }, [applyTransform]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        zoomIn();
      } else if (e.key === "-") {
        e.preventDefault();
        zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        fitToScreen();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [zoomIn, zoomOut, fitToScreen]);

  const { scale, translateX, translateY } = transformRef.current;

  const api: CanvasControlsAPI = {
    scale,
    zoomIn,
    zoomOut,
    zoomTo,
    fitToScreen,
  };

  return (
    <CanvasControlsContext.Provider value={api}>
      <div
        ref={containerRef}
        className="relative w-full h-full overflow-hidden"
        style={{
          background:
            "radial-gradient(circle, hsl(var(--muted)/0.3) 1px, transparent 1px)",
          backgroundSize: `${20 * scale}px ${20 * scale}px`,
          backgroundPosition: `${translateX}px ${translateY}px`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        data-canvas-container
      >
        <div
          data-canvas-transform
          style={{
            transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
            transformOrigin: "0 0",
            willChange: "transform",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {children}
        </div>

        {/* Floating controls */}
        {controls?.(api)}
      </div>
    </CanvasControlsContext.Provider>
  );
}
