"use client";

import React, { useState, useRef, useCallback } from "react";
import { parseHTML } from "@/lib/studio/html-parser";

type Tab = "file" | "code" | "html" | "figma";

type ImportResult = {
  name: string;
  status: "imported" | "error" | "skipped";
  error?: string;
};

type ImportSummary = {
  imported: number;
  errors: number;
  skipped: number;
  total: number;
};

const TAB_CONFIG: { key: Tab; label: string }[] = [
  { key: "file", label: "Spec Files" },
  { key: "code", label: "From TSX" },
  { key: "html", label: "From HTML" },
  { key: "figma", label: "From Figma" },
];

export function ImportScreenModal({
  onClose,
  onImported,
  projectId,
}: {
  onClose: () => void;
  onImported: () => void;
  projectId?: string | null;
}) {
  const [tab, setTab] = useState<Tab>("file");
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- Code tab state --
  const [codeInput, setCodeInput] = useState("");
  const [codeName, setCodeName] = useState("");
  const [codePreview, setCodePreview] = useState<Record<string, unknown> | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);

  // -- HTML tab state --
  const [htmlInput, setHtmlInput] = useState("");
  const [htmlName, setHtmlName] = useState("");
  const [htmlPreview, setHtmlPreview] = useState<Record<string, unknown> | null>(null);
  const [htmlError, setHtmlError] = useState<string | null>(null);
  const [htmlLoading, setHtmlLoading] = useState(false);
  const [htmlUpdateExisting, setHtmlUpdateExisting] = useState(false);

  // -- Code tab re-import --
  const [codeUpdateExisting, setCodeUpdateExisting] = useState(false);

  // -- Figma tab state --
  const [figmaUrl, setFigmaUrl] = useState("");
  const [figmaToken, setFigmaToken] = useState("");
  const [figmaFrames, setFigmaFrames] = useState<Array<{ id: string; name: string }>>([]);
  const [figmaSelectedFrame, setFigmaSelectedFrame] = useState<string>("");
  const [figmaPreview, setFigmaPreview] = useState<Record<string, unknown> | null>(null);
  const [figmaError, setFigmaError] = useState<string | null>(null);
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [figmaName, setFigmaName] = useState("");

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith(".json") || f.name.endsWith(".zip")
    );
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
      }
    },
    []
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleImport = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setResults(null);
    setSummary(null);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));
      if (overwrite) formData.append("overwrite", "true");
      if (projectId) formData.append("projectId", projectId);

      const res = await fetch("/api/studio/screens/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setResults(data.results ?? []);
      setSummary(data.summary ?? null);
      if (data.summary?.imported > 0) {
        onImported();
      }
    } catch {
      setResults([{ name: "unknown", status: "error", error: "Import failed" }]);
    } finally {
      setLoading(false);
    }
  };

  // -- Code tab handlers --
  const handleCodeParse = async () => {
    if (!codeInput.trim()) return;
    setCodeLoading(true);
    setCodeError(null);
    setCodePreview(null);
    try {
      const res = await fetch("/api/studio/import/tsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeInput }),
      });
      const data = await res.json();
      if (data.error) {
        setCodeError(data.error);
      } else {
        setCodePreview(data.spec);
        if (!codeName && data.spec?.route) {
          setCodeName(String(data.spec.route).replace(/^\//, "") || "imported");
        }
      }
    } catch {
      setCodeError("Failed to parse code");
    } finally {
      setCodeLoading(false);
    }
  };

  const handleCodeImport = async () => {
    if (!codePreview || !codeName.trim()) return;
    setCodeLoading(true);
    try {
      const method = codeUpdateExisting ? "PUT" : "POST";
      const url = codeUpdateExisting
        ? `/api/studio/screens/${encodeURIComponent(codeName.trim())}`
        : "/api/studio/screens";
      const body = codeUpdateExisting
        ? JSON.stringify({ spec: codePreview, ...(projectId ? { projectId } : {}) })
        : JSON.stringify({ name: codeName.trim(), spec: codePreview, ...(projectId ? { projectId } : {}) });
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) {
        onImported();
        onClose();
      } else {
        const data = await res.json();
        setCodeError(data.error || "Failed to save screen");
      }
    } catch {
      setCodeError("Import failed");
    } finally {
      setCodeLoading(false);
    }
  };

  // -- HTML tab handlers --
  const handleHtmlParse = () => {
    if (!htmlInput.trim()) return;
    setHtmlLoading(true);
    setHtmlError(null);
    setHtmlPreview(null);
    try {
      const result = parseHTML(htmlInput);
      if ("error" in result) {
        setHtmlError(result.error);
      } else {
        setHtmlPreview(result.spec);
        if (!htmlName) {
          setHtmlName("imported");
        }
      }
    } catch {
      setHtmlError("Failed to parse HTML");
    } finally {
      setHtmlLoading(false);
    }
  };

  const handleHtmlImport = async () => {
    if (!htmlPreview || !htmlName.trim()) return;
    setHtmlLoading(true);
    try {
      const method = htmlUpdateExisting ? "PUT" : "POST";
      const url = htmlUpdateExisting
        ? `/api/studio/screens/${encodeURIComponent(htmlName.trim())}`
        : "/api/studio/screens";
      const body = htmlUpdateExisting
        ? JSON.stringify({ spec: htmlPreview, ...(projectId ? { projectId } : {}) })
        : JSON.stringify({ name: htmlName.trim(), spec: htmlPreview, ...(projectId ? { projectId } : {}) });
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.ok) {
        onImported();
        onClose();
      } else {
        const data = await res.json();
        setHtmlError(data.error || "Failed to save screen");
      }
    } catch {
      setHtmlError("Import failed");
    } finally {
      setHtmlLoading(false);
    }
  };

  // -- Figma tab handlers --
  const handleFigmaFetch = async () => {
    if (!figmaUrl.trim() || !figmaToken.trim()) return;
    setFigmaLoading(true);
    setFigmaError(null);
    setFigmaFrames([]);
    setFigmaPreview(null);
    try {
      const res = await fetch("/api/studio/import/figma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileUrl: figmaUrl, accessToken: figmaToken, action: "list-frames" }),
      });
      const data = await res.json();
      if (data.error) {
        setFigmaError(data.error);
      } else {
        setFigmaFrames(data.frames ?? []);
      }
    } catch {
      setFigmaError("Failed to connect to Figma");
    } finally {
      setFigmaLoading(false);
    }
  };

  const handleFigmaImport = async () => {
    if (!figmaUrl.trim() || !figmaToken.trim()) return;
    setFigmaLoading(true);
    setFigmaError(null);
    try {
      const res = await fetch("/api/studio/import/figma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileUrl: figmaUrl,
          accessToken: figmaToken,
          nodeId: figmaSelectedFrame || undefined,
          action: "import",
        }),
      });
      const data = await res.json();
      if (data.error) {
        setFigmaError(data.error);
      } else {
        setFigmaPreview(data.spec);
        if (!figmaName && data.spec?.route) {
          setFigmaName(String(data.spec.route).replace(/^\//, "") || "figma-import");
        }
      }
    } catch {
      setFigmaError("Import failed");
    } finally {
      setFigmaLoading(false);
    }
  };

  const handleFigmaSave = async () => {
    if (!figmaPreview || !figmaName.trim()) return;
    setFigmaLoading(true);
    try {
      const res = await fetch("/api/studio/screens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: figmaName.trim(), spec: figmaPreview, ...(projectId ? { projectId } : {}) }),
      });
      if (res.ok) {
        onImported();
        onClose();
      } else {
        const data = await res.json();
        setFigmaError(data.error || "Failed to save");
      }
    } catch {
      setFigmaError("Save failed");
    } finally {
      setFigmaLoading(false);
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
          <h2 className="text-lg font-semibold">Import Screen</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {TAB_CONFIG.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6 min-h-[320px]">
          {/* ============ FILE TAB ============ */}
          {tab === "file" && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragOver
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                    : "border-border hover:border-blue-400"
                }`}
              >
                <div className="text-sm text-muted-foreground">
                  Drop <code>.screen.json</code> or <code>.zip</code> files here, or click to browse
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".json,.zip"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div className="space-y-1">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm px-2 py-1 rounded bg-muted/30">
                      <span className="flex-1 truncate font-mono text-xs">{f.name}</span>
                      <span className="text-[10px] text-muted-foreground">{(f.size / 1024).toFixed(1)}KB</span>
                      <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive">&times;</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Overwrite option */}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                Overwrite existing screens with same name
              </label>

              {/* Results */}
              {results && (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {summary && (
                    <div className="text-sm font-medium mb-2">
                      {summary.imported} imported, {summary.skipped} skipped, {summary.errors} errors
                    </div>
                  )}
                  {results.map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${
                        r.status === "imported" ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                          : r.status === "skipped" ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                          : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300"
                      }`}
                    >
                      <span>{r.status === "imported" ? "+" : r.status === "skipped" ? "~" : "x"}</span>
                      <span className="font-mono text-xs">{r.name}</span>
                      {r.error && <span className="text-[10px] ml-auto">{r.error}</span>}
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-accent">Cancel</button>
                <button
                  onClick={handleImport}
                  disabled={files.length === 0 || loading}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? "Importing..." : `Import ${files.length} file${files.length !== 1 ? "s" : ""}`}
                </button>
              </div>
            </div>
          )}

          {/* ============ CODE TAB ============ */}
          {tab === "code" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Paste a React/TSX component and we&apos;ll convert it to a Studio spec. Supports shadcn, Tailwind, and HTML elements.
              </p>
              <textarea
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder={`export default function MyPage() {\n  return (\n    <div className="flex flex-col gap-4">\n      <h1>Hello</h1>\n      <p>World</p>\n    </div>\n  );\n}`}
                className="w-full h-40 p-3 text-xs font-mono border rounded bg-muted/30 resize-none outline-none focus:ring-1 focus:ring-blue-400"
              />
              {codeError && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{codeError}</div>}
              {codePreview && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</div>
                  <pre className="text-[10px] font-mono bg-muted/30 p-3 rounded max-h-32 overflow-y-auto">
                    {JSON.stringify(codePreview, null, 2)}
                  </pre>
                  <label className="block">
                    <span className="text-sm font-medium">Screen name</span>
                    <input
                      type="text"
                      value={codeName}
                      onChange={(e) => setCodeName(e.target.value)}
                      placeholder="my-page"
                      className="mt-1 w-full px-3 py-2 text-sm border rounded bg-background"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm mt-2">
                    <input type="checkbox" checked={codeUpdateExisting} onChange={(e) => setCodeUpdateExisting(e.target.checked)} />
                    Re-import: update existing screen (overwrite)
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCodeParse}
                  disabled={!codeInput.trim() || codeLoading}
                  className="px-4 py-2 text-sm border rounded hover:bg-accent disabled:opacity-50"
                >
                  {codeLoading ? "Parsing..." : "Parse"}
                </button>
                {codePreview && (
                  <button
                    onClick={handleCodeImport}
                    disabled={!codeName.trim() || codeLoading}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {codeUpdateExisting ? "Re-import (Update)" : "Import"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ============ HTML TAB ============ */}
          {tab === "html" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Paste plain HTML and we&apos;ll convert it to a Studio spec. Supports inline styles and semantic HTML elements.
              </p>
              <textarea
                value={htmlInput}
                onChange={(e) => setHtmlInput(e.target.value)}
                placeholder={`<div style="display: flex; flex-direction: column; gap: 16px;">\n  <h1>Hello World</h1>\n  <p>This is a paragraph.</p>\n  <button>Click me</button>\n</div>`}
                className="w-full h-40 p-3 text-xs font-mono border rounded bg-muted/30 resize-none outline-none focus:ring-1 focus:ring-blue-400"
              />
              {htmlError && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{htmlError}</div>}
              {htmlPreview && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</div>
                  <pre className="text-[10px] font-mono bg-muted/30 p-3 rounded max-h-32 overflow-y-auto">
                    {JSON.stringify(htmlPreview, null, 2)}
                  </pre>
                  <label className="block">
                    <span className="text-sm font-medium">Screen name</span>
                    <input
                      type="text"
                      value={htmlName}
                      onChange={(e) => setHtmlName(e.target.value)}
                      placeholder="my-page"
                      className="mt-1 w-full px-3 py-2 text-sm border rounded bg-background"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm mt-2">
                    <input type="checkbox" checked={htmlUpdateExisting} onChange={(e) => setHtmlUpdateExisting(e.target.checked)} />
                    Re-import: update existing screen (overwrite)
                  </label>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleHtmlParse}
                  disabled={!htmlInput.trim() || htmlLoading}
                  className="px-4 py-2 text-sm border rounded hover:bg-accent disabled:opacity-50"
                >
                  {htmlLoading ? "Parsing..." : "Parse"}
                </button>
                {htmlPreview && (
                  <button
                    onClick={handleHtmlImport}
                    disabled={!htmlName.trim() || htmlLoading}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {htmlUpdateExisting ? "Re-import (Update)" : "Import"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ============ FIGMA TAB ============ */}
          {tab === "figma" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Import a Figma file by providing the file URL and your Personal Access Token. Works best with auto-layout frames.
              </p>
              <input
                type="text"
                value={figmaUrl}
                onChange={(e) => setFigmaUrl(e.target.value)}
                placeholder="https://www.figma.com/file/XXXXX/..."
                className="w-full px-3 py-2 text-sm border rounded bg-background"
              />
              <input
                type="password"
                value={figmaToken}
                onChange={(e) => setFigmaToken(e.target.value)}
                placeholder="Figma Personal Access Token"
                className="w-full px-3 py-2 text-sm border rounded bg-background"
              />
              {figmaError && <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{figmaError}</div>}

              {figmaFrames.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Select a frame (optional)</div>
                  <select
                    value={figmaSelectedFrame}
                    onChange={(e) => setFigmaSelectedFrame(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded bg-background"
                  >
                    <option value="">All top-level frames</option>
                    {figmaFrames.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {figmaPreview && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preview</div>
                  <pre className="text-[10px] font-mono bg-muted/30 p-3 rounded max-h-32 overflow-y-auto">
                    {JSON.stringify(figmaPreview, null, 2)}
                  </pre>
                  <label className="block">
                    <span className="text-sm font-medium">Screen name</span>
                    <input
                      type="text"
                      value={figmaName}
                      onChange={(e) => setFigmaName(e.target.value)}
                      placeholder="figma-import"
                      className="mt-1 w-full px-3 py-2 text-sm border rounded bg-background"
                    />
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2">
                {!figmaPreview && (
                  <>
                    <button
                      onClick={handleFigmaFetch}
                      disabled={!figmaUrl.trim() || !figmaToken.trim() || figmaLoading}
                      className="px-4 py-2 text-sm border rounded hover:bg-accent disabled:opacity-50"
                    >
                      {figmaLoading ? "Connecting..." : "List Frames"}
                    </button>
                    <button
                      onClick={handleFigmaImport}
                      disabled={!figmaUrl.trim() || !figmaToken.trim() || figmaLoading}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {figmaLoading ? "Importing..." : "Import"}
                    </button>
                  </>
                )}
                {figmaPreview && (
                  <button
                    onClick={handleFigmaSave}
                    disabled={!figmaName.trim() || figmaLoading}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    Save Screen
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
