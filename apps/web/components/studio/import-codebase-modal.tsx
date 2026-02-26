"use client";

import React, { useState, useCallback } from "react";
import type { ScanResult, ScannedComponent, ScannedProp } from "@/lib/studio/types";
import { toast } from "@/lib/studio/toast";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type TabId = "npm" | "github" | "local";

interface ManualMapping {
  [compName: string]: Array<{ name: string; type: string }>;
}

interface Props {
  dsId: string;
  projectId?: string | null;
  existingTokens: Record<string, unknown>;
  onImported: (updatedDs: Record<string, unknown>) => void;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getPat(projectId?: string | null): string {
  if (!projectId) return "";
  try {
    const raw = localStorage.getItem(`studio-project-settings-${projectId}`);
    if (raw) return (JSON.parse(raw) as { githubPat?: string }).githubPat ?? "";
  } catch { /* ignore */ }
  return "";
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function PropRow({ prop }: { prop: ScannedProp }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs text-foreground">{prop.name}</span>
      {prop.required && <span className="text-[10px] text-destructive">*</span>}
      <span className="ml-auto text-[10px] font-mono text-muted-foreground truncate max-w-[120px]">{prop.type}</span>
    </div>
  );
}

function ComponentRow({
  comp,
  manualProps,
  onManualPropsChange,
}: {
  comp: ScannedComponent;
  manualProps: Array<{ name: string; type: string }>;
  onManualPropsChange: (props: Array<{ name: string; type: string }>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newPropName, setNewPropName] = useState("");
  const [newPropType, setNewPropType] = useState("string");
  const needsMapping = comp.needsManualMapping && manualProps.length === 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-sm font-medium text-foreground flex-1 truncate">{comp.name}</span>
        {comp.variants.length > 0 && (
          <span className="text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 px-2 py-0.5 rounded-full">
            {comp.variants.length} variants
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">{comp.props.length + manualProps.length} props</span>
        {needsMapping ? (
          <span className="text-[10px] text-orange-600 bg-orange-50 dark:bg-orange-950/40 dark:text-orange-300 px-2 py-0.5 rounded-full">needs mapping</span>
        ) : (
          <span className="text-[10px] text-green-600 bg-green-50 dark:bg-green-950/40 dark:text-green-300 px-2 py-0.5 rounded-full">resolved</span>
        )}
        <span className="text-[10px] text-muted-foreground">{expanded ? "▾" : "▸"}</span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t bg-muted/20 flex flex-col gap-2 pt-2">
          <div className="text-[10px] font-mono text-muted-foreground">{comp.importPath}</div>

          {comp.props.map((p) => <PropRow key={p.name} prop={p} />)}

          {comp.variants.length > 0 && (
            <div className="flex flex-wrap gap-1 py-1">
              {comp.variants.map((v) => (
                <span key={v} className="text-[10px] px-2 py-0.5 border rounded-full text-muted-foreground">{v}</span>
              ))}
            </div>
          )}

          {comp.needsManualMapping && (
            <div className="border-t pt-2 mt-1">
              <div className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-2">Manual prop mapping</div>
              {manualProps.map((p, i) => (
                <div key={i} className="flex items-center gap-1 mb-1">
                  <span className="text-xs text-foreground flex-1">{p.name}: {p.type}</span>
                  <button
                    onClick={() => onManualPropsChange(manualProps.filter((_, j) => j !== i))}
                    className="text-[10px] text-destructive border-none bg-transparent cursor-pointer hover:opacity-70"
                  >✕</button>
                </div>
              ))}
              <div className="flex gap-1 mt-1">
                <input
                  type="text"
                  placeholder="propName"
                  value={newPropName}
                  onChange={(e) => setNewPropName(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs border rounded bg-background text-foreground outline-none focus:border-blue-500"
                />
                <select
                  value={newPropType}
                  onChange={(e) => setNewPropType(e.target.value)}
                  className="px-1.5 py-1 text-xs border rounded bg-background text-foreground outline-none cursor-pointer"
                >
                  <option>string</option>
                  <option>number</option>
                  <option>boolean</option>
                  <option>ReactNode</option>
                </select>
                <button
                  onClick={() => {
                    if (newPropName.trim()) {
                      onManualPropsChange([...manualProps, { name: newPropName.trim(), type: newPropType }]);
                      setNewPropName("");
                    }
                  }}
                  className="px-2.5 py-1 text-xs bg-blue-600 text-white rounded border-none cursor-pointer hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: "npm", label: "npm package" },
  { id: "github", label: "GitHub repo" },
  { id: "local", label: "Local path" },
];

export function ImportCodebaseModal({ dsId, projectId, existingTokens, onImported, onClose }: Props) {
  const [tab, setTab] = useState<TabId>("npm");
  const [localPath, setLocalPath] = useState("");
  const [packageName, setPackageName] = useState("");
  const [packageVersion, setPackageVersion] = useState("latest");
  const [ownerRepo, setOwnerRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const githubPat = getPat(projectId);

  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [manualMappings, setManualMappings] = useState<ManualMapping>({});
  const [mergeMode, setMergeMode] = useState<"merge" | "replace">("merge");
  const [importing, setImporting] = useState(false);

  const existingTokenCount = Object.keys(existingTokens).filter((k) => k !== "_sourceConfig").length;
  const conflictCount = scanResult ? Object.keys(scanResult.tokens).filter((k) => k in existingTokens).length : 0;

  const canScan =
    (tab === "local" && localPath.trim().length > 0) ||
    (tab === "npm" && packageName.trim().length > 0) ||
    (tab === "github" && ownerRepo.includes("/"));

  const handleScan = useCallback(async () => {
    setScanning(true);
    setScanResult(null);
    try {
      let body: Record<string, unknown> = { type: tab };
      if (tab === "local") body.path = localPath;
      else if (tab === "npm") { body.packageName = packageName; body.packageVersion = packageVersion; }
      else if (tab === "github") {
        const [owner, repo] = ownerRepo.split("/");
        body = { type: "github", owner, repo, branch, githubToken: githubPat };
      }
      const res = await fetch("/api/studio/import/codebase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { result?: ScanResult; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Scan failed");
      setScanResult(data.result ?? null);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setScanning(false);
    }
  }, [tab, localPath, packageName, packageVersion, ownerRepo, branch, githubPat]);

  const handleImport = useCallback(async () => {
    if (!scanResult) return;
    setImporting(true);
    try {
      const components = scanResult.components.map((comp) => {
        const manual = manualMappings[comp.name] ?? [];
        if (manual.length > 0) {
          return { ...comp, props: [...comp.props, ...manual.map((p) => ({ ...p, required: false }))], needsManualMapping: false };
        }
        return comp;
      });
      const baseTokens = mergeMode === "replace" ? {} : { ...existingTokens };
      const newTokens = {
        ...baseTokens,
        ...scanResult.tokens,
        _sourceConfig: { ...scanResult.sourceConfig, scannedAt: new Date().toISOString() },
      };
      const res = await fetch(`/api/studio/design-systems/${encodeURIComponent(dsId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: newTokens, components }),
      });
      if (!res.ok) throw new Error("Failed to save to design system");
      const data = await res.json() as { designSystem: Record<string, unknown> };
      toast.success(`Imported ${components.length} components and ${Object.keys(scanResult.tokens).length} token groups`);
      onImported(data.designSystem ?? {});
      onClose();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setImporting(false);
    }
  }, [scanResult, manualMappings, mergeMode, existingTokens, dsId, onImported, onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Connect your codebase</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Import components and tokens from an existing React library</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none border-none bg-transparent cursor-pointer">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Tab bar */}
          <div className="flex gap-1 px-6 pt-4 pb-0 border-b">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setTab(id); setScanResult(null); }}
                className={`px-4 py-2 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors cursor-pointer ${
                  tab === id
                    ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-transparent"
                    : "border-transparent text-muted-foreground hover:text-foreground bg-transparent"
                }`}
                style={{ borderLeft: "none", borderRight: "none", borderTop: "none" }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="px-6 py-5 space-y-4">
            {tab === "npm" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Package name</label>
                  <input
                    type="text"
                    placeholder="e.g. @radix-ui/react-button or @company/design-system"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Version</label>
                  <input
                    type="text"
                    placeholder="latest"
                    value={packageVersion}
                    onChange={(e) => setPackageVersion(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Type declarations are fetched from unpkg.com — no installation required. Works on Vercel.
                </p>
              </>
            )}

            {tab === "github" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Repository (owner/repo)</label>
                  <input
                    type="text"
                    placeholder="e.g. shadcn-ui/ui or my-org/design-system"
                    value={ownerRepo}
                    onChange={(e) => setOwnerRepo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground placeholder:text-muted-foreground outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Branch</label>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                  />
                </div>
                {githubPat ? (
                  <p className="text-xs text-green-600 dark:text-green-400">GitHub PAT found in Project Settings</p>
                ) : (
                  <p className="text-xs text-orange-600 dark:text-orange-400">No GitHub PAT found — add one in Project Settings to scan private repos</p>
                )}
              </>
            )}

            {tab === "local" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Absolute path to component directory</label>
                  <input
                    type="text"
                    placeholder="/Users/me/projects/my-app/packages/ui/src"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground font-mono placeholder:text-muted-foreground outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Local path scanning works on your dev machine only — not available on Vercel deployments.
                </p>
              </>
            )}

            <button
              onClick={handleScan}
              disabled={scanning || !canScan}
              className="w-full py-2 text-sm font-medium bg-blue-600 text-white rounded-lg border-none cursor-pointer hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {scanning ? "Scanning…" : "Scan"}
            </button>
          </div>

          {/* Scan results */}
          {scanResult && (
            <div className="px-6 pb-6 space-y-4 border-t pt-4">
              {/* Summary chips */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg bg-muted/30">
                  <span className="text-lg font-bold text-foreground">{scanResult.components.length}</span>
                  <span className="text-xs text-muted-foreground">components</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg bg-muted/30">
                  <span className="text-lg font-bold text-foreground">{Object.keys(scanResult.tokens).length}</span>
                  <span className="text-xs text-muted-foreground">token groups</span>
                </div>
                {conflictCount > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-200 rounded-lg bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800">
                    <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{conflictCount}</span>
                    <span className="text-xs text-orange-600 dark:text-orange-400">conflicts</span>
                  </div>
                )}
                {scanResult.warnings.length > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-200 rounded-lg bg-orange-50 dark:bg-orange-950/30 dark:border-orange-800">
                    <span className="text-lg font-bold text-orange-600 dark:text-orange-400">{scanResult.warnings.length}</span>
                    <span className="text-xs text-orange-600 dark:text-orange-400">warnings</span>
                  </div>
                )}
              </div>

              {/* Warnings */}
              {scanResult.warnings.length > 0 && (
                <div className="space-y-1">
                  {scanResult.warnings.map((w, i) => (
                    <div key={i} className="flex gap-1.5 text-xs text-orange-600 dark:text-orange-400">
                      <span>⚠</span><span>{w}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Token conflict strategy */}
              {existingTokenCount > 0 && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-muted-foreground">Token conflict:</span>
                  <div className="flex gap-1">
                    {(["merge", "replace"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMergeMode(m)}
                        className={`px-2.5 py-1 text-xs rounded border cursor-pointer transition-colors ${
                          mergeMode === m
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {mergeMode === "merge" ? "New tokens overlay existing" : "All existing tokens replaced"}
                  </span>
                </div>
              )}

              {/* Component list */}
              {scanResult.components.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Components</h3>
                  <div className="space-y-1.5">
                    {scanResult.components.map((comp) => (
                      <ComponentRow
                        key={comp.name}
                        comp={comp}
                        manualProps={manualMappings[comp.name] ?? []}
                        onManualPropsChange={(props) => setManualMappings((prev) => ({ ...prev, [comp.name]: props }))}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t shrink-0 bg-muted/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!scanResult || importing || (scanResult.components.length + Object.keys(scanResult.tokens).length === 0)}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg border-none cursor-pointer hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {importing ? "Importing…" : "Import to Design System"}
          </button>
        </div>
      </div>
    </div>
  );
}
