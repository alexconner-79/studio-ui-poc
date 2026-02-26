"use client";

import React, { useState, useCallback } from "react";
import { toast } from "@/lib/studio/toast";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type TokenEntry = { value: string | number; description?: string };
type TokenGroup = Record<string, TokenEntry>;
type TokenStore = Record<string, TokenGroup>;

type ThemeOverrides = Record<string, Record<string, { value: string }>>;

type ThemeStore = Record<string, { name: string; overrides: ThemeOverrides }>;

// ─────────────────────────────────────────────────────────────
// Auto dark-theme generator
// Naively darkens light colours for a starting point.
// ─────────────────────────────────────────────────────────────

function hexToHsl(hex: string): [number, number, number] | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function isColor(value: string | number): boolean {
  if (typeof value !== "string") return false;
  return value.startsWith("#") || value.startsWith("rgb") || value.startsWith("hsl");
}

function generateDarkOverrides(tokens: TokenStore): ThemeOverrides {
  const overrides: ThemeOverrides = {};
  for (const [group, entries] of Object.entries(tokens)) {
    for (const [key, entry] of Object.entries(entries)) {
      const val = typeof entry.value === "string" ? entry.value : null;
      if (!val || !isColor(val)) continue;
      const hsl = hexToHsl(val);
      if (!hsl) continue;
      const [h, s, l] = hsl;
      // Invert lightness: light colours become dark, dark become light
      const newL = 100 - l;
      // Slightly desaturate very saturated dark tones
      const newS = newL < 20 ? Math.min(s, 60) : s;
      const dark = hslToHex(h, newS, newL);
      if (!overrides[group]) overrides[group] = {};
      overrides[group][key] = { value: dark };
    }
  }
  return overrides;
}

// ─────────────────────────────────────────────────────────────
// Override row
// ─────────────────────────────────────────────────────────────

function OverrideRow({
  group,
  tokenKey,
  baseValue,
  overrideValue,
  onEdit,
  onClear,
}: {
  group: string;
  tokenKey: string;
  baseValue: string | number | undefined;
  overrideValue: string | undefined;
  onEdit: (group: string, key: string, value: string) => void;
  onClear: (group: string, key: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(overrideValue ?? "");
  const hasOverride = !!overrideValue;
  const displayBase = typeof baseValue === "string" ? baseValue : String(baseValue ?? "");

  const handleCommit = () => {
    if (draft.trim()) onEdit(group, tokenKey, draft.trim());
    setEditing(false);
  };

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded hover:bg-accent/40 group transition-colors ${hasOverride ? "bg-accent/20" : ""}`}>
      {/* Colour swatches */}
      <div className="flex items-center gap-1 shrink-0">
        {isColor(displayBase) && (
          <div className="w-3.5 h-3.5 rounded border border-black/10" style={{ background: displayBase }} title={`Base: ${displayBase}`} />
        )}
        {hasOverride && isColor(overrideValue!) && (
          <>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground"><path d="M1 4h6M4 1l3 3-3 3"/></svg>
            <div className="w-3.5 h-3.5 rounded border border-black/10" style={{ background: overrideValue }} title={`Override: ${overrideValue}`} />
          </>
        )}
      </div>

      <span className="text-[11px] font-mono text-foreground flex-1 truncate">{group}.{tokenKey}</span>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={(e) => { if (e.key === "Enter") handleCommit(); if (e.key === "Escape") setEditing(false); }}
          className="text-[11px] font-mono px-1.5 py-0.5 border rounded bg-muted/40 outline-none w-28"
        />
      ) : (
        <span
          className={`text-[11px] font-mono truncate max-w-[120px] cursor-pointer ${hasOverride ? "text-[var(--s-accent)] font-medium" : "text-muted-foreground"}`}
          onClick={() => { setDraft(overrideValue ?? displayBase); setEditing(true); }}
          title="Click to override"
        >
          {hasOverride ? overrideValue : <span className="opacity-40">{displayBase}</span>}
        </span>
      )}

      {hasOverride && (
        <button
          onClick={() => onClear(group, tokenKey)}
          className="text-[10px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 px-1 transition-opacity"
          title="Remove override"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Create/rename theme modal
// ─────────────────────────────────────────────────────────────

function ThemeNameModal({
  initial,
  onSave,
  onClose,
}: {
  initial?: string;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial ?? "");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-background border rounded-xl shadow-2xl w-full max-w-xs mx-4 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold">{initial ? "Rename theme" : "New theme"}</h3>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { onSave(name.trim()); onClose(); } }}
          placeholder="e.g. dark, high-contrast, brand"
          className="w-full px-3 py-2 text-[12px] bg-muted/40 border rounded-md focus:outline-none"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] rounded hover:bg-accent">Cancel</button>
          <button
            onClick={() => { if (name.trim()) { onSave(name.trim()); onClose(); } }}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-[11px] bg-[var(--s-accent)] text-white rounded hover:opacity-90 disabled:opacity-50 font-medium"
          >
            {initial ? "Rename" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main themes tab
// ─────────────────────────────────────────────────────────────

export function DSThemesTab({
  dsId,
  themes: initialThemes,
  tokens,
  onSaved,
}: {
  dsId: string;
  themes: Record<string, unknown>;
  tokens?: Record<string, unknown>;
  onSaved?: (themes: ThemeStore) => void;
}) {
  const [themes, setThemes] = useState<ThemeStore>(
    (initialThemes ?? {}) as ThemeStore
  );
  const [selectedTheme, setSelectedTheme] = useState<string | null>(
    Object.keys((initialThemes ?? {}) as ThemeStore)[0] ?? null
  );
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const tokenStore = (tokens ?? {}) as TokenStore;
  const themeKeys = Object.keys(themes);
  const currentTheme = selectedTheme ? themes[selectedTheme] : null;

  const saveThemes = useCallback(async (next: ThemeStore) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/studio/design-systems/${dsId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themes: next }),
      });
      if (res.ok) {
        toast.success("Themes saved");
        onSaved?.(next);
      } else {
        toast.error("Failed to save themes");
      }
    } catch {
      toast.error("Failed to save themes");
    } finally {
      setSaving(false);
    }
  }, [dsId, onSaved]);

  const handleCreateTheme = (name: string) => {
    const key = name.toLowerCase().replace(/\s+/g, "-");
    if (themes[key]) { toast.error("Theme already exists"); return; }
    const next = { ...themes, [key]: { name, overrides: {} } };
    setThemes(next);
    setSelectedTheme(key);
    saveThemes(next);
  };

  const handleDeleteTheme = (key: string) => {
    if (!confirm(`Delete "${themes[key].name}" theme?`)) return;
    const next = { ...themes };
    delete next[key];
    setThemes(next);
    setSelectedTheme(Object.keys(next)[0] ?? null);
    saveThemes(next);
  };

  const handleGenerateDark = () => {
    if (Object.keys(tokenStore).length === 0) {
      toast.error("Add tokens first before generating a dark theme");
      return;
    }
    const overrides = generateDarkOverrides(tokenStore);
    const next: ThemeStore = {
      ...themes,
      dark: {
        name: "Dark",
        overrides,
      },
    };
    setThemes(next);
    setSelectedTheme("dark");
    saveThemes(next);
    toast.success("Dark theme generated — tweak the overrides to refine");
  };

  const handleSetOverride = (group: string, key: string, value: string) => {
    if (!selectedTheme) return;
    const next = { ...themes };
    const theme = { ...next[selectedTheme] };
    const overrides = { ...theme.overrides };
    if (!overrides[group]) overrides[group] = {};
    overrides[group] = { ...overrides[group], [key]: { value } };
    theme.overrides = overrides;
    next[selectedTheme] = theme;
    setThemes(next);
    saveThemes(next);
  };

  const handleClearOverride = (group: string, key: string) => {
    if (!selectedTheme) return;
    const next = { ...themes };
    const theme = { ...next[selectedTheme] };
    const overrides = { ...theme.overrides };
    if (overrides[group]) {
      const g = { ...overrides[group] };
      delete g[key];
      if (Object.keys(g).length === 0) delete overrides[group];
      else overrides[group] = g;
    }
    theme.overrides = overrides;
    next[selectedTheme] = theme;
    setThemes(next);
    saveThemes(next);
  };

  const totalOverrides = selectedTheme
    ? Object.values(currentTheme?.overrides ?? {}).reduce(
        (sum, g) => sum + Object.keys(g).length,
        0
      )
    : 0;

  // Flat list of all base tokens for override rows
  const allTokenPairs: { group: string; key: string; baseValue: string | number | undefined }[] = [];
  for (const [group, entries] of Object.entries(tokenStore)) {
    for (const [key, entry] of Object.entries(entries)) {
      allTokenPairs.push({ group, key, baseValue: typeof entry.value === "object" && entry.value !== null && "web" in (entry.value as object) ? (entry.value as { web: string }).web : entry.value as string | number });
    }
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold">Themes</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {themeKeys.length} theme{themeKeys.length !== 1 ? "s" : ""} · Each theme overrides base token values. The base tokens (Tokens tab) serve as the default/light theme.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-[10px] text-muted-foreground animate-pulse">Saving…</span>}
          {Object.keys(tokenStore).length > 0 && !themes["dark"] && (
            <button
              onClick={handleGenerateDark}
              className="px-3 py-1.5 text-[11px] border rounded-md hover:bg-accent transition-colors text-muted-foreground"
            >
              Generate dark theme
            </button>
          )}
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 font-medium"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
            New Theme
          </button>
        </div>
      </div>

      {themeKeys.length === 0 ? (
        <div className="border border-dashed border-muted-foreground/30 rounded-xl p-10 text-center space-y-3">
          <p className="text-[12px] text-muted-foreground">
            No themes yet. The base tokens (Tokens tab) serve as your default theme.
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            Create a new theme to add a dark mode, high-contrast variant, or a brand-specific colour scheme.
          </p>
          <div className="flex items-center justify-center gap-2">
            {Object.keys(tokenStore).length > 0 && (
              <button
                onClick={handleGenerateDark}
                className="px-3 py-1.5 text-[11px] border rounded-md hover:bg-accent transition-colors"
              >
                Generate dark theme automatically
              </button>
            )}
            <button
              onClick={() => setShowCreate(true)}
              className="px-3 py-1.5 text-[11px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 font-medium"
            >
              Create manually
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-4">
          {/* Theme list sidebar */}
          <div className="w-36 shrink-0 space-y-1">
            {themeKeys.map((key) => (
              <div key={key} className="group relative">
                <button
                  onClick={() => setSelectedTheme(key)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                    selectedTheme === key
                      ? "bg-[var(--s-accent)]/10 text-[var(--s-accent)] border border-[var(--s-accent)]/30"
                      : "hover:bg-accent text-foreground"
                  }`}
                >
                  {themes[key].name}
                  <div className="text-[9px] text-muted-foreground font-normal mt-0.5">
                    {Object.values(themes[key].overrides).reduce((s, g) => s + Object.keys(g).length, 0)} overrides
                  </div>
                </button>
                <button
                  onClick={() => handleDeleteTheme(key)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[10px] text-muted-foreground hover:text-destructive px-1 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Override editor */}
          {currentTheme && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-[12px] font-semibold">{currentTheme.name}</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {totalOverrides} override{totalOverrides !== 1 ? "s" : ""} · Click any value to override it for this theme
                  </p>
                </div>
                <div className="text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1 font-mono">
                  [data-theme=&quot;{selectedTheme}&quot;]
                </div>
              </div>

              {/* Side-by-side preview */}
              {totalOverrides > 0 && (() => {
                const previewKeys = ["background", "foreground", "primary", "accent", "border", "muted"];
                const rows: { key: string; base: string | null; override: string | null }[] = [];
                for (const pk of previewKeys) {
                  for (const [group, entries] of Object.entries(tokenStore)) {
                    for (const [k, entry] of Object.entries(entries)) {
                      if (k === pk || k.endsWith(`-${pk}`)) {
                        const base = typeof entry.value === "object" ? String((entry.value as { web: string }).web) : String(entry.value);
                        const ov = currentTheme.overrides[group]?.[k]?.value ?? null;
                        rows.push({ key: k, base, override: ov ? String(ov) : null });
                        break;
                      }
                    }
                    if (rows.find((r) => r.key === pk || r.key.endsWith(`-${pk}`))) break;
                  }
                }
                if (rows.length === 0) return null;
                return (
                  <div className="rounded-xl border overflow-hidden mb-3">
                    <div className="px-3 py-2 bg-muted/30 border-b">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Preview — Base vs {currentTheme.name}</span>
                    </div>
                    <div className="grid grid-cols-2 divide-x">
                      <div className="p-3">
                        <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Base</p>
                        <div className="space-y-1.5">
                          {rows.map(({ key, base }) => base && isColor(base) ? (
                            <div key={key} className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded border border-black/10 shrink-0" style={{ background: base }} />
                              <span className="text-[10px] text-muted-foreground truncate">{key}</span>
                            </div>
                          ) : null)}
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-2">{currentTheme.name}</p>
                        <div className="space-y-1.5">
                          {rows.map(({ key, base, override }) => {
                            const val = override ?? base;
                            return val && isColor(val) ? (
                              <div key={key} className="flex items-center gap-2">
                                <div className={`w-5 h-5 rounded border shrink-0 ${override ? "border-[var(--s-accent)]/50 ring-1 ring-[var(--s-accent)]/30" : "border-black/10"}`} style={{ background: val }} />
                                <span className={`text-[10px] truncate ${override ? "text-[var(--s-accent)] font-medium" : "text-muted-foreground"}`}>{key}</span>
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {allTokenPairs.length === 0 ? (
                <div className="text-[11px] text-muted-foreground text-center py-6 border border-dashed rounded-xl">
                  Add tokens in the Tokens tab first, then come back to add theme overrides.
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <div className="py-1 max-h-[420px] overflow-y-auto">
                    {allTokenPairs.map(({ group, key, baseValue }) => (
                      <OverrideRow
                        key={`${group}.${key}`}
                        group={group}
                        tokenKey={key}
                        baseValue={baseValue}
                        overrideValue={currentTheme.overrides[group]?.[key]?.value}
                        onEdit={handleSetOverride}
                        onClear={handleClearOverride}
                      />
                    ))}
                  </div>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground mt-3">
                The compiler emits <code className="bg-muted px-1 rounded">:root {"{ ... }"}</code> for base tokens and <code className="bg-muted px-1 rounded">[data-theme=&quot;{selectedTheme}&quot;] {"{ ... }"}</code> for overridden values.
              </p>
            </div>
          )}
        </div>
      )}

      {showCreate && (
        <ThemeNameModal onSave={handleCreateTheme} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}
