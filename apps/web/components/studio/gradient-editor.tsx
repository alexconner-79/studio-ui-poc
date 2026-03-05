"use client";

import React, { useState, useCallback, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GradientStop = { color: string; position: number };

export type LinearGradientValue = {
  type: "linear-gradient";
  angle: number;
  stops: GradientStop[];
};

export type RadialGradientValue = {
  type: "radial-gradient";
  center: { x: number; y: number };
  stops: GradientStop[];
};

export type GradientValue = LinearGradientValue | RadialGradientValue;

// ---------------------------------------------------------------------------
// Preset gradients
// ---------------------------------------------------------------------------

const GRADIENT_PRESETS: { name: string; value: GradientValue }[] = [
  { name: "Sunset", value: { type: "linear-gradient", angle: 135, stops: [{ color: "#ff512f", position: 0 }, { color: "#f09819", position: 1 }] } },
  { name: "Ocean", value: { type: "linear-gradient", angle: 90, stops: [{ color: "#2193b0", position: 0 }, { color: "#6dd5ed", position: 1 }] } },
  { name: "Purple Haze", value: { type: "linear-gradient", angle: 135, stops: [{ color: "#7b4397", position: 0 }, { color: "#dc2430", position: 1 }] } },
  { name: "Midnight", value: { type: "linear-gradient", angle: 180, stops: [{ color: "#232526", position: 0 }, { color: "#414345", position: 1 }] } },
  { name: "Fresh Lime", value: { type: "linear-gradient", angle: 45, stops: [{ color: "#a8e063", position: 0 }, { color: "#56ab2f", position: 1 }] } },
  { name: "Peach", value: { type: "linear-gradient", angle: 90, stops: [{ color: "#ffecd2", position: 0 }, { color: "#fcb69f", position: 1 }] } },
  { name: "Icy Blue", value: { type: "linear-gradient", angle: 135, stops: [{ color: "#e0eafc", position: 0 }, { color: "#cfdef3", position: 1 }] } },
  { name: "Royal", value: { type: "linear-gradient", angle: 90, stops: [{ color: "#141e30", position: 0 }, { color: "#243b55", position: 1 }] } },
  { name: "Coral", value: { type: "linear-gradient", angle: 45, stops: [{ color: "#ff9a9e", position: 0 }, { color: "#fad0c4", position: 0.5 }, { color: "#fad0c4", position: 1 }] } },
  { name: "Aurora", value: { type: "linear-gradient", angle: 135, stops: [{ color: "#00c6ff", position: 0 }, { color: "#0072ff", position: 1 }] } },
  { name: "Warm Flame", value: { type: "linear-gradient", angle: 45, stops: [{ color: "#ff9a9e", position: 0 }, { color: "#fecfef", position: 1 }] } },
  { name: "Frost", value: { type: "radial-gradient", center: { x: 0.5, y: 0.5 }, stops: [{ color: "#ffffff", position: 0 }, { color: "#e6e9f0", position: 1 }] } },
  { name: "Spotlight", value: { type: "radial-gradient", center: { x: 0.5, y: 0.5 }, stops: [{ color: "#fdfbfb", position: 0 }, { color: "#ebedee", position: 1 }] } },
  { name: "Neon Glow", value: { type: "radial-gradient", center: { x: 0.5, y: 0.5 }, stops: [{ color: "#f5af19", position: 0 }, { color: "#f12711", position: 1 }] } },
];

// ---------------------------------------------------------------------------
// Gradient bar (visual preview with draggable stops)
// ---------------------------------------------------------------------------

function GradientBar({
  stops,
  angle,
  type,
  onStopMove,
  onStopSelect,
  selectedStop,
  onAddStop,
}: {
  stops: GradientStop[];
  angle?: number;
  type: "linear-gradient" | "radial-gradient";
  onStopMove: (index: number, position: number) => void;
  onStopSelect: (index: number) => void;
  selectedStop: number;
  onAddStop: (position: number, color: string) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<number | null>(null);

  const gradientCSS =
    type === "linear-gradient"
      ? `linear-gradient(90deg, ${stops.map((s) => `${s.color} ${s.position * 100}%`).join(", ")})`
      : `linear-gradient(90deg, ${stops.map((s) => `${s.color} ${s.position * 100}%`).join(", ")})`;

  const getPosition = (clientX: number): number => {
    if (!barRef.current) return 0;
    const rect = barRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = index;
    onStopSelect(index);

    const handleMouseMove = (me: MouseEvent) => {
      if (draggingRef.current === null) return;
      const pos = getPosition(me.clientX);
      onStopMove(draggingRef.current, pos);
    };

    const handleMouseUp = () => {
      draggingRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleBarClick = (e: React.MouseEvent) => {
    if (draggingRef.current !== null) return;
    const pos = getPosition(e.clientX);
    const nearestLeft = stops.filter((s) => s.position <= pos).sort((a, b) => b.position - a.position)[0];
    const nearestRight = stops.filter((s) => s.position > pos).sort((a, b) => a.position - b.position)[0];
    let color = "#888888";
    if (nearestLeft && nearestRight) {
      color = nearestLeft.color;
    } else if (nearestLeft) {
      color = nearestLeft.color;
    } else if (nearestRight) {
      color = nearestRight.color;
    }
    onAddStop(pos, color);
  };

  return (
    <div className="relative">
      <div
        ref={barRef}
        className="h-6 rounded border [border-color:var(--s-border)] cursor-crosshair"
        style={{ background: gradientCSS }}
        onClick={handleBarClick}
      />
      {stops.map((stop, i) => (
        <div
          key={i}
          className="absolute top-0 -translate-x-1/2 cursor-grab active:cursor-grabbing"
          style={{ left: `${stop.position * 100}%` }}
          onMouseDown={(e) => handleMouseDown(e, i)}
          onClick={(e) => { e.stopPropagation(); onStopSelect(i); }}
        >
          <div
            className={`w-3.5 h-7 rounded-sm border-2 ${
              selectedStop === i ? "border-blue-500 shadow-sm" : "[border-color:var(--s-border)]"
            }`}
            style={{ backgroundColor: stop.color }}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Angle dial (visual rotation control)
// ---------------------------------------------------------------------------

function AngleDial({
  angle,
  onChange,
}: {
  angle: number;
  onChange: (angle: number) => void;
}) {
  const dialRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const update = (me: MouseEvent) => {
      if (!dialRef.current) return;
      const rect = dialRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const rad = Math.atan2(me.clientY - cy, me.clientX - cx);
      let deg = Math.round((rad * 180) / Math.PI + 90);
      if (deg < 0) deg += 360;
      onChange(deg);
    };
    const handleUp = () => {
      window.removeEventListener("mousemove", update);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", update);
    window.addEventListener("mouseup", handleUp);
  };

  const rad = ((angle - 90) * Math.PI) / 180;
  const indicatorX = 50 + 35 * Math.cos(rad);
  const indicatorY = 50 + 35 * Math.sin(rad);

  return (
    <div
      ref={dialRef}
      className="w-10 h-10 rounded-full border [border-color:var(--s-border)] bg-background cursor-pointer relative shrink-0"
      onMouseDown={handleMouseDown}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        <line
          x1="50" y1="50"
          x2={indicatorX} y2={indicatorY}
          stroke="currentColor" strokeWidth="3" strokeLinecap="round"
          className="[color:var(--s-accent)]"
        />
        <circle cx={indicatorX} cy={indicatorY} r="6" fill="currentColor" className="[color:var(--s-accent)]" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main gradient editor
// ---------------------------------------------------------------------------

export function GradientEditor({
  value,
  onChange,
}: {
  value: GradientValue;
  onChange: (updated: GradientValue) => void;
}) {
  const [selectedStop, setSelectedStop] = useState(0);
  const [showPresets, setShowPresets] = useState(false);

  const stops = value.stops;
  const currentStop = stops[selectedStop] ?? stops[0];

  const handleStopMove = useCallback(
    (index: number, position: number) => {
      const newStops = stops.map((s, i) => (i === index ? { ...s, position } : s));
      onChange({ ...value, stops: newStops });
    },
    [stops, value, onChange]
  );

  const handleStopColorChange = useCallback(
    (color: string) => {
      const newStops = stops.map((s, i) => (i === selectedStop ? { ...s, color } : s));
      onChange({ ...value, stops: newStops });
    },
    [stops, selectedStop, value, onChange]
  );

  const handleAddStop = useCallback(
    (position: number, color: string) => {
      if (stops.length >= 10) return;
      const newStops = [...stops, { color, position }].sort((a, b) => a.position - b.position);
      onChange({ ...value, stops: newStops });
      setSelectedStop(newStops.findIndex((s) => s.position === position && s.color === color));
    },
    [stops, value, onChange]
  );

  const handleRemoveStop = useCallback(() => {
    if (stops.length <= 2) return;
    const newStops = stops.filter((_, i) => i !== selectedStop);
    onChange({ ...value, stops: newStops });
    setSelectedStop(Math.max(0, selectedStop - 1));
  }, [stops, selectedStop, value, onChange]);

  const handlePreset = useCallback(
    (preset: GradientValue) => {
      onChange(preset);
      setSelectedStop(0);
      setShowPresets(false);
    },
    [onChange]
  );

  return (
    <div className="space-y-2">
      {/* Gradient bar with draggable stops */}
      <GradientBar
        stops={stops}
        angle={value.type === "linear-gradient" ? value.angle : undefined}
        type={value.type}
        onStopMove={handleStopMove}
        onStopSelect={setSelectedStop}
        selectedStop={selectedStop}
        onAddStop={handleAddStop}
      />

      {/* Selected stop controls */}
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={currentStop?.color ?? "#000000"}
          onChange={(e) => handleStopColorChange(e.target.value)}
          className="h-7 w-10 rounded border cursor-pointer shrink-0"
        />
        <div className="flex flex-col gap-0.5 flex-1">
          <label className="text-[9px] [color:var(--s-text-ter)]">Position</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={currentStop?.position ?? 0}
            onChange={(e) => handleStopMove(selectedStop, Number(e.target.value))}
            className="w-full accent-[var(--s-accent)]"
          />
        </div>
        <span className="text-[10px] [color:var(--s-text-ter)] w-8 text-right shrink-0">
          {Math.round((currentStop?.position ?? 0) * 100)}%
        </span>
        {stops.length > 2 && (
          <button
            onClick={handleRemoveStop}
            className="[color:var(--s-text-ter)] hover:[color:var(--s-text-pri)] shrink-0"
            title="Remove stop"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="2" x2="8" y2="8" /><line x1="8" y1="2" x2="2" y2="8" />
            </svg>
          </button>
        )}
      </div>

      {/* Angle (linear) or Center (radial) controls */}
      {value.type === "linear-gradient" && (
        <div className="flex items-center gap-2">
          <AngleDial angle={value.angle} onChange={(a) => onChange({ ...value, angle: a })} />
          <div className="flex flex-col gap-0.5 flex-1">
            <label className="text-[10px] [color:var(--s-text-ter)]">Angle</label>
            <input
              type="number"
              min={0}
              max={360}
              value={value.angle}
              onChange={(e) => onChange({ ...value, angle: Number(e.target.value) % 360 })}
              className="h-7 px-2 text-[11px] bg-background border rounded"
            />
          </div>
        </div>
      )}

      {value.type === "radial-gradient" && (
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] [color:var(--s-text-ter)]">Center X (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round(value.center.x * 100)}
              onChange={(e) => onChange({ ...value, center: { ...value.center, x: Number(e.target.value) / 100 } })}
              className="h-7 px-2 text-[11px] bg-background border rounded"
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] [color:var(--s-text-ter)]">Center Y (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={Math.round(value.center.y * 100)}
              onChange={(e) => onChange({ ...value, center: { ...value.center, y: Number(e.target.value) / 100 } })}
              className="h-7 px-2 text-[11px] bg-background border rounded"
            />
          </div>
        </div>
      )}

      {/* Presets */}
      <div>
        <button
          onClick={() => setShowPresets(!showPresets)}
          className="text-[10px] [color:var(--s-accent)] hover:underline"
        >
          {showPresets ? "Hide presets" : "Gradient presets..."}
        </button>
        {showPresets && (
          <div className="grid grid-cols-4 gap-1 mt-1">
            {GRADIENT_PRESETS.filter((p) => p.value.type === value.type).map((preset, i) => {
              const css =
                preset.value.type === "linear-gradient"
                  ? `linear-gradient(${preset.value.angle}deg, ${preset.value.stops.map((s) => `${s.color} ${s.position * 100}%`).join(", ")})`
                  : `radial-gradient(circle, ${preset.value.stops.map((s) => `${s.color} ${s.position * 100}%`).join(", ")})`;
              return (
                <button
                  key={i}
                  onClick={() => handlePreset(preset.value)}
                  className="h-8 rounded border [border-color:var(--s-border)] hover:ring-1 hover:ring-blue-400 transition-shadow"
                  style={{ background: css }}
                  title={preset.name}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
