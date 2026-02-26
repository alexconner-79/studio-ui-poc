"use client";

import React, { useState, useCallback } from "react";
import { toast } from "@/lib/studio/toast";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const FONT_FAMILIES = [
  "Inter", "Geist", "Roboto", "Poppins", "DM Sans", "Plus Jakarta Sans",
  "Nunito", "Lato", "Open Sans", "Manrope", "Outfit", "Work Sans",
] as const;

const SERIF_FONTS = [
  "Georgia", "Merriweather", "Playfair Display", "Lora", "PT Serif",
  "Source Serif 4",
] as const;

const MONO_FONTS = [
  "JetBrains Mono", "Fira Code", "Source Code Pro", "Geist Mono",
  "IBM Plex Mono", "Cascadia Code",
] as const;

const TYPE_SCALES = {
  default: {
    label:   "Default",
    desc:    "Balanced — suits most apps",
    sizes:   ["12px", "14px", "16px", "20px", "24px", "30px", "36px", "48px"],
    weights: { label: [700, 600], body: [400, 500] },
  },
  compact: {
    label:   "Compact",
    desc:    "Dense — data-heavy UIs",
    sizes:   ["11px", "12px", "14px", "16px", "20px", "24px", "30px", "40px"],
    weights: { label: [700, 600], body: [400, 500] },
  },
  large: {
    label:   "Large",
    desc:    "Spacious — marketing, editorial",
    sizes:   ["14px", "16px", "18px", "22px", "28px", "36px", "48px", "64px"],
    weights: { label: [700, 600], body: [400, 500] },
  },
} as const;

type ScaleKey = keyof typeof TYPE_SCALES;

const SCALE_LABELS = ["xs", "sm", "base", "md", "lg", "xl", "2xl", "3xl"] as const;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function buildTypographyTokens(
  sans: string,
  serif: string,
  mono: string,
  scale: ScaleKey
): Record<string, { value: string; description?: string }> {
  const tokens: Record<string, { value: string; description?: string }> = {
    "font-sans":  { value: sans,  description: "Primary sans-serif typeface" },
    "font-serif": { value: serif, description: "Serif typeface for editorial use" },
    "font-mono":  { value: mono,  description: "Monospace typeface for code" },
  };

  TYPE_SCALES[scale].sizes.forEach((size, i) => {
    tokens[`size-${SCALE_LABELS[i]}`] = { value: size };
  });

  return tokens;
}

// ─────────────────────────────────────────────────────────────
// Font select with live preview
// ─────────────────────────────────────────────────────────────

function FontSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-foreground block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2.5 py-1.5 text-[12px] bg-muted/40 border rounded-md focus:outline-none"
        >
          {options.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <span
          className="text-[14px] text-muted-foreground shrink-0 w-16 truncate"
          style={{ fontFamily: `"${value}", sans-serif` }}
        >
          Aa Bb
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

interface DSTypographyPanelProps {
  dsId: string;
  /** Existing tokens so we can pre-populate the form and detect saved state */
  existingTypography?: Record<string, { value: string }>;
  onSaved: (updatedTypography: Record<string, unknown>) => void;
}

export function DSTypographyPanel({
  dsId,
  existingTypography = {},
  onSaved,
}: DSTypographyPanelProps) {
  const [fontSans,  setFontSans]  = useState(existingTypography["font-sans"]?.value  ?? "Inter");
  const [fontSerif, setFontSerif] = useState(existingTypography["font-serif"]?.value ?? "Georgia");
  const [fontMono,  setFontMono]  = useState(existingTypography["font-mono"]?.value  ?? "JetBrains Mono");
  const [scale,     setScale]     = useState<ScaleKey>(() => {
    // Try to infer scale from existing tokens
    const baseSize = existingTypography["size-base"]?.value;
    if (baseSize === "14px") return "compact";
    if (baseSize === "18px") return "large";
    return "default";
  });
  const [saving, setSaving] = useState(false);

  const handleApply = useCallback(async () => {
    const tokens = buildTypographyTokens(fontSans, fontSerif, fontMono, scale);
    setSaving(true);
    try {
      const res = await fetch(`/api/studio/design-systems/${dsId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokens: {
            typography: tokens,
          },
        }),
      });
      if (res.ok) {
        toast.success("Typography tokens saved");
        onSaved({ typography: tokens });
      } else {
        toast.error("Failed to save typography");
      }
    } catch {
      toast.error("Failed to save typography");
    } finally {
      setSaving(false);
    }
  }, [dsId, fontSans, fontSerif, fontMono, scale, onSaved]);

  return (
    <div className="rounded-xl border p-4 space-y-4 bg-muted/10">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[12px] font-semibold">Typography</h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">Font families and type scale for your design system</p>
        </div>
        <button
          onClick={handleApply}
          disabled={saving}
          className="px-3 py-1.5 text-[11px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Apply tokens"}
        </button>
      </div>

      {/* Font families */}
      <div className="space-y-2.5">
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Font families</div>
        <FontSelect label="Sans-serif" value={fontSans}  options={FONT_FAMILIES} onChange={setFontSans} />
        <FontSelect label="Serif"      value={fontSerif} options={SERIF_FONTS}   onChange={setFontSerif} />
        <FontSelect label="Monospace"  value={fontMono}  options={MONO_FONTS}    onChange={setFontMono} />
      </div>

      {/* Type scale picker */}
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Type scale</div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(Object.entries(TYPE_SCALES) as [ScaleKey, typeof TYPE_SCALES[ScaleKey]][]).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => setScale(key)}
              className={`p-2.5 rounded-lg border-2 text-left transition-all ${
                scale === key
                  ? "border-[var(--s-accent)] bg-[var(--s-accent)]/5"
                  : "border-border hover:border-[var(--s-accent)]/40"
              }`}
            >
              <div className={`text-[11px] font-semibold ${scale === key ? "text-[var(--s-accent)]" : "text-foreground"}`}>
                {preset.label}
              </div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{preset.desc}</div>
              <div className="text-[9px] text-muted-foreground font-mono">{preset.sizes[0]}–{preset.sizes[preset.sizes.length - 1]}</div>
            </button>
          ))}
        </div>

        {/* Live scale preview */}
        <div className="rounded-lg border bg-background p-3 space-y-1">
          {TYPE_SCALES[scale].sizes.map((sz, i) => (
            <div key={sz} className="flex items-baseline gap-2">
              <span className="text-[9px] font-mono text-muted-foreground w-12 shrink-0">{SCALE_LABELS[i]}</span>
              <span
                style={{ fontSize: sz, fontFamily: `"${fontSans}", sans-serif`, lineHeight: 1.2 }}
                className="text-foreground truncate"
              >
                The quick brown fox
              </span>
              <span className="text-[9px] text-muted-foreground ml-auto shrink-0">{sz}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
