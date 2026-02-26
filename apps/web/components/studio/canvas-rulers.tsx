"use client";

import React, { useRef, useEffect, useCallback, useContext } from "react";
import { CanvasControlsContext } from "./canvas-container";

const RULER_SIZE = 18;
const TICK_COLOR = "var(--s-border-dark)";
const TEXT_COLOR = "var(--s-text-ter)";
const BG_COLOR = "var(--s-bg-panel)";
const BORDER_COLOR = "var(--s-border)";

function calcStep(scale: number): number {
  const base = 100 / scale;
  const exponent = Math.floor(Math.log10(base));
  const magnitude = 10 ** exponent;
  const residual = base / magnitude;
  if (residual <= 1) return magnitude;
  if (residual <= 2) return 2 * magnitude;
  if (residual <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function HorizontalRuler() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scale } = useContext(CanvasControlsContext);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.closest("[data-canvas-container]") as HTMLElement | null;
    if (!container) return;

    const transformEl = container.querySelector("[data-canvas-transform]") as HTMLElement | null;
    const style = transformEl ? window.getComputedStyle(transformEl) : null;
    const matrix = style?.transform;
    let tx = 0;
    if (matrix && matrix !== "none") {
      const parts = matrix.match(/matrix\((.+)\)/);
      if (parts) {
        const vals = parts[1].split(",").map(Number);
        tx = vals[4];
      }
    }

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    canvas.width = w * dpr;
    canvas.height = RULER_SIZE * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${RULER_SIZE}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const step = calcStep(scale);
    const startVal = Math.floor((-tx / scale) / step) * step;
    const endVal = Math.ceil(((w - tx) / scale) / step) * step;

    ctx.clearRect(0, 0, w, RULER_SIZE);
    ctx.strokeStyle = TICK_COLOR;
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `${8}px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif`;
    ctx.textAlign = "center";

    for (let val = startVal; val <= endVal; val += step) {
      const x = tx + val * scale;
      ctx.beginPath();
      ctx.moveTo(x, RULER_SIZE);
      ctx.lineTo(x, RULER_SIZE - 6);
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.fillText(String(Math.round(val)), x, 10);

      for (let sub = 1; sub < 5; sub++) {
        const sx = tx + (val + (step / 5) * sub) * scale;
        ctx.beginPath();
        ctx.moveTo(sx, RULER_SIZE);
        ctx.lineTo(sx, RULER_SIZE - 3);
        ctx.stroke();
      }
    }
  }, [scale]);

  useEffect(() => {
    paint();
    const id = setInterval(paint, 200);
    return () => clearInterval(id);
  }, [paint]);

  return (
    <canvas
      ref={canvasRef}
      className="block"
      style={{
        position: "absolute",
        top: 0,
        left: RULER_SIZE,
        right: 0,
        height: RULER_SIZE,
        zIndex: 50,
        background: BG_COLOR,
        borderBottom: `1px solid ${BORDER_COLOR}`,
      }}
    />
  );
}

function VerticalRuler() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { scale } = useContext(CanvasControlsContext);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.closest("[data-canvas-container]") as HTMLElement | null;
    if (!container) return;

    const transformEl = container.querySelector("[data-canvas-transform]") as HTMLElement | null;
    const style = transformEl ? window.getComputedStyle(transformEl) : null;
    const matrix = style?.transform;
    let ty = 0;
    if (matrix && matrix !== "none") {
      const parts = matrix.match(/matrix\((.+)\)/);
      if (parts) {
        const vals = parts[1].split(",").map(Number);
        ty = vals[5];
      }
    }

    const dpr = window.devicePixelRatio || 1;
    const h = container.clientHeight;
    canvas.width = RULER_SIZE * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${RULER_SIZE}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const step = calcStep(scale);
    const startVal = Math.floor((-ty / scale) / step) * step;
    const endVal = Math.ceil(((h - ty) / scale) / step) * step;

    ctx.clearRect(0, 0, RULER_SIZE, h);
    ctx.strokeStyle = TICK_COLOR;
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = `${8}px -apple-system, BlinkMacSystemFont, 'Inter', sans-serif`;
    ctx.textAlign = "center";

    for (let val = startVal; val <= endVal; val += step) {
      const y = ty + val * scale;
      ctx.beginPath();
      ctx.moveTo(RULER_SIZE, y);
      ctx.lineTo(RULER_SIZE - 6, y);
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(8, y);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(String(Math.round(val)), 0, 0);
      ctx.restore();

      for (let sub = 1; sub < 5; sub++) {
        const sy = ty + (val + (step / 5) * sub) * scale;
        ctx.beginPath();
        ctx.moveTo(RULER_SIZE, sy);
        ctx.lineTo(RULER_SIZE - 3, sy);
        ctx.stroke();
      }
    }
  }, [scale]);

  useEffect(() => {
    paint();
    const id = setInterval(paint, 200);
    return () => clearInterval(id);
  }, [paint]);

  return (
    <canvas
      ref={canvasRef}
      className="block"
      style={{
        position: "absolute",
        top: RULER_SIZE,
        left: 0,
        bottom: 0,
        width: RULER_SIZE,
        zIndex: 50,
        background: BG_COLOR,
        borderRight: `1px solid ${BORDER_COLOR}`,
      }}
    />
  );
}

function CornerSquare() {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: RULER_SIZE,
        height: RULER_SIZE,
        zIndex: 51,
        background: BG_COLOR,
        borderRight: `1px solid ${BORDER_COLOR}`,
        borderBottom: `1px solid ${BORDER_COLOR}`,
      }}
    />
  );
}

export function CanvasRulers() {
  return (
    <>
      <CornerSquare />
      <HorizontalRuler />
      <VerticalRuler />
    </>
  );
}
