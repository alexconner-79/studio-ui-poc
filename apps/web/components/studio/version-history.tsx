"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";

interface Version {
  id: string;
  spec: Record<string, unknown>;
  label: string | null;
  created_at: string;
}

interface VersionHistoryProps {
  screenName: string;
  currentSpec?: Record<string, unknown>;
  onRestore: (spec: Record<string, unknown>) => void;
  onClose: () => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─────────────────────────────────────────────────────────────
// Lightweight JSON diff engine
// ─────────────────────────────────────────────────────────────

type DiffLineType = "same" | "added" | "removed" | "changed";

interface DiffLine {
  type: DiffLineType;
  path: string;
  oldValue?: string;
  newValue?: string;
  line: string;
}

function flattenObject(obj: unknown, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  if (obj === null || obj === undefined) {
    result[prefix || "(root)"] = String(obj);
    return result;
  }
  if (typeof obj !== "object") {
    result[prefix || "(root)"] = JSON.stringify(obj);
    return result;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      result[prefix || "(root)"] = "[]";
    } else {
      obj.forEach((item, i) => {
        const key = prefix ? `${prefix}[${i}]` : `[${i}]`;
        Object.assign(result, flattenObject(item, key));
      });
    }
    return result;
  }
  const entries = Object.entries(obj as Record<string, unknown>);
  if (entries.length === 0) {
    result[prefix || "(root)"] = "{}";
  } else {
    for (const [key, val] of entries) {
      const path = prefix ? `${prefix}.${key}` : key;
      Object.assign(result, flattenObject(val, path));
    }
  }
  return result;
}

function computeDiff(oldObj: unknown, newObj: unknown): { lines: DiffLine[]; stats: { added: number; removed: number; changed: number } } {
  const oldFlat = flattenObject(oldObj);
  const newFlat = flattenObject(newObj);
  const allKeys = new Set([...Object.keys(oldFlat), ...Object.keys(newFlat)]);
  const lines: DiffLine[] = [];
  let added = 0, removed = 0, changed = 0;

  for (const key of [...allKeys].sort()) {
    const oldVal = oldFlat[key];
    const newVal = newFlat[key];

    if (oldVal === undefined) {
      lines.push({ type: "added", path: key, newValue: newVal, line: `+ ${key}: ${newVal}` });
      added++;
    } else if (newVal === undefined) {
      lines.push({ type: "removed", path: key, oldValue: oldVal, line: `- ${key}: ${oldVal}` });
      removed++;
    } else if (oldVal !== newVal) {
      lines.push({ type: "changed", path: key, oldValue: oldVal, newValue: newVal, line: `~ ${key}` });
      changed++;
    }
  }

  return { lines, stats: { added, removed, changed } };
}

// ─────────────────────────────────────────────────────────────
// Diff View component
// ─────────────────────────────────────────────────────────────

function DiffView({ oldSpec, newSpec, oldLabel, newLabel }: {
  oldSpec: Record<string, unknown>;
  newSpec: Record<string, unknown>;
  oldLabel: string;
  newLabel: string;
}) {
  const { lines, stats } = useMemo(() => computeDiff(oldSpec, newSpec), [oldSpec, newSpec]);

  if (lines.length === 0) {
    return (
      <div className="text-center py-4 text-xs text-zinc-400">
        No changes between these versions.
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 text-[10px] mb-2">
        <span className="text-green-600 dark:text-green-400">+{stats.added}</span>
        <span className="text-red-500">-{stats.removed}</span>
        <span className="text-amber-500">~{stats.changed}</span>
        <span className="text-zinc-400 ml-auto">{oldLabel} &rarr; {newLabel}</span>
      </div>
      <div className="max-h-64 overflow-y-auto rounded-md border bg-zinc-50 dark:bg-zinc-950 text-[10px] font-mono">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`px-2 py-0.5 border-b border-zinc-100 dark:border-zinc-800 ${
              line.type === "added"
                ? "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300"
                : line.type === "removed"
                ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                : "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
            }`}
          >
            {line.type === "changed" ? (
              <>
                <div className="opacity-60">- {line.path}: {line.oldValue}</div>
                <div>+ {line.path}: {line.newValue}</div>
              </>
            ) : (
              <div>{line.line}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main VersionHistory component
// ─────────────────────────────────────────────────────────────

export function VersionHistory({ screenName, currentSpec, onRestore, onClose }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [diffId, setDiffId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const loadVersions = useCallback(() => {
    setLoading(true);
    fetch(`/api/studio/versions?screenName=${encodeURIComponent(screenName)}`)
      .then((r) => r.json())
      .then((data) => {
        setVersions(data.versions ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [screenName]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  function handleRestore(version: Version) {
    if (!confirm("Restore this version? This will replace your current screen spec.")) return;
    setRestoring(true);
    onRestore(version.spec);
    setRestoring(false);
    onClose();
  }

  function getDiffTarget(index: number): { spec: Record<string, unknown>; label: string } | null {
    if (index === 0 && currentSpec) {
      return { spec: currentSpec, label: "Current" };
    }
    if (index > 0) {
      return { spec: versions[index - 1].spec, label: versions[index - 1].label ?? `v${versions.length - index + 1}` };
    }
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Slide-over panel */}
      <div className={`relative ${diffId ? "w-[520px]" : "w-80"} h-full bg-white dark:bg-zinc-900 border-l shadow-2xl flex flex-col transition-all`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
            Version History
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition-colors text-lg"
          >
            &times;
          </button>
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading ? (
            <div className="text-sm text-zinc-500 text-center py-8 animate-pulse">
              Loading versions...
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <div className="text-2xl">&#128336;</div>
              <p className="text-sm text-zinc-500">
                No versions yet. Versions are created automatically each time you save.
              </p>
            </div>
          ) : (
            versions.map((version, index) => {
              const isExpanded = previewId === version.id;
              const isDiffing = diffId === version.id;
              const diffTarget = getDiffTarget(index);

              return (
                <div
                  key={version.id}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    isExpanded
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                  }`}
                  onClick={() => {
                    setPreviewId(isExpanded ? null : version.id);
                    if (isExpanded) setDiffId(null);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        index === 0 ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-600"
                      }`} />
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {version.label ?? `Version ${versions.length - index}`}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-400">
                      {timeAgo(version.created_at)}
                    </span>
                  </div>

                  <div className="text-[10px] text-zinc-400 mt-1">
                    {new Date(version.created_at).toLocaleString()}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(version);
                        }}
                        disabled={restoring || index === 0}
                      >
                        {index === 0 ? "Current" : "Restore"}
                      </Button>
                      {diffTarget && (
                        <Button
                          size="sm"
                          variant={isDiffing ? "default" : "outline"}
                          className="text-xs h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDiffId(isDiffing ? null : version.id);
                          }}
                        >
                          {isDiffing ? "Hide Diff" : "Compare"}
                        </Button>
                      )}
                    </div>
                  )}

                  {isDiffing && diffTarget && (
                    <DiffView
                      oldSpec={version.spec}
                      newSpec={diffTarget.spec}
                      oldLabel={version.label ?? `v${versions.length - index}`}
                      newLabel={diffTarget.label}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t text-[10px] text-zinc-400 text-center">
          Up to 50 versions are retained per screen
        </div>
      </div>
    </div>
  );
}
