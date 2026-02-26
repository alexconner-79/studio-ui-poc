"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/studio/toast";

type DesignSystem = {
  id: string;
  name: string;
  description: string | null;
  platform: "web" | "native" | "universal";
  tokens: Record<string, unknown>;
  updated_at: string;
};

const PLATFORM_LABELS: Record<string, string> = {
  web: "Web",
  native: "Mobile (RN)",
  universal: "Universal",
};

const PLATFORM_COLORS: Record<string, string> = {
  web: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  native: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  universal: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

function tokenCount(tokens: Record<string, unknown>): number {
  let count = 0;
  for (const group of Object.values(tokens)) {
    if (group && typeof group === "object" && !Array.isArray(group)) {
      count += Object.keys(group).length;
    }
  }
  return count;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Create DS Modal
// ---------------------------------------------------------------------------

function CreateDSModal({ onClose, onCreated }: { onClose: () => void; onCreated: (ds: DesignSystem) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [platform, setPlatform] = useState<"web" | "native" | "universal">("web");
  const [loading, setLoading] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/studio/design-systems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), platform }),
      });
      if (res.ok) {
        const data = await res.json() as { designSystem: DesignSystem };
        onCreated(data.designSystem);
      } else {
        const data = await res.json() as { error?: string };
        toast.error(data.error ?? "Failed to create design system");
      }
    } catch {
      toast.error("Failed to create design system");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-background border rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="text-sm font-semibold">New Design System</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Create a reusable DS for one or more projects</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Name</label>
            <input
              ref={nameRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Design System"
              className="w-full px-3 py-2 text-sm bg-muted/40 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--s-accent)]"
              required
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Description <span className="font-normal">(optional)</span></label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tokens, components, and themes for Acme products"
              className="w-full px-3 py-2 text-sm bg-muted/40 border rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--s-accent)]"
            />
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-2 block">Target Platform</label>
            <div className="grid grid-cols-3 gap-2">
              {(["web", "native", "universal"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={`py-2 px-3 rounded-md border text-[11px] font-medium transition-colors ${
                    platform === p
                      ? "border-[var(--s-accent)] bg-[var(--s-accent)]/10 text-[var(--s-accent)]"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {p === "web" && "Web"}
                  {p === "native" && "Mobile (RN)"}
                  {p === "universal" && "Universal"}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">
              {platform === "web" && "CSS units (px, rem). Compatible with Next.js, Vue, Svelte, HTML."}
              {platform === "native" && "Numeric values for React Native / Expo. No CSS unit strings."}
              {platform === "universal" && "Dual-value tokens — web and native variants resolved at emit time."}
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-1.5 text-[12px] rounded-md hover:bg-accent transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-1.5 text-[12px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity font-medium"
            >
              {loading ? "Creating…" : "Create Design System"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DesignSystemsPage() {
  const router = useRouter();
  const [systems, setSystems] = useState<DesignSystem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<"all" | "web" | "native" | "universal">("all");

  useEffect(() => {
    fetch("/api/studio/design-systems")
      .then((r) => r.json())
      .then((d: { designSystems?: DesignSystem[] }) => setSystems(d.designSystems ?? []))
      .catch(() => toast.error("Failed to load design systems"))
      .finally(() => setLoading(false));
  }, []);

  const handleCreated = (ds: DesignSystem) => {
    setShowCreate(false);
    router.push(`/studio/ds/${ds.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/studio" className="text-muted-foreground hover:text-foreground transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="10,3 5,8 10,13"/>
              </svg>
            </Link>
            <span className="text-muted-foreground">/</span>
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.22 3.22l1.42 1.42M11.36 11.36l1.42 1.42M3.22 12.78l1.42-1.42M11.36 4.64l1.42-1.42"/>
              </svg>
              <span className="text-sm font-semibold">Design Systems</span>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 transition-opacity font-medium"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
            New Design System
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-xl border bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : systems.length === 0 && !search && platformFilter === "all" ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                <circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2"/>
              </svg>
            </div>
            <h2 className="text-sm font-semibold mb-1">No design systems yet</h2>
            <p className="text-[12px] text-muted-foreground max-w-xs mb-5">
              Create a design system once and link it to any number of projects — web, mobile, or both.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 text-[12px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 transition-opacity font-medium"
            >
              Create your first Design System
            </button>
          </div>
        ) : (
          <>
            {/* Search + filter bar */}
            <div className="flex items-center gap-3 mb-5">
              <div className="relative flex-1">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="6.5" cy="6.5" r="5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/>
                </svg>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search design systems…"
                  className="w-full pl-7 pr-3 py-1.5 text-[12px] bg-muted/40 border rounded-md focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
                />
              </div>
              <div className="flex items-center gap-1">
                {(["all", "web", "native", "universal"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPlatformFilter(p)}
                    className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                      platformFilter === p
                        ? "border-[var(--s-accent)] bg-[var(--s-accent)]/10 text-[var(--s-accent)]"
                        : "border-border hover:bg-accent text-muted-foreground"
                    }`}
                  >
                    {p === "all" ? "All" : p === "native" ? "Mobile" : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            {(() => {
              const filtered = systems.filter((ds) => {
                const matchSearch = !search || ds.name.toLowerCase().includes(search.toLowerCase()) || (ds.description ?? "").toLowerCase().includes(search.toLowerCase());
                const matchPlatform = platformFilter === "all" || ds.platform === platformFilter;
                return matchSearch && matchPlatform;
              });
              if (filtered.length === 0) {
                return <p className="text-[12px] text-muted-foreground py-8 text-center">No design systems match your filters.</p>;
              }
              return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((ds) => (
                <Link
                  key={ds.id}
                  href={`/studio/ds/${ds.id}`}
                  className="group rounded-xl border bg-card hover:border-[var(--s-accent)]/50 hover:shadow-md transition-all p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-snug group-hover:text-[var(--s-accent)] transition-colors line-clamp-2">
                      {ds.name}
                    </h3>
                    <span className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${PLATFORM_COLORS[ds.platform]}`}>
                      {PLATFORM_LABELS[ds.platform]}
                    </span>
                  </div>
                  {ds.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{ds.description}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{tokenCount(ds.tokens)} tokens</span>
                    <span>Updated {timeAgo(ds.updated_at)}</span>
                  </div>
                </Link>
              ))}

              {/* Create new card */}
              <button
                onClick={() => setShowCreate(true)}
                className="rounded-xl border border-dashed border-muted-foreground/30 hover:border-[var(--s-accent)]/50 hover:bg-accent/30 transition-all p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground min-h-[120px]"
              >
                <svg width="20" height="20" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/>
                </svg>
                <span className="text-[11px] font-medium">New Design System</span>
              </button>
            </div>
              );
            })()}
          </>
        )}
      </div>

      {showCreate && <CreateDSModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
    </div>
  );
}
