"use client";

import React, { useContext, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useEditorStore } from "@/lib/studio/store";
import type { NodeStyle, Node } from "@/lib/studio/types";
import type { GuideLine, DistanceIndicator } from "@/lib/studio/geometry";
import { collectSnapTargets, snapResize, makeBBox, getNodeBBoxes, combinedBBox, type BBox } from "@/lib/studio/geometry";
import { CanvasControlsContext } from "./canvas-container";

type Rect = { top: number; left: number; width: number; height: number };
type Sides = { top: number; right: number; bottom: number; left: number };
type Side = "top" | "right" | "bottom" | "left";
type ZoneType = "margin" | "padding" | "resize";

const ACCENT = "#3b82f6";
const MARGIN_FG = "#f97316";
const MARGIN_BG = "rgba(251, 146, 60, 0.16)";
const MARGIN_BG_DRAG = "rgba(251, 146, 60, 0.30)";
const PADDING_FG = "#22c55e";
const PADDING_BG = "rgba(34, 197, 94, 0.16)";
const PADDING_BG_DRAG = "rgba(34, 197, 94, 0.30)";

const STRIPE_MARGIN = `repeating-linear-gradient(-45deg,transparent,transparent 4px,rgba(251,146,60,0.07) 4px,rgba(251,146,60,0.07) 8px)`;
const STRIPE_PADDING = `repeating-linear-gradient(-45deg,transparent,transparent 4px,rgba(34,197,94,0.07) 4px,rgba(34,197,94,0.07) 8px)`;

const ZONE_W = 6;
const CORNER_SIZE = 9;

const STYLE_KEY: Record<string, keyof NodeStyle> = {
  "margin-top": "marginTop", "margin-right": "marginRight",
  "margin-bottom": "marginBottom", "margin-left": "marginLeft",
  "padding-top": "paddingTop", "padding-right": "paddingRight",
  "padding-bottom": "paddingBottom", "padding-left": "paddingLeft",
};

function getScale(el: HTMLElement): number {
  const t = el.closest("[data-canvas-transform]") as HTMLElement | null;
  if (!t) return 1;
  const m = t.style.transform.match(/scale\(([\d.]+)\)/);
  return m ? parseFloat(m[1]) : 1;
}

function Pill({ label, color, style, isSnapped, scale = 1 }: { label: string; color: string; style?: React.CSSProperties; isSnapped?: boolean; scale?: number }) {
  const inv = 1 / (scale || 1);
  return (
    <div style={{ position: "absolute", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 10, ...style }}>
      <span style={{
        background: isSnapped ? "#6c47ff" : color, color: "#fff",
        fontSize: 12 * inv, fontWeight: 600, lineHeight: 1,
        padding: `${3.5 * inv}px ${8 * inv}px`, borderRadius: 4 * inv,
        whiteSpace: "nowrap",
        boxShadow: isSnapped
          ? "0 2px 8px rgba(108,71,255,0.5), 0 0 0 2px rgba(108,71,255,0.25)"
          : "0 1px 4px rgba(0,0,0,0.18)",
        letterSpacing: 0.2,
        outline: isSnapped ? "1.5px solid rgba(255,255,255,0.4)" : undefined,
      }}>
        {isSnapped && "⚡ "}{label}
      </span>
    </div>
  );
}

export function SpacingOverlay() {
  const { scale } = useContext(CanvasControlsContext);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const spec = useEditorStore((s) => s.spec);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const designTokens = useEditorStore((s) => s.designTokens);
  const setSmartGuides = useEditorStore((s) => s.setSmartGuides);
  const clearSmartGuides = useEditorStore((s) => s.clearSmartGuides);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const overlayRef = useRef<HTMLDivElement>(null);
  const snapTargetsRef = useRef<BBox[]>([]);

  const [rect, setRect] = useState<Rect | null>(null);
  const [margins, setMargins] = useState<Sides>({ top: 0, right: 0, bottom: 0, left: 0 });
  const [paddings, setPaddings] = useState<Sides>({ top: 0, right: 0, bottom: 0, left: 0 });

  const [activeZone, setActiveZone] = useState<{ type: ZoneType; side: Side } | null>(null);

  const dragRef = useRef<{
    zone: "margin" | "padding";
    side: Side;
    axis: "x" | "y";
    sign: number;
    startPos: number;
    startVal: number;
  } | null>(null);
  const [dragInfo, setDragInfo] = useState<{ zone: "margin" | "padding"; side: Side; value: number; tokenName?: string } | null>(null);

  // Build sorted spacing-token scale from design system
  const tokenScale = useMemo(() => {
    if (!designTokens?.spacing) return null;
    const entries: { name: string; px: number }[] = [];
    for (const [name, tok] of Object.entries(designTokens.spacing)) {
      // tok.value may be a string, a number, or a dual-value object { web, native }
      const raw = tok.value;
      let strVal: string;
      if (typeof raw === "string") {
        strVal = raw;
      } else if (typeof raw === "number") {
        strVal = `${raw}px`;
      } else if (raw && typeof raw === "object") {
        const dualVal = (raw as Record<string, unknown>).web ?? (raw as Record<string, unknown>).native;
        if (typeof dualVal === "string") strVal = dualVal;
        else if (typeof dualVal === "number") strVal = `${dualVal}px`;
        else continue;
      } else {
        continue;
      }
      const m = strVal.match(/^([\d.]+)(px|rem)?$/);
      if (m) {
        let px = parseFloat(m[1]);
        if (m[2] === "rem") px *= 16;
        entries.push({ name, px });
      }
    }
    entries.sort((a, b) => a.px - b.px);
    return entries.length > 0 ? entries : null;
  }, [designTokens]);

  const snapToScale = useCallback((raw: number): { value: number; tokenName?: string } => {
    if (tokenScale) {
      let closest = tokenScale[0];
      let minDist = Math.abs(raw - closest.px);
      for (const entry of tokenScale) {
        const dist = Math.abs(raw - entry.px);
        if (dist < minDist) { closest = entry; minDist = dist; }
      }
      if (minDist <= 4) return { value: closest.px, tokenName: closest.name };
    }
    // Fall back to 8px grid
    return { value: Math.round(raw / 8) * 8 };
  }, [tokenScale]);

  const resizeRef = useRef<{
    handle: Side | "nw" | "ne" | "sw" | "se";
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    startTop: number;
    startLeft: number;
    isAbsolute: boolean;
    activated: boolean;
  } | null>(null);
  const [resizeInfo, setResizeInfo] = useState<{ width: number; height: number } | null>(null);
  const [hoveredHandle, setHoveredHandle] = useState<string | null>(null);
  const [resizeModifier, setResizeModifier] = useState<"shift" | "alt" | null>(null);

  // ---- Measurement ----
  const measure = useCallback(() => {
    if (dragRef.current || resizeRef.current) return;
    if (!selectedNodeId) { setRect(null); return; }
    const el = document.querySelector(`[data-studio-node="${selectedNodeId}"]`) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    const canvas = el.closest("[data-canvas-root]") as HTMLElement | null;
    if (!canvas) { setRect(null); return; }
    const scale = getScale(canvas);
    const cr = canvas.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    setRect({ top: (er.top - cr.top) / scale, left: (er.left - cr.left) / scale, width: er.width / scale, height: er.height / scale });
    const cs = window.getComputedStyle(el);
    setMargins({ top: parseFloat(cs.marginTop) || 0, right: parseFloat(cs.marginRight) || 0, bottom: parseFloat(cs.marginBottom) || 0, left: parseFloat(cs.marginLeft) || 0 });
    setPaddings({ top: parseFloat(cs.paddingTop) || 0, right: parseFloat(cs.paddingRight) || 0, bottom: parseFloat(cs.paddingBottom) || 0, left: parseFloat(cs.paddingLeft) || 0 });
  }, [selectedNodeId]);

  useEffect(() => { measure(); const id = setInterval(measure, 300); return () => clearInterval(id); }, [measure, spec]);

  // ---- Spacing drag ----
  const startSpacingDrag = useCallback((zone: "margin" | "padding", side: Side, currentVal: number) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const isVert = side === "top" || side === "bottom";
    const baseSign = (side === "bottom" || side === "right") ? 1 : -1;
    const sign = zone === "padding" ? -baseSign : baseSign;
    dragRef.current = { zone, side, axis: isVert ? "y" : "x", sign, startPos: isVert ? e.clientY : e.clientX, startVal: currentVal };
    setDragInfo({ zone, side, value: currentVal });
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || !selectedNodeId) return;
      const scale = overlayRef.current ? getScale(overlayRef.current) : 1;
      const pos = d.axis === "y" ? e.clientY : e.clientX;
      const rawVal = Math.max(0, d.startVal + ((pos - d.startPos) / scale) * d.sign);
      const snapped = snapToScale(rawVal);
      const newVal = Math.max(0, Math.round(snapped.value));
      setDragInfo({ zone: d.zone, side: d.side, value: newVal, tokenName: snapped.tokenName });
      updateNodeStyle(selectedNodeId, { [STYLE_KEY[`${d.zone}-${d.side}`]]: `${newVal}px` });
    };
    const onUp = () => { if (!dragRef.current) return; dragRef.current = null; setDragInfo(null); setActiveZone(null); setTimeout(measure, 50); };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [selectedNodeId, updateNodeStyle, measure, snapToScale]);

  // ---- Resize drag (edges + corners) ----
  const startResize = useCallback((handle: Side | "nw" | "ne" | "sw" | "se") => (e: React.PointerEvent) => {
    if (!rect || !selectedNodeId || !spec) return;
    e.preventDefault(); e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const el = document.querySelector(`[data-studio-node="${selectedNodeId}"]`) as HTMLElement | null;
    const cs = el ? window.getComputedStyle(el) : null;
    resizeRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startW: rect.width,
      startH: rect.height,
      startTop: parseFloat(cs?.top || "0") || 0,
      startLeft: parseFloat(cs?.left || "0") || 0,
      isAbsolute: cs?.position === "absolute",
      activated: false,
    };
    setHoveredHandle(null);
    setResizeInfo({ width: rect.width, height: rect.height });
    // Cache snap targets at resize start
    const canvasEl = document.querySelector("[data-canvas-root]") as HTMLElement | null;
    if (canvasEl) {
      const scale = overlayRef.current ? getScale(overlayRef.current) : 1;
      snapTargetsRef.current = collectSnapTargets(selectedNodeId, spec.tree, canvasEl, scale);
    }
  }, [rect, selectedNodeId, spec]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = resizeRef.current;
      if (!r || !selectedNodeId) return;

      // 4px activation threshold — prevents accidental resizes from clicks
      if (!r.activated) {
        const dist = Math.sqrt(Math.pow(e.clientX - r.startX, 2) + Math.pow(e.clientY - r.startY, 2));
        if (dist < 4) return;
        r.activated = true;
      }

      // Track modifier key for visual indicator
      const mod = e.shiftKey ? "shift" : e.altKey ? "alt" : null;
      setResizeModifier(mod);

      const scale = overlayRef.current ? getScale(overlayRef.current) : 1;
      const dx = (e.clientX - r.startX) / scale;
      const dy = (e.clientY - r.startY) / scale;
      const h = r.handle;
      const style: Partial<NodeStyle> = {};
      const isEdge = h === "top" || h === "bottom" || h === "left" || h === "right";

      let newW = r.startW;
      let newH = r.startH;
      let posTop = r.startTop;
      let posLeft = r.startLeft;

      if (isEdge) {
        const isVert = h === "top" || h === "bottom";
        if (isVert) {
          const sign = h === "bottom" ? 1 : -1;
          let delta = dy * sign;
          if (e.altKey) delta *= 2;
          newH = Math.max(10, Math.round(r.startH + delta));
          if (r.isAbsolute) {
            if (e.altKey) {
              posTop = r.startTop - (newH - r.startH) / 2;
            } else if (h === "top") {
              posTop = r.startTop + (r.startH - newH);
            }
          }
          style.height = `${newH}px`;
        } else {
          const sign = h === "right" ? 1 : -1;
          let delta = dx * sign;
          if (e.altKey) delta *= 2;
          newW = Math.max(10, Math.round(r.startW + delta));
          if (r.isAbsolute) {
            if (e.altKey) {
              posLeft = r.startLeft - (newW - r.startW) / 2;
            } else if (h === "left") {
              posLeft = r.startLeft + (r.startW - newW);
            }
          }
          style.width = `${newW}px`;
        }
      } else {
        const signX = h.endsWith("e") ? 1 : -1;
        const signY = h.startsWith("s") ? 1 : -1;
        let ddx = dx * signX;
        let ddy = dy * signY;

        if (e.altKey) { ddx *= 2; ddy *= 2; }

        if (e.shiftKey && r.startH > 0) {
          const ratio = r.startW / r.startH;
          if (Math.abs(ddx) > Math.abs(ddy * ratio)) {
            ddy = ddx / ratio;
          } else {
            ddx = ddy * ratio;
          }
        }

        newW = Math.max(10, Math.round(r.startW + ddx));
        newH = Math.max(10, Math.round(r.startH + ddy));

        if (r.isAbsolute) {
          if (e.altKey) {
            posLeft = r.startLeft - (newW - r.startW) / 2;
            posTop = r.startTop - (newH - r.startH) / 2;
          } else {
            if (h.endsWith("w")) posLeft = r.startLeft + (r.startW - newW);
            if (h.startsWith("n")) posTop = r.startTop + (r.startH - newH);
          }
        }

        style.width = `${newW}px`;
        style.height = `${newH}px`;
      }

      if (r.isAbsolute && (posTop !== r.startTop || posLeft !== r.startLeft)) {
        style.top = `${Math.round(posTop)}px`;
        style.left = `${Math.round(posLeft)}px`;
      }

      // Smart snap: compute the potential box and snap moving edges (gated by snapEnabled)
      if (snapEnabled && rect && snapTargetsRef.current.length > 0) {
        const potentialBox = makeBBox(
          r.isAbsolute ? posTop : rect.top,
          r.isAbsolute ? posLeft : rect.left,
          newW,
          newH,
        );
        const activeEdges: ("top" | "bottom" | "left" | "right")[] = [];
        if (isEdge) {
          activeEdges.push(h as "top" | "bottom" | "left" | "right");
        } else {
          if (h.startsWith("n")) activeEdges.push("top");
          if (h.startsWith("s")) activeEdges.push("bottom");
          if (h.endsWith("w")) activeEdges.push("left");
          if (h.endsWith("e")) activeEdges.push("right");
        }
        const snap = snapResize(potentialBox, activeEdges, snapTargetsRef.current);
        if (snap.deltaX !== 0 || snap.deltaY !== 0) {
          // Adjust dimensions based on which edges snapped
          if (snap.deltaX !== 0) {
            if (activeEdges.includes("right")) {
              newW = Math.max(10, Math.round(newW + snap.deltaX));
              style.width = `${newW}px`;
            } else if (activeEdges.includes("left")) {
              newW = Math.max(10, Math.round(newW - snap.deltaX));
              style.width = `${newW}px`;
              if (r.isAbsolute) {
                posLeft += snap.deltaX;
                style.left = `${Math.round(posLeft)}px`;
              }
            }
          }
          if (snap.deltaY !== 0) {
            if (activeEdges.includes("bottom")) {
              newH = Math.max(10, Math.round(newH + snap.deltaY));
              style.height = `${newH}px`;
            } else if (activeEdges.includes("top")) {
              newH = Math.max(10, Math.round(newH - snap.deltaY));
              style.height = `${newH}px`;
              if (r.isAbsolute) {
                posTop += snap.deltaY;
                style.top = `${Math.round(posTop)}px`;
              }
            }
          }
        }
        if (snap.guides.length > 0 || snap.distances.length > 0) {
          setSmartGuides(snap.guides, snap.distances);
        } else {
          clearSmartGuides();
        }
      }

      setResizeInfo({ width: newW, height: newH });
      updateNodeStyle(selectedNodeId, style);
    };
    const onUp = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      setResizeInfo(null);
      setResizeModifier(null);
      setActiveZone(null);
      clearSmartGuides();
      snapTargetsRef.current = [];
      setTimeout(measure, 50);
    };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [selectedNodeId, updateNodeStyle, measure, rect, snapEnabled, setSmartGuides, clearSmartGuides]);

  if (!rect || !selectedNodeId) return null;

  const m = margins;
  const p = paddings;
  const lm = { ...m };
  const lp = { ...p };
  if (dragInfo) { if (dragInfo.zone === "margin") lm[dragInfo.side] = dragInfo.value; else lp[dragInfo.side] = dragInfo.value; }

  const showMarginFill = activeZone?.type === "margin" || dragInfo?.zone === "margin";
  const showPaddingFill = activeZone?.type === "padding" || dragInfo?.zone === "padding";

  // Label helpers
  const fmtVal = (v: number) => dragInfo?.tokenName ? `${dragInfo.tokenName} (${Math.round(v)}px)` : `${Math.round(v)}px`;
  const marginLabel = (side: Side) => `Margin: ${fmtVal(lm[side])}`;
  const paddingLabel = (side: Side) => `Padding: ${fmtVal(lp[side])}`;
  const sizeLabel = resizeInfo
    ? `${Math.round(resizeInfo.width)} \u00D7 ${Math.round(resizeInfo.height)}`
    : `${Math.round(rect.width)} \u00D7 ${Math.round(rect.height)}`;

  const activeSide = activeZone?.side || dragInfo?.side;
  const activeType = activeZone?.type || dragInfo?.zone;

  // Label position near the hovered edge
  const labelPos = (side: Side): React.CSSProperties => {
    switch (side) {
      case "top":    return { top: rect.top - 22, left: rect.left + rect.width / 2, transform: "translateX(-50%)" };
      case "bottom": return { top: rect.top + rect.height + 6, left: rect.left + rect.width / 2, transform: "translateX(-50%)" };
      case "left":   return { top: rect.top + rect.height / 2, left: rect.left - 8, transform: "translate(-100%, -50%)" };
      case "right":  return { top: rect.top + rect.height / 2, left: rect.left + rect.width + 8, transform: "translateY(-50%)" };
    }
  };

  // ---- Composite edge indicator component ----
  // For each edge midpoint, renders 3 mini-zones perpendicular to the edge: [margin] [resize] [padding]
  const edgeIndicators = (["top", "bottom", "left", "right"] as Side[]).map((side) => {
    const isHoriz = side === "top" || side === "bottom";
    const totalW = ZONE_W * 3;

    let anchorTop: number, anchorLeft: number;
    const halfTotal = totalW / 2;
    if (isHoriz) {
      anchorLeft = rect.left + rect.width / 2 - halfTotal;
      anchorTop = side === "top" ? rect.top - halfTotal : rect.top + rect.height - halfTotal;
    } else {
      anchorTop = rect.top + rect.height / 2 - halfTotal;
      anchorLeft = side === "left" ? rect.left - halfTotal : rect.left + rect.width - halfTotal;
    }

    // Order: margin (outside) → resize (edge) → padding (inside)
    // For top/left edges: margin is first (farther from center), padding last (closer)
    // For bottom/right edges: padding is first (closer to center), margin last (farther)
    const outsideFirst = side === "top" || side === "left";
    const order: ZoneType[] = outsideFirst
      ? ["margin", "resize", "padding"]
      : ["padding", "resize", "margin"];

    const zones = order.map((type, i) => {
      const color = type === "margin" ? MARGIN_FG : type === "padding" ? PADDING_FG : ACCENT;
      const isActive = activeZone?.type === type && activeZone?.side === side;
      const cursor = isHoriz ? "ns-resize" : "ew-resize";

      const style: React.CSSProperties = isHoriz
        ? { position: "absolute", left: 0, top: i * ZONE_W, width: totalW, height: ZONE_W }
        : { position: "absolute", top: 0, left: i * ZONE_W, width: ZONE_W, height: totalW };

      return (
        <div
          key={type}
          style={{
            ...style,
            background: isActive ? color : `${color}88`,
            borderRadius: 1,
            cursor,
            pointerEvents: "auto",
            transition: "background 0.1s",
          }}
          onMouseEnter={() => { if (!dragRef.current && !resizeRef.current) setActiveZone({ type, side }); }}
          onMouseLeave={() => { if (!dragRef.current && !resizeRef.current) setActiveZone(null); }}
          onPointerDown={
            type === "resize"
              ? startResize(side)
              : startSpacingDrag(type, side, type === "margin" ? m[side] : p[side])
          }
        />
      );
    });

    return (
      <div
        key={side}
        style={{
          position: "absolute",
          top: anchorTop,
          left: anchorLeft,
          width: totalW,
          height: totalW,
          zIndex: 8,
          pointerEvents: "none",
        }}
      >
        {zones}
      </div>
    );
  });

  // Corner resize handles (unified with edge resize via startResize)
  const corners = (["nw", "ne", "sw", "se"] as const).map((id) => {
    const half = CORNER_SIZE / 2;
    const t = id.startsWith("n") ? rect.top - half : rect.top + rect.height - half;
    const l = id.endsWith("w") ? rect.left - half : rect.left + rect.width - half;
    const c = (id === "nw" || id === "se") ? "nwse-resize" : "nesw-resize";
    const isHovered = hoveredHandle === id;
    return (
      <div
        key={id}
        style={{
          position: "absolute", top: t, left: l,
          width: CORNER_SIZE, height: CORNER_SIZE,
          background: "#fff", border: `2px solid ${ACCENT}`,
          borderRadius: 2, pointerEvents: "auto", cursor: c,
          zIndex: 7,
          boxShadow: isHovered
            ? `0 2px 6px rgba(0,0,0,0.28), 0 0 0 0.5px rgba(0,0,0,0.1)`
            : `0 1px 4px rgba(0,0,0,0.22), 0 0 0 0.5px rgba(0,0,0,0.08)`,
          transform: isHovered ? "scale(1.25)" : "scale(1)",
          transition: "transform 0.1s, box-shadow 0.1s",
        }}
        onMouseEnter={() => { if (!resizeRef.current) setHoveredHandle(id); }}
        onMouseLeave={() => { if (!resizeRef.current) setHoveredHandle(null); }}
        onPointerDown={startResize(id)}
      />
    );
  });

  return (
    <div ref={overlayRef} className="absolute inset-0 pointer-events-none z-40" data-spacing-overlay>

      {/* ====== MARGIN FILL ====== */}
      {showMarginFill && (
        <>
          {lm.top > 0 && <div style={{ position: "absolute", top: rect.top - lm.top, left: rect.left, width: rect.width, height: lm.top, background: dragInfo?.zone === "margin" ? MARGIN_BG_DRAG : MARGIN_BG, backgroundImage: STRIPE_MARGIN }} />}
          {lm.bottom > 0 && <div style={{ position: "absolute", top: rect.top + rect.height, left: rect.left, width: rect.width, height: lm.bottom, background: dragInfo?.zone === "margin" ? MARGIN_BG_DRAG : MARGIN_BG, backgroundImage: STRIPE_MARGIN }} />}
          {lm.left > 0 && <div style={{ position: "absolute", top: rect.top - lm.top, left: rect.left - lm.left, width: lm.left, height: rect.height + lm.top + lm.bottom, background: dragInfo?.zone === "margin" ? MARGIN_BG_DRAG : MARGIN_BG, backgroundImage: STRIPE_MARGIN }} />}
          {lm.right > 0 && <div style={{ position: "absolute", top: rect.top - lm.top, left: rect.left + rect.width, width: lm.right, height: rect.height + lm.top + lm.bottom, background: dragInfo?.zone === "margin" ? MARGIN_BG_DRAG : MARGIN_BG, backgroundImage: STRIPE_MARGIN }} />}
        </>
      )}

      {/* ====== PADDING FILL ====== */}
      {showPaddingFill && (
        <>
          {lp.top > 0 && <div style={{ position: "absolute", top: rect.top, left: rect.left, width: rect.width, height: lp.top, background: dragInfo?.zone === "padding" ? PADDING_BG_DRAG : PADDING_BG, backgroundImage: STRIPE_PADDING }} />}
          {lp.bottom > 0 && <div style={{ position: "absolute", top: rect.top + rect.height - lp.bottom, left: rect.left, width: rect.width, height: lp.bottom, background: dragInfo?.zone === "padding" ? PADDING_BG_DRAG : PADDING_BG, backgroundImage: STRIPE_PADDING }} />}
          {lp.left > 0 && <div style={{ position: "absolute", top: rect.top + lp.top, left: rect.left, width: lp.left, height: rect.height - lp.top - lp.bottom, background: dragInfo?.zone === "padding" ? PADDING_BG_DRAG : PADDING_BG, backgroundImage: STRIPE_PADDING }} />}
          {lp.right > 0 && <div style={{ position: "absolute", top: rect.top + lp.top, left: rect.left + rect.width - lp.right, width: lp.right, height: rect.height - lp.top - lp.bottom, background: dragInfo?.zone === "padding" ? PADDING_BG_DRAG : PADDING_BG, backgroundImage: STRIPE_PADDING }} />}
        </>
      )}

      {/* ====== SELECTION OUTLINE ====== */}
      <div style={{
        position: "absolute", top: rect.top, left: rect.left,
        width: rect.width, height: rect.height,
        outline: `1px solid ${ACCENT}`,
        outlineOffset: 0,
        pointerEvents: "none", zIndex: 5,
      }} />

      {/* ====== CORNER HANDLES ====== */}
      {corners}

      {/* ====== COMPOSITE EDGE INDICATORS ====== */}
      {edgeIndicators}

      {/* ====== ZONE LABEL (near hovered edge) ====== */}
      {activeType && activeSide && activeType !== "resize" && (
        <Pill
          label={activeType === "margin"
            ? (dragInfo?.zone === "margin"
                ? `Margin ${dragInfo.side}: ${fmtVal(dragInfo.value)}`
                : marginLabel(activeSide))
            : (dragInfo?.zone === "padding"
                ? `Padding ${dragInfo.side}: ${fmtVal(dragInfo.value)}`
                : paddingLabel(activeSide))
          }
          color={activeType === "margin" ? MARGIN_FG : PADDING_FG}
          style={labelPos(activeSide)}
          isSnapped={!!(dragInfo?.tokenName)}
          scale={scale}
        />
      )}

      {/* ====== DIMENSION LABEL ====== */}
      {(resizeInfo || activeType === "resize" || (!activeType && !dragInfo)) && (
        <Pill
          label={sizeLabel}
          color={ACCENT}
          style={{
            top: rect.top + rect.height + 8,
            left: rect.left + rect.width / 2,
            transform: "translateX(-50%)",
          }}
          scale={scale}
        />
      )}

      {/* ====== HANDLE HOVER TOOLTIP (W × H) ====== */}
      {hoveredHandle && !resizeRef.current && (
        <div style={{
          position: "absolute",
          top: rect.top - 28,
          left: rect.left + rect.width / 2,
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.78)",
          color: "#fff",
          fontSize: 10,
          fontFamily: "monospace",
          padding: "3px 7px",
          borderRadius: 4,
          pointerEvents: "none",
          zIndex: 20,
          whiteSpace: "nowrap",
        }}>
          {Math.round(rect.width)} × {Math.round(rect.height)}
        </div>
      )}

      {/* ====== MODIFIER KEY INDICATOR (during active resize) ====== */}
      {resizeModifier && rect && (
        <div style={{
          position: "absolute",
          top: rect.top + rect.height + 26,
          left: rect.left + rect.width / 2,
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.72)",
          color: "#fff",
          fontSize: 10,
          padding: "2px 7px",
          borderRadius: 4,
          pointerEvents: "none",
          zIndex: 20,
          whiteSpace: "nowrap",
        }}>
          {resizeModifier === "shift" ? "⇧ Proportional" : "⌥ From centre"}
        </div>
      )}

      {/* ====== MULTI-SELECT BOUNDING BOX ====== */}
      <MultiSelectBBox />

      {/* ====== SMART GUIDES ====== */}
      <SmartGuidesLayer />
    </div>
  );
}

// -------------------------------------------------------------------------
// Multi-select bounding box
// -------------------------------------------------------------------------

function MultiSelectBBox() {
  const { scale } = useContext(CanvasControlsContext);
  const selectedNodeIds = useEditorStore((s) => s.selectedNodeIds);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const spec = useEditorStore((s) => s.spec);
  const [bbox, setBbox] = useState<Rect | null>(null);

  const allIds = useMemo(() => {
    const ids: string[] = [];
    if (selectedNodeId) ids.push(selectedNodeId);
    selectedNodeIds.forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    return ids;
  }, [selectedNodeId, selectedNodeIds]);

  const isMulti = allIds.length >= 2;

  const measure = useCallback(() => {
    if (!isMulti) { setBbox(null); return; }
    const canvasEl = document.querySelector("[data-canvas-root]") as HTMLElement | null;
    if (!canvasEl) { setBbox(null); return; }
    const t = canvasEl.closest("[data-canvas-transform]") as HTMLElement | null;
    const scaleMatch = t?.style.transform.match(/scale\(([\d.]+)\)/);
    const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
    const boxes = getNodeBBoxes(allIds, canvasEl, scale);
    const combined = combinedBBox(boxes);
    if (combined) {
      setBbox({ top: combined.top, left: combined.left, width: combined.width, height: combined.height });
    } else {
      setBbox(null);
    }
  }, [isMulti, allIds]);

  useEffect(() => { measure(); const id = setInterval(measure, 300); return () => clearInterval(id); }, [measure, spec]);

  if (!bbox) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: bbox.top,
        left: bbox.left,
        width: bbox.width,
        height: bbox.height,
        outline: `1.5px dashed ${ACCENT}`,
        outlineOffset: 2,
        pointerEvents: "none",
        zIndex: 4,
        borderRadius: 2,
      }}
    >
      <Pill
        label={`${allIds.length} selected`}
        color={ACCENT}
        style={{ top: -22, left: 0 }}
        scale={scale}
      />
    </div>
  );
}

// -------------------------------------------------------------------------
// Smart guides overlay -- renders alignment lines + distance indicators
// -------------------------------------------------------------------------

const GUIDE_COLOR = "#f43f5e";
const GUIDE_FLASH_STYLE = `
  @keyframes snap-flash {
    0%   { opacity: 1; }
    40%  { opacity: 0.3; }
    70%  { opacity: 1; }
    100% { opacity: 0.85; }
  }
`;
// Inject once
if (typeof document !== "undefined" && !document.getElementById("snap-flash-style")) {
  const s = document.createElement("style");
  s.id = "snap-flash-style";
  s.textContent = GUIDE_FLASH_STYLE;
  document.head.appendChild(s);
}
const DISTANCE_COLOR = "#f43f5e";

function SmartGuidesLayer() {
  const guides = useEditorStore((s) => s.smartGuides);
  const distances = useEditorStore((s) => s.smartDistances);

  if (guides.length === 0 && distances.length === 0) return null;

  return (
    <>
      {guides.map((g, i) => (
        <GuideLineEl key={`g-${i}`} guide={g} />
      ))}
      {distances.map((d, i) => (
        <DistanceEl key={`d-${i}`} indicator={d} />
      ))}
    </>
  );
}

function GuideLineEl({ guide }: { guide: GuideLine }) {
  const flashStyle: React.CSSProperties = {
    animation: "snap-flash 0.35s ease-out forwards",
  };
  if (guide.axis === "x") {
    return (
      <div
        style={{
          position: "absolute",
          left: guide.position,
          top: guide.from,
          width: 0,
          height: guide.to - guide.from,
          borderLeft: `1.5px solid ${GUIDE_COLOR}`,
          pointerEvents: "none",
          zIndex: 50,
          ...flashStyle,
        }}
      />
    );
  }
  return (
    <div
      style={{
        position: "absolute",
        top: guide.position,
        left: guide.from,
        height: 0,
        width: guide.to - guide.from,
        borderTop: `1.5px solid ${GUIDE_COLOR}`,
        pointerEvents: "none",
        zIndex: 50,
        ...flashStyle,
      }}
    />
  );
}

// -------------------------------------------------------------------------
// Constraint widget -- shows pin handles when inside a Frame w/ autoLayout OFF
// -------------------------------------------------------------------------

function findNodeAndParent(
  root: Node,
  targetId: string,
  parent: Node | null = null
): { node: Node; parent: Node | null } | null {
  if (root.id === targetId) return { node: root, parent };
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeAndParent(child, targetId, root);
      if (found) return found;
    }
  }
  return null;
}

export function ConstraintWidget() {
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const spec = useEditorStore((s) => s.spec);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);

  if (!selectedNodeId || !spec) return null;

  const result = findNodeAndParent(spec.tree, selectedNodeId);
  if (!result) return null;
  const { node, parent } = result;

  // Only show when inside a Frame with autoLayout off
  const parentProps = parent?.props as Record<string, unknown> | undefined;
  if (!parent || parent.type !== "Frame" || parentProps?.autoLayout !== false) return null;

  const constraints = node.style?.constraints;
  const hc = constraints?.horizontal ?? "left";
  const vc = constraints?.vertical ?? "top";

  const PIN_COLOR = "#6366f1";
  const PIN_ACTIVE = "#6366f1";
  const PIN_INACTIVE = "#9ca3af";

  const setH = (v: string) => updateNodeStyle(selectedNodeId, {
    constraints: { ...node.style?.constraints, horizontal: v as NonNullable<typeof constraints>["horizontal"] }
  });
  const setV = (v: string) => updateNodeStyle(selectedNodeId, {
    constraints: { ...node.style?.constraints, vertical: v as NonNullable<typeof constraints>["vertical"] }
  });

  return (
    <div style={{ padding: "6px 12px", borderTop: "1px solid var(--s-border)" }}>
      <div style={{ fontSize: 10, color: "var(--s-text-ter)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>
        Constraints
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {/* Horizontal constraint */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "var(--s-text-ter)", marginBottom: 3 }}>Horizontal</div>
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {(["left", "right", "left-right", "center", "scale"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setH(v)}
                style={{
                  fontSize: 9,
                  padding: "2px 5px",
                  borderRadius: 3,
                  border: `1px solid ${hc === v ? PIN_ACTIVE : "#e5e7eb"}`,
                  background: hc === v ? PIN_COLOR : "transparent",
                  color: hc === v ? "#fff" : PIN_INACTIVE,
                  cursor: "pointer",
                  fontWeight: hc === v ? 600 : 400,
                }}
              >
                {v === "left-right" ? "L+R" : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Vertical constraint */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "var(--s-text-ter)", marginBottom: 3 }}>Vertical</div>
          <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            {(["top", "bottom", "top-bottom", "center", "scale"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setV(v)}
                style={{
                  fontSize: 9,
                  padding: "2px 5px",
                  borderRadius: 3,
                  border: `1px solid ${vc === v ? PIN_ACTIVE : "#e5e7eb"}`,
                  background: vc === v ? PIN_COLOR : "transparent",
                  color: vc === v ? "#fff" : PIN_INACTIVE,
                  cursor: "pointer",
                  fontWeight: vc === v ? 600 : 400,
                }}
              >
                {v === "top-bottom" ? "T+B" : v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DistanceEl({ indicator }: { indicator: DistanceIndicator }) {
  if (indicator.value <= 0) return null;

  const midpoint = (indicator.from + indicator.to) / 2;

  if (indicator.axis === "x") {
    return (
      <>
        <div
          style={{
            position: "absolute",
            left: indicator.from,
            top: indicator.crossPosition,
            width: indicator.to - indicator.from,
            height: 0,
            borderTop: `1px solid ${DISTANCE_COLOR}`,
            pointerEvents: "none",
            zIndex: 50,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: midpoint,
            top: indicator.crossPosition - 8,
            transform: "translateX(-50%)",
            pointerEvents: "none",
            zIndex: 51,
          }}
        >
          <span
            style={{
              background: DISTANCE_COLOR,
              color: "#fff",
              fontSize: 9,
              fontWeight: 600,
              padding: "1px 4px",
              borderRadius: 3,
              whiteSpace: "nowrap",
            }}
          >
            {indicator.value}
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      <div
        style={{
          position: "absolute",
          top: indicator.from,
          left: indicator.crossPosition,
          height: indicator.to - indicator.from,
          width: 0,
          borderLeft: `1px solid ${DISTANCE_COLOR}`,
          pointerEvents: "none",
          zIndex: 50,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: midpoint,
          left: indicator.crossPosition + 4,
          transform: "translateY(-50%)",
          pointerEvents: "none",
          zIndex: 51,
        }}
      >
        <span
          style={{
            background: DISTANCE_COLOR,
            color: "#fff",
            fontSize: 9,
            fontWeight: 600,
            padding: "1px 4px",
            borderRadius: 3,
            whiteSpace: "nowrap",
          }}
        >
          {indicator.value}
        </span>
      </div>
    </>
  );
}
