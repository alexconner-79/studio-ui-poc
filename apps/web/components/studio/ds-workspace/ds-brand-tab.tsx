"use client";

import React, { useState, useEffect, useCallback } from "react";
import { hexToHuePalette, deriveInteractionTokens } from "@/lib/studio/generate-palette";
import { contrastRatio, wcagRating } from "@/lib/studio/colour-a11y";
import { toast } from "@/lib/studio/toast";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const FONT_FAMILIES = [
  "Inter", "Geist", "Roboto", "Poppins", "DM Sans", "Plus Jakarta Sans",
  "Nunito", "Lato", "Open Sans", "Manrope", "Outfit", "Work Sans",
] as const;

const MONO_FONTS = [
  "JetBrains Mono", "Fira Code", "Source Code Pro", "Geist Mono", "IBM Plex Mono",
] as const;

const SERIF_FONTS = [
  "Playfair Display", "Merriweather", "Lora", "EB Garamond", "Source Serif 4",
] as const;

const TYPE_SCALE_PRESETS = {
  default: { label: "Default",  sizes: ["12px","14px","16px","20px","24px","30px","36px","48px"] },
  compact: { label: "Compact",  sizes: ["11px","12px","14px","16px","20px","24px","30px","40px"] },
  large:   { label: "Large",    sizes: ["14px","16px","18px","22px","28px","36px","48px","64px"] },
} as const;

type TypeScalePreset = keyof typeof TYPE_SCALE_PRESETS;

// Palette shade keys
const SHADE_KEYS = ["50","100","200","300","400","500","600","700","800","900"] as const;

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function ColourField({
  label,
  sublabel,
  value,
  onChange,
}: {
  label: string;
  sublabel?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium">{label}</div>
        {sublabel && <div className="text-[10px] text-muted-foreground">{sublabel}</div>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="w-7 h-7 rounded-md border overflow-hidden cursor-pointer relative">
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="w-full h-full rounded-md" style={{ background: value || "#000000" }} />
        </div>
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            // Always call onChange so React state stays in sync;
            // parent can choose to ignore incomplete values
            if (/^#([0-9a-fA-F]{0,6})$/.test(v)) onChange(v);
          }}
          maxLength={7}
          className="w-20 px-2 py-1 text-[11px] font-mono bg-muted/40 border rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

function ContrastBadge({ fg, bg, label }: { fg: string; bg: string; label: string }) {
  const isValid = (h: string) => /^#[0-9a-fA-F]{6}$/.test(h);
  if (!isValid(fg) || !isValid(bg)) return null;
  const ratio = contrastRatio(fg, bg);
  const r = wcagRating(ratio);
  const pass = r.aaa ? "AAA" : r.aa ? "AA" : r.aaLarge ? "AA+" : null;
  const cls = r.aa ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : r.aaLarge ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return (
    <div className="flex items-center justify-between py-1 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-muted-foreground">{ratio.toFixed(1)}:1</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
          {pass ?? "Fail"}
        </span>
      </div>
    </div>
  );
}

function PaletteStrip({ hex, label }: { hex: string; label: string }) {
  const isValid = /^#[0-9a-fA-F]{6}$/.test(hex);
  if (!isValid) return null;
  const palette = hexToHuePalette(hex);
  return (
    <div>
      <div className="text-[10px] text-muted-foreground mb-1 font-medium">{label}</div>
      <div className="flex gap-0.5 rounded-lg overflow-hidden h-7">
        {SHADE_KEYS.map((key) => (
          <div
            key={key}
            className="flex-1 group relative"
            style={{ background: palette[key]?.value ?? hex }}
            title={`${label} ${key}: ${palette[key]?.value ?? hex}`}
          >
            <div className="absolute inset-x-0 bottom-0 text-[8px] text-center opacity-0 group-hover:opacity-100 transition-opacity pb-0.5 font-mono" style={{ color: parseInt(key) < 400 ? "#00000080" : "#ffffff80" }}>
              {key}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

interface DSBrandTabProps {
  dsId: string;
  tokens: Record<string, unknown>;
  onSaved: (tokens: Record<string, unknown>) => void;
}

interface InteractionColours {
  hover: string;
  active: string;
  focusRing: string;
  disabled: string;
}

export function DSBrandTab({ dsId, tokens, onSaved }: DSBrandTabProps) {
  // Seed initial values from existing tokens if present
  const existingColor = (tokens.color ?? {}) as Record<string, { value?: string }>;

  const [primary,   setPrimary]   = useState<string>(() => existingColor.primary?.value   ?? "#6d28d9");
  const [secondary, setSecondary] = useState<string>(() => existingColor.secondary?.value ?? "#0ea5e9");
  const [accent,    setAccent]    = useState<string>(() => existingColor.accent?.value    ?? "#f59e0b");

  const [interaction, setInteraction] = useState<InteractionColours>(() => {
    const ic = (tokens["color.interactive"] ?? {}) as Record<string, { value?: string }>;
    return {
      hover:     ic["hover"]?.value     ?? "#5b21b6",
      active:    ic["active"]?.value    ?? "#4c1d95",
      focusRing: ic["focus-ring"]?.value ?? "#7c3aed",
      disabled:  ic["disabled"]?.value  ?? "#a78bfa",
    };
  });

  const [fontSans,   setFontSans]   = useState<string>(() => {
    const t = (tokens.typography ?? {}) as Record<string, { value?: string }>;
    return t["font-sans"]?.value ?? "Inter";
  });
  const [fontSerif,  setFontSerif]  = useState<string>(() => {
    const t = (tokens.typography ?? {}) as Record<string, { value?: string }>;
    return t["font-serif"]?.value ?? "Playfair Display";
  });
  const [fontMono,   setFontMono]   = useState<string>(() => {
    const t = (tokens.typography ?? {}) as Record<string, { value?: string }>;
    return t["font-mono"]?.value ?? "JetBrains Mono";
  });
  const [typeScale,  setTypeScale]  = useState<TypeScalePreset>("default");

  const [saving, setSaving] = useState(false);

  // Auto-derive interaction colours whenever primary changes
  const rederiveInteraction = useCallback((hex: string) => {
    const isValid = /^#[0-9a-fA-F]{6}$/.test(hex);
    if (!isValid) return;
    const derived = deriveInteractionTokens(hex);
    setInteraction((prev) => ({
      hover:     derived["hover"]?.value      ?? prev.hover,
      active:    derived["active"]?.value     ?? prev.active,
      focusRing: derived["focus-ring"]?.value ?? prev.focusRing,
      disabled:  derived["disabled"]?.value   ?? prev.disabled,
    }));
  }, []);

  useEffect(() => {
    rederiveInteraction(primary);
  }, [primary, rederiveInteraction]);

  const handleApply = async () => {
    setSaving(true);
    try {
      const primaryPalette = hexToHuePalette(primary);
      const secondaryPalette = hexToHuePalette(secondary);
      const accentPalette = hexToHuePalette(accent);

      const newTokens: Record<string, unknown> = {
        ...(tokens as Record<string, unknown>),
        color: {
          ...((tokens.color as Record<string, unknown>) ?? {}),
          primary:   { value: primary,   description: "Primary brand colour" },
          secondary: { value: secondary, description: "Secondary brand colour" },
          accent:    { value: accent,    description: "Accent colour" },
          // Inject full palettes — each palette entry is { value: string }
          ...Object.fromEntries(
            SHADE_KEYS.map((k) => [`primary-${k}`,   { value: primaryPalette[k]?.value   ?? primary }])
          ),
          ...Object.fromEntries(
            SHADE_KEYS.map((k) => [`secondary-${k}`, { value: secondaryPalette[k]?.value ?? secondary }])
          ),
          ...Object.fromEntries(
            SHADE_KEYS.map((k) => [`accent-${k}`,    { value: accentPalette[k]?.value    ?? accent }])
          ),
        },
        "color.interactive": {
          hover:        { value: interaction.hover,     description: "Primary hover state" },
          active:       { value: interaction.active,    description: "Primary active/pressed state" },
          "focus-ring": { value: interaction.focusRing, description: "Focus ring colour" },
          disabled:     { value: interaction.disabled,  description: "Disabled state colour" },
        },
        typography: {
          ...((tokens.typography as Record<string, unknown>) ?? {}),
          "font-sans":  { value: fontSans,  description: "Sans-serif font stack" },
          "font-serif": { value: fontSerif, description: "Serif font stack" },
          "font-mono":  { value: fontMono,  description: "Monospace font stack" },
          // Type scale
          ...Object.fromEntries(
            TYPE_SCALE_PRESETS[typeScale].sizes.map((size, i) => {
              const names = ["text-xs","text-sm","text-base","text-md","text-lg","text-xl","text-2xl","text-3xl"];
              return [names[i] ?? `text-${i}`, { value: size }];
            })
          ),
        },
      };

      const res = await fetch(`/api/studio/design-systems/${dsId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: newTokens }),
      });

      if (!res.ok) throw new Error("Save failed");
      const data = await res.json() as { designSystem: { tokens: Record<string, unknown> } };
      onSaved(data.designSystem.tokens);
      toast.success("Brand applied to design system");
    } catch {
      toast.error("Failed to apply brand");
    } finally {
      setSaving(false);
    }
  };

  const typeScalePreview = TYPE_SCALE_PRESETS[typeScale].sizes;

  return (
    <div className="max-w-2xl space-y-8">

      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold">Brand</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Set your brand colours and typography. Changes are applied to the token store.
        </p>
      </div>

      {/* Brand Colours */}
      <section className="space-y-4">
        <h3 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Brand Colours</h3>
        <div className="rounded-xl border overflow-hidden divide-y">
          <div className="px-4 py-3 space-y-3">
            <ColourField label="Primary"   sublabel="Main interactive colour" value={primary}   onChange={setPrimary} />
            <ColourField label="Secondary" sublabel="Supporting colour"       value={secondary} onChange={setSecondary} />
            <ColourField label="Accent"    sublabel="Highlight / call-to-action" value={accent} onChange={setAccent} />
          </div>
        </div>

        {/* Palette previews */}
        <div className="space-y-2">
          <PaletteStrip hex={primary}   label="Primary" />
          <PaletteStrip hex={secondary} label="Secondary" />
          <PaletteStrip hex={accent}    label="Accent" />
        </div>
      </section>

      {/* Interaction Colours */}
      <section className="space-y-4">
        <h3 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Interaction Colours</h3>
        <p className="text-[11px] text-muted-foreground -mt-2">Auto-derived from Primary. Edit to override.</p>
        <div className="rounded-xl border overflow-hidden divide-y">
          <div className="px-4 py-3 space-y-3">
            <ColourField label="Hover"     sublabel="$color.interactive.hover"     value={interaction.hover}     onChange={(v) => setInteraction((p) => ({ ...p, hover: v }))} />
            <ColourField label="Active"    sublabel="$color.interactive.active"    value={interaction.active}    onChange={(v) => setInteraction((p) => ({ ...p, active: v }))} />
            <ColourField label="Focus ring" sublabel="$color.interactive.focus-ring" value={interaction.focusRing} onChange={(v) => setInteraction((p) => ({ ...p, focusRing: v }))} />
            <ColourField label="Disabled"  sublabel="$color.interactive.disabled"  value={interaction.disabled}  onChange={(v) => setInteraction((p) => ({ ...p, disabled: v }))} />
          </div>
        </div>
      </section>

      {/* WCAG checks */}
      <section className="space-y-3">
        <h3 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Accessibility</h3>
        <div className="rounded-xl border overflow-hidden">
          <div className="px-4 py-3 space-y-0.5">
            <ContrastBadge fg="#ffffff"         bg={primary}           label="White on Primary" />
            <ContrastBadge fg={primary}         bg="#ffffff"           label="Primary on White" />
            <ContrastBadge fg="#ffffff"         bg={secondary}         label="White on Secondary" />
            <ContrastBadge fg={secondary}       bg="#ffffff"           label="Secondary on White" />
            <ContrastBadge fg={interaction.focusRing} bg="#ffffff"    label="Focus ring on White" />
            <ContrastBadge fg={interaction.disabled}  bg="#ffffff"    label="Disabled on White" />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">AA = 4.5:1 (normal text) · AA+ = 3:1 (large text) · AAA = 7:1</p>
      </section>

      {/* Typography */}
      <section className="space-y-4">
        <h3 className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">Typography</h3>

        <div className="rounded-xl border overflow-hidden divide-y">
          {/* Sans */}
          <div className="px-4 py-3 space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Sans-serif</label>
            <select
              value={fontSans}
              onChange={(e) => setFontSans(e.target.value)}
              className="w-full px-2 py-1.5 text-[12px] bg-muted/30 border rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
            >
              {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <p className="text-[13px] pt-1" style={{ fontFamily: fontSans }}>
              The quick brown fox jumps over the lazy dog
            </p>
          </div>

          {/* Serif */}
          <div className="px-4 py-3 space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Serif</label>
            <select
              value={fontSerif}
              onChange={(e) => setFontSerif(e.target.value)}
              className="w-full px-2 py-1.5 text-[12px] bg-muted/30 border rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
            >
              {SERIF_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <p className="text-[13px] pt-1" style={{ fontFamily: fontSerif }}>
              The quick brown fox jumps over the lazy dog
            </p>
          </div>

          {/* Mono */}
          <div className="px-4 py-3 space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground">Monospace</label>
            <select
              value={fontMono}
              onChange={(e) => setFontMono(e.target.value)}
              className="w-full px-2 py-1.5 text-[12px] bg-muted/30 border rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
            >
              {MONO_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
            <p className="text-[13px] pt-1 font-mono" style={{ fontFamily: fontMono }}>
              const x = 42; // hello world
            </p>
          </div>
        </div>

        {/* Type scale */}
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-muted-foreground">Type Scale</label>
          <div className="flex gap-2">
            {(Object.keys(TYPE_SCALE_PRESETS) as TypeScalePreset[]).map((k) => (
              <button
                key={k}
                onClick={() => setTypeScale(k)}
                className={`flex-1 px-3 py-1.5 text-[11px] rounded-lg border-2 font-medium transition-all ${
                  typeScale === k
                    ? "border-[var(--s-accent)] bg-[var(--s-accent)]/10 text-[var(--s-accent)]"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                }`}
              >
                {TYPE_SCALE_PRESETS[k].label}
              </button>
            ))}
          </div>
          {/* Scale preview */}
          <div className="rounded-xl border overflow-hidden px-4 py-3 space-y-1">
            {typeScalePreview.slice(0, 5).map((size, i) => {
              const names = ["xs","sm","base","md","lg"];
              return (
                <div key={size} className="flex items-baseline justify-between">
                  <span className="text-[10px] font-mono text-muted-foreground w-10">{names[i]}</span>
                  <span style={{ fontSize: size, fontFamily: fontSans, lineHeight: 1.2 }}>Aa</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{size}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Apply button */}
      <div className="pt-2 pb-6">
        <button
          onClick={handleApply}
          disabled={saving}
          className="w-full py-2.5 text-[12px] font-semibold bg-[var(--s-accent)] text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? "Applying…" : "Apply to design system →"}
        </button>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Writes colour palettes (50–900), interaction tokens, and typography into your token store
        </p>
      </div>

    </div>
  );
}
