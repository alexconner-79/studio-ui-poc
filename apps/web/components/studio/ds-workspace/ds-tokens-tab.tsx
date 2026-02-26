"use client";

import React, { useState, useCallback } from "react";
import { toast } from "@/lib/studio/toast";
import { DSStarterPicker } from "./ds-starter-picker";
import { DSTypographyPanel } from "./ds-typography-panel";
import { resolveTokenValue, getAliasOptions } from "@/lib/studio/ds-resolve";
import { ImportTokensModal } from "../import-tokens-modal";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type TokenValue = string | number | { web: string; native: number };

interface TokenEntry {
  value: TokenValue;
  description?: string;
}

type TokenGroup = Record<string, TokenEntry>;
type TokenStore = Record<string, TokenGroup>;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function displayValue(value: TokenValue): string {
  if (typeof value === "object") return `web: ${value.web} / native: ${value.native}`;
  return String(value);
}

function isAlias(value: TokenValue): boolean {
  return typeof value === "string" && value.startsWith("$");
}

function isColor(value: TokenValue, resolved?: string | number | null): boolean {
  const str = resolved ? String(resolved) : typeof value === "string" ? value : typeof value === "object" ? String(value.web) : "";
  return str.startsWith("#") || str.startsWith("rgb") || str.startsWith("hsl");
}

// ─────────────────────────────────────────────────────────────
// Token row
// ─────────────────────────────────────────────────────────────

function TokenRow({
  groupKey,
  tokenKey,
  entry,
  allTokens,
  onEdit,
  onDelete,
  isSelected,
  onToggleSelect,
}: {
  groupKey: string;
  tokenKey: string;
  entry: TokenEntry;
  allTokens: TokenStore;
  onEdit: (groupKey: string, tokenKey: string, entry: TokenEntry) => void;
  onDelete: (groupKey: string, tokenKey: string) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editKey, setEditKey] = useState(tokenKey);
  const [editVal, setEditVal] = useState(typeof entry.value === "object" ? String((entry.value as { web: string }).web) : String(entry.value));
  const valInputRef = React.useRef<HTMLInputElement>(null);
  const rowId = `${groupKey}/${tokenKey}`;

  const val = entry.value;
  const alias = isAlias(val);
  const { resolved, chain } = alias
    ? resolveTokenValue(val, allTokens)
    : { resolved: null, chain: [] };

  const displayStr = alias
    ? (resolved !== null ? String(resolved) : "unresolved")
    : displayValue(val);

  const showColor = isColor(val, alias ? resolved : null);
  const colorBg = alias
    ? (resolved ? String(resolved) : "transparent")
    : typeof val === "string" ? val : typeof val === "object" ? String(val.web) : "transparent";

  const isEditValAlias = editVal.startsWith("$");
  const isEditValColor = !isEditValAlias && isColor(editVal);
  const aliasOpts = isEditValAlias ? getAliasOptions(allTokens) : [];

  const startEdit = () => {
    setEditKey(tokenKey);
    setEditVal(typeof entry.value === "object" ? String((entry.value as { web: string }).web) : String(entry.value));
    setEditing(true);
    setTimeout(() => valInputRef.current?.focus(), 0);
  };

  const commitEdit = () => {
    if (editKey.trim() && editVal.trim()) {
      onEdit(groupKey, editKey.trim(), { ...entry, value: editVal.trim() });
      if (editKey.trim() !== tokenKey) onDelete(groupKey, tokenKey);
    }
    setEditing(false);
  };

  const cancelEdit = () => setEditing(false);

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-accent/30 border-l-2 border-[var(--s-accent)]">
        <input
          value={editKey}
          onChange={(e) => setEditKey(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
          className="text-[11px] font-mono bg-background border rounded px-1.5 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
          placeholder="name"
        />
        <span className="text-muted-foreground text-[10px]">:</span>
        {isEditValAlias ? (
          <select
            ref={valInputRef as unknown as React.RefObject<HTMLSelectElement>}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
            className="text-[11px] font-mono bg-background border rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
          >
            {aliasOpts.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <div className="flex-1 flex items-center gap-1.5">
            {isEditValColor && (
              <input
                type="color"
                value={editVal.startsWith("#") && editVal.length >= 7 ? editVal.slice(0, 7) : "#000000"}
                onChange={(e) => setEditVal(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border border-black/10 shrink-0 p-0"
              />
            )}
            <input
              ref={valInputRef}
              value={editVal}
              onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") cancelEdit(); }}
              className="text-[11px] font-mono bg-background border rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
              placeholder="value or $alias"
            />
          </div>
        )}
        <button onClick={commitEdit} className="text-[10px] text-[var(--s-accent)] font-medium px-1.5 py-0.5 hover:bg-accent rounded">✓</button>
        <button onClick={cancelEdit} className="text-[10px] text-muted-foreground px-1.5 py-0.5 hover:bg-accent rounded">✕</button>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded hover:bg-accent/50 group transition-colors cursor-default ${isSelected ? "bg-[var(--s-accent)]/10" : ""}`}
      onDoubleClick={startEdit}
      title="Double-click to edit"
    >
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={!!isSelected}
          onChange={() => onToggleSelect(rowId)}
          onClick={(e) => e.stopPropagation()}
          className="w-3 h-3 accent-[var(--s-accent)] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ opacity: isSelected ? 1 : undefined }}
        />
      )}
      {/* Swatch / bar */}
      {showColor ? (
        <div className="w-5 h-5 rounded border border-black/10 shrink-0" style={{ background: colorBg }} />
      ) : (
        <div className="w-5 h-5 shrink-0 flex items-center justify-center">
          <div
            className="h-1.5 rounded-sm bg-teal-400/60 border border-teal-500/40"
            style={{ width: Math.min(parseFloat(displayStr) * 0.7 || 4, 20) }}
          />
        </div>
      )}

      {/* Name */}
      <span className="text-[11px] font-mono text-foreground flex-1 truncate">{tokenKey}</span>

      {/* Value / alias chain */}
      <div className="flex items-center gap-1 max-w-[200px] overflow-hidden">
        {alias && (
          <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 shrink-0">
            alias
          </span>
        )}
        <span className="text-[11px] text-muted-foreground font-mono truncate" title={chain.join(" → ")}>
          {alias ? (
            <>
              <span className="text-purple-500 dark:text-purple-400">{String(val)}</span>
              {resolved !== null && (
                <span className="text-muted-foreground/60 ml-1">→ {displayStr}</span>
              )}
              {resolved === null && (
                <span className="text-amber-500 ml-1">⚠ unresolved</span>
              )}
            </>
          ) : displayValue(val)}
        </span>
      </div>

      {entry.description && (
        <span className="text-[10px] text-muted-foreground/60 truncate max-w-[80px] hidden group-hover:block">{entry.description}</span>
      )}
      <div className="hidden group-hover:flex items-center gap-1 ml-1">
        <button
          onClick={startEdit}
          className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-accent"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(groupKey, tokenKey)}
          className="text-[10px] text-muted-foreground hover:text-destructive px-1.5 py-0.5 rounded hover:bg-accent"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Edit/Add token modal
// ─────────────────────────────────────────────────────────────

function TokenModal({
  groups,
  aliasOptions,
  initial,
  onSave,
  onClose,
}: {
  groups: string[];
  aliasOptions: string[];
  initial?: { groupKey: string; tokenKey: string; entry: TokenEntry };
  onSave: (groupKey: string, tokenKey: string, entry: TokenEntry) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState(initial?.groupKey ?? groups[0] ?? "");
  const [newGroup, setNewGroup] = useState("");
  const [key, setKey] = useState(initial?.tokenKey ?? "");
  const rawVal = initial?.entry.value;
  const isInitAlias = typeof rawVal === "string" && rawVal.startsWith("$");
  const [valueMode, setValueMode] = useState<"raw" | "alias">(isInitAlias ? "alias" : "raw");
  const [value, setValue] = useState(
    typeof rawVal === "object" && rawVal !== null
      ? String((rawVal as { web: string }).web)
      : String(rawVal ?? "")
  );
  const [description, setDescription] = useState(initial?.entry.description ?? "");
  const isNew = !initial;

  const effectiveGroup = group === "__new__" ? newGroup.trim() : group;
  const finalValue = value.trim();

  const handleSave = () => {
    if (!effectiveGroup || !key.trim() || !finalValue) return;
    onSave(effectiveGroup, key.trim(), { value: finalValue, description: description.trim() || undefined });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-background border rounded-xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">{isNew ? "Add Token" : "Edit Token"}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
        </div>
        <div className="px-4 py-4 space-y-3">
          {/* Group */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Group</label>
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="w-full px-2 py-1.5 text-[12px] bg-muted/40 border rounded-md focus:outline-none"
              disabled={!isNew}
            >
              {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              <option value="__new__">+ New group…</option>
            </select>
            {group === "__new__" && (
              <input
                autoFocus
                type="text"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                placeholder="e.g. typography, radius"
                className="w-full px-2 py-1.5 text-[12px] bg-muted/40 border rounded-md mt-1 focus:outline-none"
              />
            )}
          </div>

          {/* Token name */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Token name</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="e.g. primary, md, 400"
              className="w-full px-2 py-1.5 text-[12px] bg-muted/40 border rounded-md focus:outline-none"
              disabled={!isNew}
            />
          </div>

          {/* Value mode toggle */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-muted-foreground">Value</label>
              <div className="flex rounded-md overflow-hidden border text-[10px]">
                <button
                  type="button"
                  onClick={() => { setValueMode("raw"); setValue(""); }}
                  className={`px-2 py-0.5 transition-colors ${valueMode === "raw" ? "bg-[var(--s-accent)] text-white" : "hover:bg-accent"}`}
                >
                  Raw
                </button>
                <button
                  type="button"
                  onClick={() => { setValueMode("alias"); setValue(""); }}
                  className={`px-2 py-0.5 transition-colors ${valueMode === "alias" ? "bg-purple-600 text-white" : "hover:bg-accent"}`}
                >
                  Alias →
                </button>
              </div>
            </div>

            {valueMode === "raw" ? (
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. #7C3AED, 16px, 1.5rem"
                className="w-full px-2 py-1.5 text-[12px] bg-muted/40 border rounded-md focus:outline-none"
              />
            ) : (
              <div>
                <select
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full px-2 py-1.5 text-[12px] bg-muted/40 border rounded-md focus:outline-none font-mono"
                >
                  <option value="">— Select a token to alias —</option>
                  {aliasOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  This token will resolve to the value of the selected token at compile time.
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Description <span className="font-normal">(optional)</span></label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Primary brand colour"
              className="w-full px-2 py-1.5 text-[12px] bg-muted/40 border rounded-md focus:outline-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] rounded-md hover:bg-accent transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={!effectiveGroup || !key.trim() || !finalValue}
            className="px-3 py-1.5 text-[11px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 disabled:opacity-50 font-medium"
          >
            {isNew ? "Add" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main tokens tab
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Text Styles Section
// ─────────────────────────────────────────────────────────────

type TextStyleDef = {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  lineHeight?: string;
  letterSpacing?: string;
};

type TextStyleStore = Record<string, TextStyleDef>;

const DEFAULT_TEXT_STYLE: TextStyleDef = { fontSize: "16px", fontWeight: "400", lineHeight: "1.5" };

function TextStylesSection({
  textStyles: initialStyles,
  onSaved: onSavedProp,
}: {
  textStyles: TextStyleStore;
  /** Called with the full updated TextStyleStore — parent handles API save */
  onSaved: (styles: TextStyleStore) => void;
}) {
  const [styles, setStyles] = useState<TextStyleStore>(initialStyles);
  const [open, setOpen] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  const handleFieldChange = (name: string, field: keyof TextStyleDef, value: string) => {
    const next = { ...styles, [name]: { ...styles[name], [field]: value || undefined } };
    setStyles(next);
  };

  const handleSaveStyle = () => {
    onSavedProp(styles);
    setEditingKey(null);
  };

  const handleDelete = (name: string) => {
    const next = { ...styles };
    delete next[name];
    setStyles(next);
    onSavedProp(next);
  };

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed || styles[trimmed]) return;
    const next = { ...styles, [trimmed]: { ...DEFAULT_TEXT_STYLE } };
    setStyles(next);
    setNewName("");
    setEditingKey(trimmed);
  };

  const names = Object.keys(styles);

  return (
    <div className="rounded-xl border overflow-hidden mt-4">
      <div className="px-3 py-2 bg-muted/30 border-b flex items-center justify-between">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s ease", flexShrink: 0 }}>
            <polyline points="3,2 7,5 3,8"/>
          </svg>
          Text Styles
        </button>
        <span className="text-[10px] text-muted-foreground">{names.length}</span>
      </div>
      {open && (
        <div>
          {names.length === 0 && (
            <div className="px-3 py-4 text-[11px] text-muted-foreground text-center">
              No text styles yet. Add H1, Body, Caption etc.
            </div>
          )}
          {names.map((name) => {
            const def = styles[name] ?? {};
            const isEditing = editingKey === name;
            const previewSize = Math.min(Math.max(parseFloat(def.fontSize ?? "14") || 14, 11), 24);
            return (
              <div key={name} className="border-b last:border-b-0">
                <div
                  className="flex items-center gap-2 px-3 py-2 hover:bg-accent/50 cursor-pointer"
                  onClick={() => setEditingKey(isEditing ? null : name)}
                >
                  <span
                    className="flex-1 truncate"
                    style={{ fontSize: previewSize, fontWeight: def.fontWeight ?? "400", fontFamily: def.fontFamily, lineHeight: 1.2 }}
                  >
                    {name}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0">{def.fontSize ?? "—"} / {def.fontWeight ?? "—"}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(name); }}
                    className="text-[10px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
                {isEditing && (
                  <div className="px-3 py-3 bg-muted/20 border-t space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        ["fontSize", "Font Size", "16px"],
                        ["fontWeight", "Weight", "400"],
                        ["lineHeight", "Line Height", "1.5"],
                        ["letterSpacing", "Letter Spacing", "0em"],
                      ] as const).map(([field, label, placeholder]) => (
                        <div key={field} className="flex flex-col gap-0.5">
                          <label className="text-[10px] text-muted-foreground">{label}</label>
                          <input
                            type="text"
                            value={def[field] ?? ""}
                            onChange={(e) => handleFieldChange(name, field, e.target.value)}
                            placeholder={placeholder}
                            className="h-6 px-2 text-[11px] bg-background border rounded"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <label className="text-[10px] text-muted-foreground">Font Family</label>
                      <input
                        type="text"
                        value={def.fontFamily ?? ""}
                        onChange={(e) => handleFieldChange(name, "fontFamily", e.target.value)}
                        placeholder="Inter, sans-serif"
                        className="h-6 px-2 text-[11px] bg-background border rounded w-full"
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={handleSaveStyle}
                        className="px-3 py-1 text-[11px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 font-medium"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {/* Add new */}
          <div className="flex items-center gap-2 px-3 py-2 border-t bg-muted/10">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="New style name…"
              className="flex-1 h-6 px-2 text-[11px] bg-background border rounded"
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="px-2 py-1 text-[11px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 disabled:opacity-40 font-medium"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Visual Overview
// ─────────────────────────────────────────────────────────────

function TokenOverview({ tokens }: { tokens: TokenStore }) {
  const [open, setOpen] = useState(true);

  const colorEntries: { key: string; value: string }[] = [];
  const spacingEntries: { key: string; value: string }[] = [];
  const typeSizeEntries: { key: string; value: string }[] = [];

  for (const [groupKey, group] of Object.entries(tokens)) {
    for (const [tokenKey, entry] of Object.entries(group)) {
      const e = entry as TokenEntry;
      const raw = typeof e.value === "object" ? String((e.value as { web: string }).web) : String(e.value);
      if (raw.startsWith("#") || raw.startsWith("rgb") || raw.startsWith("hsl")) {
        colorEntries.push({ key: tokenKey, value: raw });
      } else if (groupKey === "spacing" || /^\d+(\.\d+)?(px|rem|em)$/.test(raw)) {
        spacingEntries.push({ key: tokenKey, value: raw });
      } else if (groupKey === "typography" && (tokenKey.startsWith("size") || tokenKey.includes("font-size"))) {
        typeSizeEntries.push({ key: tokenKey, value: raw });
      }
    }
  }

  if (colorEntries.length === 0 && spacingEntries.length === 0) return null;

  return (
    <div className="rounded-xl border overflow-hidden mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/30 border-b text-left hover:bg-muted/50 transition-colors"
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Overview</span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        >
          <polyline points="2,4 6,8 10,4"/>
        </svg>
      </button>
      {open && (
        <div className="p-3 space-y-4">
          {colorEntries.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Colours ({colorEntries.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {colorEntries.map(({ key, value }, i) => (
                  <div key={`color-${i}-${key}`} className="flex flex-col items-center gap-1" title={`${key}: ${value}`}>
                    <div className="w-7 h-7 rounded-md border border-black/10 shadow-sm" style={{ background: value }} />
                    <span className="text-[9px] text-muted-foreground truncate max-w-[28px]">{key.split("-").pop()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {spacingEntries.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Spacing ({spacingEntries.length})</p>
              <div className="flex items-end gap-1.5 flex-wrap">
                {spacingEntries.slice(0, 12).map(({ key, value }, i) => {
                  const num = parseFloat(value);
                  const px = value.endsWith("rem") ? num * 16 : num;
                  const w = Math.max(4, Math.min(px, 64));
                  return (
                    <div key={`spacing-${i}-${key}`} className="flex flex-col items-center gap-1" title={`${key}: ${value}`}>
                      <div className="bg-[var(--s-accent)]/30 border border-[var(--s-accent)]/50 rounded-sm" style={{ width: w, height: 16 }} />
                      <span className="text-[9px] text-muted-foreground">{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {typeSizeEntries.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Type Scale</p>
              <div className="space-y-0.5">
                {typeSizeEntries.slice(0, 8).map(({ key, value }, i) => (
                  <div key={`type-${i}-${key}`} className="flex items-baseline gap-2">
                    <span className="text-[9px] text-muted-foreground w-16 shrink-0">{key}</span>
                    <span style={{ fontSize: value, lineHeight: 1.2 }} className="text-foreground truncate">Aa</span>
                    <span className="text-[9px] text-muted-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DSTokensTab({
  dsId,
  platform,
  tokens: initialTokens,
  onSaved,
}: {
  dsId: string;
  platform: "web" | "native" | "universal";
  tokens: Record<string, unknown>;
  onSaved: (tokens: Record<string, unknown>) => void;
}) {
  const [tokens, setTokens] = useState<TokenStore>(initialTokens as TokenStore);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showStarterPicker, setShowStarterPicker] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTarget, setEditTarget] = useState<{ groupKey: string; tokenKey: string; entry: TokenEntry } | undefined>();
  const [search, setSearch] = useState("");
  const [selectedTokens, setSelectedTokens] = useState<Set<string>>(new Set());
  const [dragGroupIdx, setDragGroupIdx] = useState<number | null>(null);
  const [dropGroupIdx, setDropGroupIdx] = useState<number | null>(null);

  const groups = Object.keys(tokens);
  const aliasOptions = getAliasOptions(tokens);

  const saveTokens = useCallback(async (next: TokenStore) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/studio/design-systems/${dsId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: next }),
      });
      if (res.ok) {
        onSaved(next as Record<string, unknown>);
        toast.success("Tokens saved");
      } else {
        toast.error("Failed to save tokens");
      }
    } catch {
      toast.error("Failed to save tokens");
    } finally {
      setSaving(false);
    }
  }, [dsId, onSaved]);

  const handleAddOrEdit = (groupKey: string, tokenKey: string, entry: TokenEntry) => {
    const next = { ...tokens };
    if (!next[groupKey]) next[groupKey] = {};
    next[groupKey] = { ...next[groupKey], [tokenKey]: entry };
    setTokens(next);
    saveTokens(next);
  };

  const handleDelete = (groupKey: string, tokenKey: string) => {
    const next = { ...tokens };
    const group = { ...next[groupKey] };
    delete group[tokenKey];
    if (Object.keys(group).length === 0) {
      delete next[groupKey];
    } else {
      next[groupKey] = group;
    }
    setTokens(next);
    saveTokens(next);
  };

  const handleBulkDelete = () => {
    if (selectedTokens.size === 0) return;
    const next = { ...tokens };
    for (const id of selectedTokens) {
      const [gk, tk] = id.split("/");
      if (next[gk]) {
        const g = { ...next[gk] };
        delete g[tk];
        if (Object.keys(g).length === 0) delete next[gk];
        else next[gk] = g;
      }
    }
    setTokens(next);
    setSelectedTokens(new Set());
    saveTokens(next);
  };

  const toggleSelect = (id: string) => {
    setSelectedTokens((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleGroupDrop = (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const next: TokenStore = {};
    const reordered = [...groups];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    for (const g of reordered) next[g] = tokens[g];
    setTokens(next);
    saveTokens(next);
  };

  const totalTokens = groups.reduce((sum, g) => sum + Object.keys(tokens[g] ?? {}).length, 0);

  const lowerSearch = search.toLowerCase().trim();
  const filteredGroups = lowerSearch
    ? groups.filter((g) => {
        if (g.toLowerCase().includes(lowerSearch)) return true;
        return Object.keys(tokens[g] ?? {}).some((k) => k.toLowerCase().includes(lowerSearch));
      })
    : groups;

  // If no tokens and picker is requested, show picker full-screen within tab
  if (showStarterPicker || groups.length === 0) {
    return (
      <div className="max-w-2xl">
        {groups.length > 0 && (
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={() => setShowStarterPicker(false)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="8,2 4,6 8,10"/>
              </svg>
              Back to tokens
            </button>
          </div>
        )}
        <DSStarterPicker
          dsId={dsId}
          currentPlatform={platform}
          onApplied={(newTokens) => {
            if (Object.keys(newTokens).length > 0) {
              const store = newTokens as TokenStore;
              setTokens(store);
              onSaved(newTokens);
            }
            setShowStarterPicker(false);
          }}
        />

      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold">Tokens</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {totalTokens} token{totalTokens !== 1 ? "s" : ""} across {groups.length} group{groups.length !== 1 ? "s" : ""} · {platform} platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-[10px] text-muted-foreground animate-pulse">Saving…</span>}
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] border rounded-md hover:bg-accent transition-colors text-muted-foreground"
          >
            Import
          </button>
          <button
            onClick={() => setShowStarterPicker(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] border rounded-md hover:bg-accent transition-colors text-muted-foreground"
          >
            Starters
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 font-medium"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
            Add Token
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="6.5" cy="6.5" r="5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tokens…"
          className="w-full pl-7 pr-3 py-1.5 text-[12px] bg-muted/40 border rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm">×</button>
        )}
      </div>

      {/* Visual overview */}
      {!lowerSearch && <TokenOverview tokens={tokens} />}

      {/* Bulk action bar */}
      {selectedTokens.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 mb-3 rounded-lg bg-[var(--s-accent)]/10 border border-[var(--s-accent)]/30">
          <span className="text-[11px] font-medium text-[var(--s-accent)]">{selectedTokens.size} selected</span>
          <button onClick={handleBulkDelete} className="text-[11px] text-destructive hover:underline">Delete selected</button>
          <button onClick={() => setSelectedTokens(new Set())} className="ml-auto text-[11px] text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="border border-dashed border-muted-foreground/30 rounded-xl p-10 text-center">
          <p className="text-[12px] text-muted-foreground mb-3">No tokens yet. Add your first token or import from a starter boilerplate.</p>
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-1.5 text-[11px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 font-medium"
          >
            Add Token
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {lowerSearch && filteredGroups.length === 0 && (
            <p className="text-[12px] text-muted-foreground text-center py-8">No tokens match &ldquo;{search}&rdquo;</p>
          )}
          {filteredGroups.map((groupKey) => {
            const groupIdx = groups.indexOf(groupKey);
            const group = tokens[groupKey];
            const visibleEntries = lowerSearch
              ? Object.entries(group).filter(([k]) => k.toLowerCase().includes(lowerSearch) || groupKey.toLowerCase().includes(lowerSearch))
              : Object.entries(group);
            const isDraggingOver = dropGroupIdx === groupIdx && dragGroupIdx !== groupIdx;
            return (
              <div
                key={groupKey}
                className={`rounded-xl border overflow-hidden transition-all ${isDraggingOver ? "border-[var(--s-accent)] shadow-md" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDropGroupIdx(groupIdx); }}
                onDragLeave={() => setDropGroupIdx(null)}
                onDrop={(e) => { e.preventDefault(); if (dragGroupIdx !== null) handleGroupDrop(dragGroupIdx, groupIdx); setDragGroupIdx(null); setDropGroupIdx(null); }}
              >
                <div
                  className="px-3 py-2 bg-muted/30 border-b flex items-center justify-between cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={() => setDragGroupIdx(groupIdx)}
                  onDragEnd={() => { setDragGroupIdx(null); setDropGroupIdx(null); }}
                >
                  <div className="flex items-center gap-2">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-muted-foreground/40 shrink-0">
                      <circle cx="3" cy="2" r="1"/><circle cx="7" cy="2" r="1"/>
                      <circle cx="3" cy="5" r="1"/><circle cx="7" cy="5" r="1"/>
                      <circle cx="3" cy="8" r="1"/><circle cx="7" cy="8" r="1"/>
                    </svg>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{groupKey}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{visibleEntries.length}</span>
                </div>
                <div className="py-1">
                  {visibleEntries.map(([tokenKey, entry]) => (
                    <TokenRow
                      key={tokenKey}
                      groupKey={groupKey}
                      tokenKey={tokenKey}
                      entry={entry as TokenEntry}
                      allTokens={tokens}
                      onEdit={handleAddOrEdit}
                      onDelete={handleDelete}
                      isSelected={selectedTokens.has(`${groupKey}/${tokenKey}`)}
                      onToggleSelect={toggleSelect}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Typography panel — inline prompt */}
          <DSTypographyPanel
            dsId={dsId}
            existingTypography={tokens.typography as Record<string, { value: string }> | undefined}
            onSaved={(updatedTypography) => {
              const next = { ...tokens, ...(updatedTypography as TokenStore) };
              setTokens(next);
              onSaved(next as Record<string, unknown>);
            }}
          />

          {/* Text Styles section */}
          <TextStylesSection
            textStyles={(tokens.textStyles ?? {}) as TextStyleStore}
            onSaved={(updatedStyles) => {
              const next = { ...tokens, textStyles: updatedStyles as unknown as TokenGroup };
              setTokens(next);
              saveTokens(next);
            }}
          />
        </div>
      )}

      {showImport && (
        <ImportTokensModal
          dsId={dsId}
          existingTokens={tokens as Record<string, unknown>}
          onClose={() => {
            setShowImport(false);
            // Reload tokens from API after import
            fetch(`/api/studio/design-systems/${dsId}`)
              .then((r) => r.json())
              .then((d: { designSystem?: { tokens: Record<string, unknown> } }) => {
                if (d.designSystem?.tokens) {
                  setTokens(d.designSystem.tokens as TokenStore);
                  onSaved(d.designSystem.tokens);
                }
              })
              .catch(() => { /* non-critical */ });
          }}
        />
      )}
      {showAdd && (
        <TokenModal
          groups={groups.length > 0 ? groups : ["color"]}
          aliasOptions={aliasOptions}
          onSave={handleAddOrEdit}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editTarget && (
        <TokenModal
          groups={groups}
          aliasOptions={aliasOptions}
          initial={editTarget}
          onSave={handleAddOrEdit}
          onClose={() => setEditTarget(undefined)}
        />
      )}
    </div>
  );
}
