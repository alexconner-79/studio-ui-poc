"use client";

import React, { useState, useEffect, useCallback } from "react";

type TokenValue = { value: string; type: string };
type Tokens = Record<string, Record<string, TokenValue | Record<string, TokenValue>>>;

export function ThemeEditor({ onClose }: { onClose: () => void }) {
  const [tokens, setTokens] = useState<Tokens | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<string>("color");

  // Load tokens
  useEffect(() => {
    fetch("/api/studio/tokens")
      .then((r) => r.json())
      .then((d) => { setTokens(d.tokens || {}); setLoading(false); })
      .catch(() => { setError("Failed to load tokens"); setLoading(false); });
  }, []);

  const handleSave = useCallback(async () => {
    if (!tokens) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/tokens", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  }, [tokens]);

  const updateToken = useCallback(
    (category: string, key: string, value: string) => {
      setTokens((prev) => {
        if (!prev) return prev;
        const cat = { ...(prev[category] as Record<string, TokenValue>) };
        cat[key] = { ...(cat[key] as TokenValue), value };
        return { ...prev, [category]: cat };
      });
    },
    []
  );

  const updateNestedToken = useCallback(
    (category: string, subKey: string, key: string, value: string) => {
      setTokens((prev) => {
        if (!prev) return prev;
        const cat = { ...prev[category] } as Record<string, Record<string, TokenValue>>;
        const sub = { ...(cat[subKey] || {}) };
        sub[key] = { ...(sub[key] as TokenValue), value };
        cat[subKey] = sub;
        return { ...prev, [category]: cat };
      });
    },
    []
  );

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="text-muted-foreground">Loading tokens...</div>
      </div>
    );
  }

  const sections = tokens ? Object.keys(tokens) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[80vh] bg-background border rounded-lg shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold">Theme Editor</h2>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-green-600">Saved!</span>}
            {error && <span className="text-xs text-destructive">{error}</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-2">&times;</button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Section nav */}
          <div className="w-40 border-r flex-shrink-0 py-2">
            {sections.map((s) => (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`w-full text-left px-4 py-2 text-sm capitalize transition-colors ${
                  section === s ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Token editor */}
          <div className="flex-1 overflow-y-auto p-6">
            {tokens && section && tokens[section] && (
              <div className="space-y-3">
                {Object.entries(tokens[section]).map(([key, val]) => {
                  // Nested group (e.g. typography.fontFamily, typography.fontSize)
                  if (val && typeof val === "object" && !("value" in val)) {
                    return (
                      <div key={key} className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{key}</div>
                        {Object.entries(val as Record<string, TokenValue>).map(([subKey, subVal]) => (
                          <TokenRow
                            key={subKey}
                            name={subKey}
                            token={subVal}
                            onChange={(v) => updateNestedToken(section, key, subKey, v)}
                          />
                        ))}
                      </div>
                    );
                  }
                  // Flat token
                  return (
                    <TokenRow
                      key={key}
                      name={key}
                      token={val as TokenValue}
                      onChange={(v) => updateToken(section, key, v)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Token row editor
// -------------------------------------------------------------------------

function TokenRow({
  name,
  token,
  onChange,
}: {
  name: string;
  token: TokenValue;
  onChange: (value: string) => void;
}) {
  const isColor = token.type === "color" || token.value?.startsWith("#");

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-mono w-32 truncate flex-shrink-0">{name}</span>
      {isColor && (
        <input
          type="color"
          value={token.value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border cursor-pointer flex-shrink-0"
        />
      )}
      <input
        type="text"
        value={token.value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 px-2 py-1.5 text-sm border rounded bg-background font-mono"
      />
      <span className="text-[10px] text-muted-foreground w-20 truncate flex-shrink-0">{token.type}</span>
    </div>
  );
}
