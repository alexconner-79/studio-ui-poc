"use client";

import React, { useState, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
// Parsers (client-side, no API round-trip required for preview)
// ─────────────────────────────────────────────────────────────

type TokenEntry = { value: string; description?: string };
type TokenStore = Record<string, Record<string, TokenEntry>>;

/** W3C DTCG format: { "group": { "key": { "$value": "..." } } } */
function parseW3C(raw: string): TokenStore {
  const obj = JSON.parse(raw) as Record<string, Record<string, { "$value"?: unknown; value?: unknown; $description?: string }>>;
  const out: TokenStore = {};
  for (const [group, entries] of Object.entries(obj)) {
    if (typeof entries !== "object" || Array.isArray(entries)) continue;
    out[group] = {};
    for (const [key, entry] of Object.entries(entries)) {
      const val = entry["$value"] ?? entry["value"];
      if (val === undefined) continue;
      out[group][key] = { value: String(val), description: entry["$description"] };
    }
  }
  return out;
}

/** Style Dictionary format: { "color": { "primary": { "value": "..." } } } */
function parseStyleDictionary(raw: string): TokenStore {
  const obj = JSON.parse(raw) as Record<string, Record<string, { value?: unknown; comment?: string }>>;
  const out: TokenStore = {};
  for (const [group, entries] of Object.entries(obj)) {
    if (typeof entries !== "object" || Array.isArray(entries)) continue;
    out[group] = {};
    for (const [key, entry] of Object.entries(entries)) {
      if (typeof entry !== "object" || entry.value === undefined) continue;
      out[group][key] = { value: String(entry.value), description: entry.comment };
    }
  }
  return out;
}

/** Tailwind config JS: extract theme.extend (or theme) colours and spacing */
function parseTailwind(raw: string): TokenStore {
  // Safely extract the object literal after module.exports = { theme: { extend: { ... } } }
  // Fallback: try to find a JSON-like block
  const out: TokenStore = { color: {}, spacing: {} };

  const colorMatch = raw.match(/colors?\s*:\s*({[\s\S]*?})\s*[,}]/);
  const spacingMatch = raw.match(/spacing\s*:\s*({[\s\S]*?})\s*[,}]/);

  const extractKV = (block: string): Record<string, string> => {
    const result: Record<string, string> = {};
    const kvRegex = /['"]?([\w-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = kvRegex.exec(block)) !== null) {
      result[m[1]] = m[2];
    }
    return result;
  };

  if (colorMatch) {
    const kv = extractKV(colorMatch[1]);
    for (const [k, v] of Object.entries(kv)) out.color[k] = { value: v };
  }
  if (spacingMatch) {
    const kv = extractKV(spacingMatch[1]);
    for (const [k, v] of Object.entries(kv)) out.spacing[k] = { value: v };
  }

  // Remove empty groups
  for (const key of Object.keys(out)) {
    if (Object.keys(out[key]).length === 0) delete out[key];
  }
  return out;
}

/** shadcn/CSS custom properties: :root { --key: value; } */
function parseShadcn(raw: string): TokenStore {
  const out: TokenStore = { color: {} };
  const varRegex = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = varRegex.exec(raw)) !== null) {
    const name = m[1].trim();
    const val = m[2].trim();
    // Convert HSL tuples to hsl() strings if needed
    const finalVal = /^\d/.test(val) ? `hsl(${val})` : val;
    out.color[name] = { value: finalVal };
  }
  if (Object.keys(out.color).length === 0) delete out.color;
  return out;
}

type Format = "w3c" | "style-dictionary" | "tailwind" | "shadcn";

const FORMAT_OPTIONS: { id: Format; label: string; description: string; placeholder: string }[] = [
  {
    id: "w3c",
    label: "W3C Design Tokens",
    description: ".tokens.json (DTCG community format)",
    placeholder: `{\n  "color": {\n    "primary": { "$value": "#3b82f6", "$type": "color" }\n  }\n}`,
  },
  {
    id: "style-dictionary",
    label: "Style Dictionary",
    description: "Amazon Style Dictionary JSON",
    placeholder: `{\n  "color": {\n    "primary": { "value": "#3b82f6", "comment": "Brand blue" }\n  }\n}`,
  },
  {
    id: "tailwind",
    label: "Tailwind Config",
    description: "tailwind.config.js / theme.extend",
    placeholder: `module.exports = {\n  theme: {\n    extend: {\n      colors: { primary: '#3b82f6' },\n    },\n  },\n}`,
  },
  {
    id: "shadcn",
    label: "CSS Variables",
    description: ":root { --token: value; } block",
    placeholder: `:root {\n  --background: 0 0% 100%;\n  --primary: 221.2 83.2% 53.3%;\n}`,
  },
];

function parseByFormat(format: Format, raw: string): TokenStore {
  switch (format) {
    case "w3c": return parseW3C(raw);
    case "style-dictionary": return parseStyleDictionary(raw);
    case "tailwind": return parseTailwind(raw);
    case "shadcn": return parseShadcn(raw);
  }
}

function tokenCount(tokens: TokenStore): number {
  return Object.values(tokens).reduce((sum, g) => sum + Object.keys(g).length, 0);
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

interface ImportTokensModalProps {
  onClose: () => void;
  /** If provided, imports directly into a DS by ID (PUT /api/studio/design-systems/:id).
   *  Otherwise falls back to the legacy /api/studio/tokens/import endpoint. */
  dsId?: string;
  /** Existing tokens for merge conflict detection */
  existingTokens?: Record<string, unknown>;
}

export function ImportTokensModal({ onClose, dsId, existingTokens }: ImportTokensModalProps) {
  const [format, setFormat] = useState<Format>("w3c");
  const [inputMode, setInputMode] = useState<"paste" | "file" | "url">("paste");
  const [rawInput, setRawInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [preview, setPreview] = useState<TokenStore | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState<"merge" | "replace">("merge");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fmtOption = FORMAT_OPTIONS.find((f) => f.id === format)!;

  const handleFileRead = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setRawInput(e.target?.result as string ?? "");
      setInputMode("paste");
      setPreview(null);
      setParseError(null);
    };
    reader.readAsText(file);
  };

  const handleUrlFetch = async () => {
    if (!urlInput.trim()) return;
    setLoading(true);
    setParseError(null);
    try {
      const res = await fetch(`/api/studio/tokens/fetch-url?url=${encodeURIComponent(urlInput.trim())}`);
      if (!res.ok) throw new Error("Failed to fetch URL");
      const text = await res.text();
      setRawInput(text);
      setInputMode("paste");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to fetch URL");
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = useCallback(() => {
    setParseError(null);
    setPreview(null);
    const raw = rawInput.trim();
    if (!raw) return;
    try {
      const parsed = parseByFormat(format, raw);
      setPreview(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse");
    }
  }, [rawInput, format]);

  const handleImport = async () => {
    if (!preview) return;
    setLoading(true);
    setParseError(null);
    try {
      let tokensToSave: Record<string, unknown> = preview;

      if (mergeMode === "merge" && existingTokens && Object.keys(existingTokens).length > 0) {
        // Deep merge: preserve existing tokens, overlay new ones
        const merged: Record<string, unknown> = { ...existingTokens };
        for (const [group, entries] of Object.entries(preview)) {
          if (merged[group] && typeof merged[group] === "object") {
            merged[group] = { ...(merged[group] as Record<string, unknown>), ...entries };
          } else {
            merged[group] = entries;
          }
        }
        tokensToSave = merged;
      }

      if (dsId) {
        const res = await fetch(`/api/studio/design-systems/${dsId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tokens: tokensToSave }),
        });
        if (!res.ok) throw new Error("Failed to import");
      } else {
        const res = await fetch("/api/studio/tokens/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ format, data: rawInput }),
        });
        if (!res.ok) throw new Error("Failed to import");
      }

      setSuccess(true);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const existingCount = existingTokens
    ? Object.values(existingTokens).reduce<number>((sum, g) => {
        if (g && typeof g === "object" && !Array.isArray(g)) return sum + Object.keys(g).length;
        return sum;
      }, 0)
    : 0;

  // Detect conflicts (tokens that exist in both)
  const conflicts: string[] = [];
  if (preview && existingTokens) {
    for (const [group, entries] of Object.entries(preview)) {
      const existing = existingTokens[group];
      if (existing && typeof existing === "object") {
        for (const key of Object.keys(entries)) {
          if ((existing as Record<string, unknown>)[key] !== undefined) {
            conflicts.push(`${group}.${key}`);
          }
        }
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-background border rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-sm font-semibold">Import Tokens</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Import from a file, URL, or paste directly
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Format selector */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-2 block">Format</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setFormat(f.id); setPreview(null); setParseError(null); }}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    format === f.id
                      ? "border-[var(--s-accent)] bg-[var(--s-accent)]/5"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <div className={`text-[11px] font-semibold mb-0.5 ${format === f.id ? "text-[var(--s-accent)]" : ""}`}>{f.label}</div>
                  <div className="text-[10px] text-muted-foreground">{f.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Input mode */}
          <div>
            <div className="flex items-center gap-1 mb-2">
              <label className="text-[11px] font-medium text-muted-foreground mr-1">Source</label>
              {(["paste", "file", "url"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setInputMode(m)}
                  className={`px-2.5 py-0.5 text-[10px] rounded-full border transition-colors ${
                    inputMode === m ? "border-[var(--s-accent)] bg-[var(--s-accent)]/10 text-[var(--s-accent)]" : "border-border text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {m === "paste" ? "Paste" : m === "file" ? "File upload" : "URL"}
                </button>
              ))}
            </div>

            {inputMode === "paste" && (
              <textarea
                value={rawInput}
                onChange={(e) => { setRawInput(e.target.value); setPreview(null); setParseError(null); }}
                placeholder={fmtOption.placeholder}
                className="w-full h-40 p-3 text-[11px] font-mono border rounded-lg bg-muted/30 resize-none outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
              />
            )}

            {inputMode === "file" && (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-[var(--s-accent)]/50 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileRead(f); }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-muted-foreground mb-2">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p className="text-[12px] text-muted-foreground">Drop a .json or .js file here, or click to browse</p>
                <input ref={fileRef} type="file" accept=".json,.js,.ts,.css" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileRead(f); }} />
              </div>
            )}

            {inputMode === "url" && (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://raw.githubusercontent.com/org/repo/main/tokens.json"
                  className="flex-1 px-3 py-2 text-[12px] bg-muted/40 border rounded-md focus:outline-none"
                  onKeyDown={(e) => { if (e.key === "Enter") handleUrlFetch(); }}
                />
                <button
                  onClick={handleUrlFetch}
                  disabled={loading || !urlInput.trim()}
                  className="px-3 py-2 text-[11px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 disabled:opacity-50 font-medium whitespace-nowrap"
                >
                  {loading ? "Fetching…" : "Fetch"}
                </button>
              </div>
            )}
          </div>

          {/* Parse error */}
          {parseError && (
            <div className="text-[11px] text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
              {parseError}
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold">
                  Preview — {tokenCount(preview)} token{tokenCount(preview) !== 1 ? "s" : ""} across {Object.keys(preview).length} group{Object.keys(preview).length !== 1 ? "s" : ""}
                </span>
                {conflicts.length > 0 && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400">
                    ⚠ {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""} with existing tokens
                  </span>
                )}
              </div>
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto bg-muted/20 space-y-2">
                {Object.entries(preview).map(([group, entries]) => (
                  <div key={group}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{group}</div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(entries).map(([key, entry]) => {
                        const isConflict = conflicts.includes(`${group}.${key}`);
                        return (
                          <span
                            key={key}
                            className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 border rounded ${isConflict ? "border-amber-400/50 bg-amber-50 dark:bg-amber-950/30" : "bg-background"}`}
                            title={isConflict ? "Conflicts with existing token" : undefined}
                          >
                            {group === "color" && entry.value.startsWith("#") && (
                              <span className="w-2.5 h-2.5 rounded-sm border shrink-0" style={{ background: entry.value }} />
                            )}
                            <span className="font-medium">{key}</span>
                            <span className="text-muted-foreground">{entry.value}</span>
                            {isConflict && <span className="text-amber-500">↺</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Merge/replace toggle */}
              {existingCount > 0 && (
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-muted-foreground">On import:</span>
                  {(["merge", "replace"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMergeMode(m)}
                      className={`px-2.5 py-1 rounded-full border transition-colors ${
                        mergeMode === m ? "border-[var(--s-accent)] bg-[var(--s-accent)]/10 text-[var(--s-accent)]" : "border-border text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {m === "merge" ? `Merge with ${existingCount} existing tokens` : "Replace all existing tokens"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {success && (
            <div className="text-[11px] text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-3 py-2 rounded-lg">
              Tokens imported successfully!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t bg-muted/20">
          <button onClick={onClose} className="px-3 py-1.5 text-[12px] rounded-md hover:bg-accent transition-colors">Cancel</button>
          <div className="flex items-center gap-2">
            {!preview && rawInput.trim() && (
              <button
                onClick={handlePreview}
                disabled={loading}
                className="px-3 py-1.5 text-[12px] border rounded-md hover:bg-accent transition-colors disabled:opacity-50"
              >
                Preview
              </button>
            )}
            <button
              onClick={preview ? handleImport : handlePreview}
              disabled={loading || !rawInput.trim()}
              className="px-4 py-1.5 text-[12px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 disabled:opacity-50 font-medium"
            >
              {loading ? "Importing…" : preview ? "Import tokens" : "Preview"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
