"use client";

/**
 * Token-aware style input components for the property panel.
 * Each input shows a token dropdown (if tokens exist for that category)
 * and falls back to a raw value input.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { StyleValue, DesignTokens } from "@/lib/studio/types";
import { resolveStyleValue, getTokensForCategory } from "@/lib/studio/resolve-token";

// ---------------------------------------------------------------------------
// TokenAwareInput -- wraps any input with a token dropdown popover
// ---------------------------------------------------------------------------

type TokenAwareInputProps = {
  label: string;
  value: StyleValue | undefined;
  tokenCategory: string;
  tokens: DesignTokens | null;
  onChange: (value: StyleValue | undefined) => void;
  renderInput: (props: {
    value: string | number;
    onChange: (v: string | number) => void;
  }) => React.ReactNode;
};

export function TokenAwareInput({
  label,
  value,
  tokenCategory,
  tokens,
  onChange,
  renderInput,
}: TokenAwareInputProps) {
  const [showTokens, setShowTokens] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isTokenRef = typeof value === "string" && value.startsWith("$");
  const availableTokens = getTokensForCategory(tokenCategory, tokens);
  const resolvedValue = resolveStyleValue(value, tokens);

  // Find active token name
  const activeToken = isTokenRef
    ? availableTokens.find((t) => t.ref === value)
    : null;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as HTMLElement)) {
        setShowTokens(false);
      }
    }
    if (showTokens) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showTokens]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-[11px] text-muted-foreground font-medium">{label}</label>
        {availableTokens.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                isTokenRef
                  ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300"
                  : "bg-transparent border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
              onClick={() => setShowTokens(!showTokens)}
              title={isTokenRef ? `Token: ${value}` : "Select token"}
            >
              {isTokenRef ? activeToken?.name ?? String(value).slice(1) : "T"}
            </button>
            {showTokens && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-md shadow-lg py-1 min-w-[160px] max-h-[200px] overflow-y-auto">
                {value !== undefined && (
                  <button
                    className="w-full text-left px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-accent"
                    onClick={() => { onChange(undefined); setShowTokens(false); }}
                  >
                    Clear
                  </button>
                )}
                {isTokenRef && (
                  <button
                    className="w-full text-left px-3 py-1.5 text-[11px] text-muted-foreground hover:bg-accent border-b"
                    onClick={() => {
                      onChange(resolvedValue !== undefined ? resolvedValue : "");
                      setShowTokens(false);
                    }}
                  >
                    Detach (use raw value)
                  </button>
                )}
                {availableTokens.map((t) => (
                  <button
                    key={t.ref}
                    className={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-accent flex items-center gap-2 ${
                      t.ref === value ? "bg-accent font-medium" : ""
                    }`}
                    onClick={() => { onChange(t.ref); setShowTokens(false); }}
                  >
                    {tokenCategory === "color" && (
                      <span
                        className="w-3 h-3 rounded-sm border border-border inline-block flex-shrink-0"
                        style={{ backgroundColor: t.value }}
                      />
                    )}
                    <span>{t.name}</span>
                    <span className="text-muted-foreground ml-auto">{t.value}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      {isTokenRef ? (
        <div className="flex items-center gap-1.5 h-7 px-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-[11px]">
          {tokenCategory === "color" && (
            <span
              className="w-3 h-3 rounded-sm border border-border flex-shrink-0"
              style={{ backgroundColor: String(resolvedValue ?? "") }}
            />
          )}
          <span className="text-blue-700 dark:text-blue-300 font-medium truncate">
            {activeToken?.name ?? String(value).slice(1)}
          </span>
          <span className="text-muted-foreground ml-auto truncate">{String(resolvedValue ?? "")}</span>
        </div>
      ) : (
        renderInput({
          value: resolvedValue !== undefined ? resolvedValue : "",
          onChange: (v) => onChange(v === "" ? undefined : v),
        })
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ColorInput
// ---------------------------------------------------------------------------

type ColorInputProps = {
  label: string;
  value: StyleValue | undefined;
  tokens: DesignTokens | null;
  onChange: (value: StyleValue | undefined) => void;
};

export function ColorInput({ label, value, tokens, onChange }: ColorInputProps) {
  return (
    <TokenAwareInput
      label={label}
      value={value}
      tokenCategory="color"
      tokens={tokens}
      onChange={onChange}
      renderInput={({ value: v, onChange: onC }) => (
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={String(v || "#000000")}
            onChange={(e) => onC(e.target.value)}
            className="w-7 h-7 rounded border border-border cursor-pointer p-0.5"
          />
          <input
            type="text"
            value={String(v || "")}
            onChange={(e) => onC(e.target.value)}
            placeholder="#000000"
            className="flex-1 h-7 px-2 text-[11px] bg-background border rounded"
          />
        </div>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// NumberWithUnit -- number stepper + unit selector
// ---------------------------------------------------------------------------

type NumberWithUnitProps = {
  label: string;
  value: StyleValue | undefined;
  tokenCategory: string;
  tokens: DesignTokens | null;
  onChange: (value: StyleValue | undefined) => void;
  units?: string[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
};

export function NumberWithUnit({
  label,
  value,
  tokenCategory,
  tokens,
  onChange,
  units = ["px", "rem", "%", "auto"],
  min,
  max,
  step = 1,
  placeholder = "auto",
}: NumberWithUnitProps) {
  const parseValue = useCallback((v: string | number): { num: string; unit: string } => {
    if (typeof v === "number") return { num: String(v), unit: "px" };
    const str = String(v);
    if (str === "auto" || str === "") return { num: "", unit: "auto" };
    const match = str.match(/^(-?[\d.]+)\s*(px|rem|em|%|vh|vw)?$/);
    if (match) return { num: match[1], unit: match[2] || "px" };
    return { num: str, unit: "" };
  }, []);

  return (
    <TokenAwareInput
      label={label}
      value={value}
      tokenCategory={tokenCategory}
      tokens={tokens}
      onChange={onChange}
      renderInput={({ value: v, onChange: onC }) => {
        const { num, unit } = parseValue(v);
        return (
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={num}
              onChange={(e) => {
                const n = e.target.value;
                if (n === "") { onC(""); return; }
                const currentUnit = unit === "auto" ? "px" : unit;
                onC(currentUnit ? `${n}${currentUnit}` : n);
              }}
              placeholder={placeholder}
              min={min}
              max={max}
              step={step}
              className="flex-1 h-7 px-2 text-[11px] bg-background border rounded w-0 min-w-0"
            />
            <select
              value={unit || "px"}
              onChange={(e) => {
                const newUnit = e.target.value;
                if (newUnit === "auto") { onC("auto"); return; }
                const n = num || "0";
                onC(`${n}${newUnit}`);
              }}
              className="h-7 px-1 text-[10px] bg-background border rounded appearance-none cursor-pointer"
            >
              {units.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// SpacingEditor -- visual 4-sided box (like devtools box model)
// ---------------------------------------------------------------------------

type SpacingEditorProps = {
  label: string;
  property: "padding" | "margin";
  style: Record<string, StyleValue | undefined>;
  tokens: DesignTokens | null;
  onChange: (prop: string, value: StyleValue | undefined) => void;
};

const SIDES = ["Top", "Right", "Bottom", "Left"] as const;

export function SpacingEditor({ label, property, style, tokens, onChange }: SpacingEditorProps) {
  const [linked, setLinked] = useState(false);
  const prefix = property;

  const handleChange = (side: string, value: StyleValue | undefined) => {
    if (linked) {
      for (const s of SIDES) {
        onChange(`${prefix}${s}`, value);
      }
    } else {
      onChange(`${prefix}${side}`, value);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
        <button
          className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
            linked ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 text-blue-700" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setLinked(!linked)}
          title={linked ? "Unlink sides" : "Link all sides"}
        >
          {linked ? "Linked" : "Link"}
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {SIDES.map((side) => {
          const key = `${prefix}${side}`;
          const val = style[key];
          const resolved = resolveStyleValue(val, tokens);
          const isToken = typeof val === "string" && val.startsWith("$");
          return (
            <div key={side} className="flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-muted-foreground">{side[0]}</span>
              <input
                type="text"
                value={isToken ? String(val).slice(1).split(".").pop() ?? "" : String(resolved ?? "")}
                onChange={(e) => handleChange(side, e.target.value || undefined)}
                placeholder="0"
                className={`w-full h-6 text-center text-[10px] border rounded ${
                  isToken ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 text-blue-700" : "bg-background"
                }`}
                title={isToken ? `Token: ${val} = ${resolved}` : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShadowEditor
// ---------------------------------------------------------------------------

type ShadowEditorProps = {
  label: string;
  value: StyleValue | undefined;
  tokens: DesignTokens | null;
  onChange: (value: StyleValue | undefined) => void;
};

export function ShadowEditor({ label, value, tokens, onChange }: ShadowEditorProps) {
  return (
    <TokenAwareInput
      label={label}
      value={value}
      tokenCategory="shadow"
      tokens={tokens}
      onChange={onChange}
      renderInput={({ value: v, onChange: onC }) => (
        <input
          type="text"
          value={String(v || "")}
          onChange={(e) => onC(e.target.value)}
          placeholder="0 1px 2px rgba(0,0,0,0.1)"
          className="w-full h-7 px-2 text-[11px] bg-background border rounded"
        />
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// SliderInput -- range slider + number (for opacity, etc.)
// ---------------------------------------------------------------------------

type SliderInputProps = {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
};

export function SliderInput({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
}: SliderInputProps) {
  const v = value ?? 1;
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-muted-foreground font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={v}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="flex-1 h-1.5 accent-blue-500"
        />
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={v}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            onChange(isNaN(n) ? undefined : n);
          }}
          className="w-14 h-7 px-2 text-[11px] bg-background border rounded text-center"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SegmentedSelect -- icon-button row for textAlign, justifyContent, etc.
// ---------------------------------------------------------------------------

type SegmentedOption = {
  value: string;
  label: string;
  icon?: React.ReactNode;
};

type SegmentedSelectProps = {
  label: string;
  value: string | undefined;
  options: SegmentedOption[];
  onChange: (value: string | undefined) => void;
};

export function SegmentedSelect({ label, value, options, onChange }: SegmentedSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-muted-foreground font-medium">{label}</label>
      <div className="flex items-center gap-0.5 bg-muted/50 rounded p-0.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            className={`flex-1 h-7 flex items-center justify-center text-[11px] rounded transition-colors ${
              value === opt.value
                ? "bg-background shadow-sm text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => onChange(value === opt.value ? undefined : opt.value)}
            title={opt.label}
          >
            {opt.icon ?? opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
