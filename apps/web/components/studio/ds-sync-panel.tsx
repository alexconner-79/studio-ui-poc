"use client";

import React, { useState, useCallback } from "react";
import type { TokenDiff } from "@/lib/studio/types";
import { toast } from "@/lib/studio/toast";

interface Props {
  dsId: string;
  projectId?: string | null;
  currentTokens: Record<string, unknown>;
  onSynced: (updatedTokens: Record<string, unknown>) => void;
  onClose: () => void;
}

function getPat(projectId?: string | null): string {
  if (!projectId) return "";
  try {
    const raw = localStorage.getItem(`studio-project-settings-${projectId}`);
    if (raw) return (JSON.parse(raw) as { githubPat?: string }).githubPat ?? "";
  } catch { /* ignore */ }
  return "";
}

const STATUS_DOT: Record<string, string> = {
  added: "text-green-600 dark:text-green-400",
  changed: "text-orange-500 dark:text-orange-400",
  removed: "text-red-500 dark:text-red-400",
};
const STATUS_LABEL: Record<string, string> = { added: "+", changed: "~", removed: "−" };

export function DSSyncPanel({ dsId, projectId, currentTokens, onSynced, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [diff, setDiff] = useState<TokenDiff[] | null>(null);
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  const sourceConfig = (currentTokens as Record<string, unknown>)._sourceConfig as { type?: string; scannedAt?: string } | undefined;
  const lastSynced = sourceConfig?.scannedAt
    ? new Date(sourceConfig.scannedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Never";

  const handleFetchDiff = useCallback(async () => {
    setLoading(true);
    try {
      const pat = getPat(projectId);
      const res = await fetch("/api/studio/import/codebase/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dsId, ...(pat ? { githubToken: pat } : {}) }),
      });
      const data = await res.json() as { diff?: TokenDiff[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Sync failed");
      const d = data.diff ?? [];
      setDiff(d);
      setCheckedKeys(new Set(d.map((item) => item.key)));
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [dsId, projectId]);

  const handleApply = useCallback(async () => {
    if (!diff) return;
    setApplying(true);
    try {
      const updated = { ...currentTokens };
      for (const item of diff) {
        if (!checkedKeys.has(item.key)) continue;
        const parts = item.key.split(".");
        const category = parts[0] ?? "";
        if (item.status === "removed") {
          if (updated[category] && typeof updated[category] === "object") {
            const cat = { ...(updated[category] as Record<string, unknown>) };
            delete cat[parts.slice(1).join(".")];
            updated[category] = cat;
          }
        } else {
          if (!updated[category] || typeof updated[category] !== "object") updated[category] = {};
          const cat = { ...(updated[category] as Record<string, unknown>) };
          cat[parts.slice(1).join(".")] = { value: item.newValue };
          updated[category] = cat;
        }
      }
      if (updated._sourceConfig && typeof updated._sourceConfig === "object") {
        updated._sourceConfig = { ...(updated._sourceConfig as Record<string, unknown>), scannedAt: new Date().toISOString() };
      }
      const res = await fetch(`/api/studio/design-systems/${encodeURIComponent(dsId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: updated }),
      });
      if (!res.ok) throw new Error("Failed to save changes");
      const approved = diff.filter((d) => checkedKeys.has(d.key)).length;
      toast.success(`Applied ${approved} token change${approved !== 1 ? "s" : ""}`);
      onSynced(updated);
      onClose();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setApplying(false);
    }
  }, [diff, checkedKeys, currentTokens, dsId, onSynced, onClose]);

  const grouped = diff
    ? diff.reduce<Record<string, TokenDiff[]>>((acc, d) => {
        (acc[d.category] ??= []).push(d);
        return acc;
      }, {})
    : {};

  const totalChecked = diff ? diff.filter((d) => checkedKeys.has(d.key)).length : 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Sync with codebase</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Source: <span className="font-medium">{sourceConfig?.type ?? "unknown"}</span> · Last synced: {lastSynced}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none border-none bg-transparent cursor-pointer">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!diff ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                Re-scan the source and review token changes before applying them.
              </p>
              <button
                onClick={handleFetchDiff}
                disabled={loading}
                className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg border-none cursor-pointer hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Scanning…" : "Scan for changes"}
              </button>
            </div>
          ) : diff.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10">
              <div className="text-4xl text-green-500">✓</div>
              <p className="text-sm font-medium text-foreground">Tokens are up to date</p>
              <p className="text-xs text-muted-foreground">No changes detected since last sync</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Select all / none */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCheckedKeys(new Set(diff.map((d) => d.key)))}
                  className="text-xs text-blue-600 dark:text-blue-400 border-none bg-transparent cursor-pointer hover:underline"
                >
                  Select all
                </button>
                <button
                  onClick={() => setCheckedKeys(new Set())}
                  className="text-xs text-muted-foreground border-none bg-transparent cursor-pointer hover:underline"
                >
                  None
                </button>
                <span className="ml-auto text-xs text-muted-foreground">{totalChecked} / {diff.length} selected</span>
              </div>

              {/* Grouped diff */}
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{category}</h3>
                  <div className="space-y-0.5">
                    {items.map((item) => (
                      <label
                        key={item.key}
                        className="flex items-start gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checkedKeys.has(item.key)}
                          onChange={(e) => {
                            const next = new Set(checkedKeys);
                            if (e.target.checked) next.add(item.key);
                            else next.delete(item.key);
                            setCheckedKeys(next);
                          }}
                          className="mt-0.5 shrink-0 cursor-pointer"
                        />
                        <span className={`text-xs font-bold w-3 shrink-0 ${STATUS_DOT[item.status]}`}>
                          {STATUS_LABEL[item.status]}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-mono text-foreground truncate">{item.key}</div>
                          <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                            {item.oldValue && <span className="line-through">{item.oldValue}</span>}
                            {item.newValue && <span className={STATUS_DOT[item.status]}>{item.newValue}</span>}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t shrink-0 bg-muted/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            Close
          </button>
          {diff && diff.length > 0 && (
            <button
              onClick={handleApply}
              disabled={applying || totalChecked === 0}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg border-none cursor-pointer hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {applying ? "Applying…" : `Apply ${totalChecked} change${totalChecked !== 1 ? "s" : ""}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
