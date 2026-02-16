"use client";

import React, { useState } from "react";

type Tab = "w3c" | "tailwind" | "shadcn";

const TAB_LABELS: Record<Tab, string> = {
  w3c: "W3C Tokens",
  tailwind: "Tailwind Config",
  shadcn: "shadcn Theme",
};

const PLACEHOLDERS: Record<Tab, string> = {
  w3c: `{
  "color": {
    "primary": { "$value": "#3b82f6", "$type": "color" },
    "secondary": { "$value": "#6b7280", "$type": "color" }
  }
}`,
  tailwind: `module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#6b7280',
      },
      spacing: { '18': '4.5rem' },
    },
  },
}`,
  shadcn: `:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --secondary: 210 40% 96.1%;
}`,
};

export function ImportTokensModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("w3c");
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      let data: unknown;
      if (tab === "w3c") {
        data = JSON.parse(input);
      } else {
        data = input;
      }
      const res = await fetch("/api/studio/tokens/import?preview=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: tab, data }),
      });
      const result = await res.json();
      if (result.error) {
        setError(result.error);
      } else {
        setPreview(result.tokens);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse input");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    setError(null);
    try {
      let data: unknown;
      if (tab === "w3c") {
        data = JSON.parse(input);
      } else {
        data = input;
      }
      const res = await fetch("/api/studio/tokens/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: tab, data }),
      });
      const result = await res.json();
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => onClose(), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-background border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Import Design System</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setPreview(null); setError(null); }}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Input area */}
        <div className="p-6 space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={PLACEHOLDERS[tab]}
            className="w-full h-48 p-3 text-xs font-mono border rounded-md bg-muted/30 resize-none outline-none focus:ring-1 focus:ring-blue-400"
          />

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-green-600 bg-green-50 dark:bg-green-950 px-3 py-2 rounded">
              Tokens imported successfully!
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div className="border rounded-md p-3 max-h-40 overflow-y-auto bg-muted/20">
              <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                Preview
              </div>
              {Object.entries(preview).map(([category, tokens]) => (
                <div key={category} className="mb-2">
                  <div className="text-xs font-medium text-foreground">{category}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(tokens as Record<string, { value: string }>).map(([name, token]) => (
                      <span
                        key={name}
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 border rounded bg-background"
                      >
                        {category === "color" && (
                          <span
                            className="w-3 h-3 rounded-sm border"
                            style={{ backgroundColor: token.value }}
                          />
                        )}
                        <span className="font-medium">{name}</span>
                        <span className="text-muted-foreground">{token.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handlePreview}
              disabled={!input.trim() || loading}
              className="px-4 py-2 text-sm border rounded hover:bg-accent transition-colors disabled:opacity-50"
            >
              Preview
            </button>
            <button
              onClick={handleImport}
              disabled={!input.trim() || loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? "Importing..." : "Import"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
