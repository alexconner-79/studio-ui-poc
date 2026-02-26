"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/studio/toast";

type ScreenEntry = {
  name: string;
  fileName: string;
  spec?: { route?: string };
};

export function ScreensPanel({
  projectId,
  currentScreen,
}: {
  projectId?: string | null;
  currentScreen?: string | null;
}) {
  const router = useRouter();
  const [screens, setScreens] = useState<ScreenEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    const url = projectId
      ? `/api/studio/screens?projectId=${encodeURIComponent(projectId)}`
      : "/api/studio/screens";
    fetch(url)
      .then((r) => r.json())
      .then((d) => { if (d.screens) setScreens(d.screens); })
      .catch(() => toast.error("Failed to load screens"))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const safeName = newName.trim().toLowerCase().replace(/[_\s]+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/^-+|-+$/g, "");
    if (!safeName) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = { name: safeName };
      if (projectId) body.projectId = projectId;
      const res = await fetch("/api/studio/screens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setNewName("");
        setShowCreate(false);
        load();
        // Navigate to the new screen
        const qs = projectId ? `?project=${projectId}` : "";
        router.push(`/studio/${safeName}${qs}`);
      } else {
        const d = await res.json();
        toast.error(d.error || "Failed to create screen");
      }
    } catch {
      toast.error("Failed to create screen");
    } finally {
      setCreating(false);
    }
  };

  const navigateTo = (screenName: string) => {
    const qs = projectId ? `?project=${projectId}` : "";
    router.push(`/studio/${screenName}${qs}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Screens</span>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors text-base leading-none"
          title="New screen"
        >
          +
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="px-2 py-2 border-b bg-muted/30 flex gap-1.5">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="screen-name"
            className="flex-1 h-6 px-2 text-[11px] bg-background border rounded outline-none focus:ring-1 focus:ring-blue-400"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="px-2 h-6 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {creating ? "..." : "Add"}
          </button>
          <button
            type="button"
            onClick={() => { setShowCreate(false); setNewName(""); }}
            className="px-1 h-6 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕
          </button>
        </form>
      )}

      {/* Screen list */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="px-3 py-4 text-[11px] text-muted-foreground text-center">Loading...</div>
        ) : screens.length === 0 ? (
          <div className="px-3 py-4 text-[11px] text-muted-foreground text-center">No screens yet</div>
        ) : (
          screens.map((s) => {
            const isActive = s.name === currentScreen;
            return (
              <button
                key={s.name}
                onClick={() => navigateTo(s.name)}
                className={`w-full flex items-center gap-2 px-3 text-[12px] transition-colors rounded-sm text-left ${
                  isActive
                    ? "bg-blue-500/15 text-blue-600 font-medium"
                    : "text-foreground hover:bg-accent"
                }`}
                style={{ minHeight: "28px" }}
              >
                {/* Page icon */}
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.5" className="flex-shrink-0 text-muted-foreground">
                  <rect x="1.5" y="1" width="8" height="9" rx="1"/>
                  <line x1="3.5" y1="4" x2="7.5" y2="4"/>
                  <line x1="3.5" y1="6.5" x2="6.5" y2="6.5"/>
                </svg>
                <span className="truncate">{s.name}</span>
                {s.spec?.route && (
                  <span className="ml-auto text-[10px] text-muted-foreground/60 truncate">{s.spec.route}</span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
