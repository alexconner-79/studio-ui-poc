"use client";

import React, { useMemo, useState } from "react";
import { auditTokenColours, type A11yCheck } from "@/lib/studio/colour-a11y";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type TokenEntry = { value: unknown; description?: string };
type TokenGroup = Record<string, TokenEntry>;
type TokenStore = Record<string, TokenGroup>;

// ─────────────────────────────────────────────────────────────
// Rating badge
// ─────────────────────────────────────────────────────────────

function RatingBadge({ check }: { check: A11yCheck }) {
  if (check.rating.aaa) {
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">AAA</span>;
  }
  if (check.rating.aa) {
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">AA ✓</span>;
  }
  if (check.rating.aaLarge) {
    return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">AA Large</span>;
  }
  return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Fail</span>;
}

// ─────────────────────────────────────────────────────────────
// Check row
// ─────────────────────────────────────────────────────────────

function CheckRow({ check }: { check: A11yCheck }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-accent/30 transition-colors">
      {/* Colour preview */}
      <div className="flex items-center gap-1 shrink-0">
        <div
          className="w-4 h-4 rounded border border-black/10"
          style={{ background: check.fg }}
          title={check.fg}
        />
        <span className="text-[9px] text-muted-foreground">on</span>
        <div
          className="w-4 h-4 rounded border border-black/10"
          style={{ background: check.bg }}
          title={check.bg}
        />
      </div>

      {/* Label */}
      <span className="text-[11px] text-foreground flex-1 truncate">{check.label}</span>

      {/* Ratio + note */}
      <span className="text-[11px] font-mono text-muted-foreground shrink-0">{check.ratio.toFixed(1)}:1</span>
      <RatingBadge check={check} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  count,
  colour,
}: {
  title: string;
  count: number;
  colour: string;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 ${colour}`}>
      <span className="text-[11px] font-semibold">{title}</span>
      <span className="text-[10px] opacity-70">{count}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Accessibility tab
// ─────────────────────────────────────────────────────────────

export function DSAccessibilityTab({
  tokens,
}: {
  tokens: Record<string, unknown>;
}) {
  const [refreshKey, setRefreshKey] = useState(0);

  const tokenStore = tokens as TokenStore;

  const checks = useMemo(() => {
    // Suppress exhaustive-deps warning — refreshKey intentionally triggers re-run
    void refreshKey;
    return auditTokenColours(tokenStore);
  }, [tokenStore, refreshKey]);

  const failures  = checks.filter((c) => !c.rating.aaLarge);
  const warnings  = checks.filter((c) => c.rating.aaLarge && !c.rating.aa);
  const passes    = checks.filter((c) => c.rating.aa);

  const totalColours = Object.values(tokenStore).flatMap((g) =>
    Object.values(g as TokenGroup).filter((e) => {
      const v = typeof e.value === "string" ? e.value : null;
      return v && v.startsWith("#") && v.length === 7;
    })
  ).length;

  const hasTokens = totalColours > 0;

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold">Accessibility Audit</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {hasTokens
              ? `${totalColours} colour token${totalColours !== 1 ? "s" : ""} · ${checks.length} pair${checks.length !== 1 ? "s" : ""} checked against white and dark backgrounds`
              : "Add colour tokens in the Tokens tab to run accessibility checks."}
          </p>
        </div>
        {hasTokens && (
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] border rounded-md hover:bg-accent transition-colors text-muted-foreground"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 6A4 4 0 1 1 6 2" />
              <polyline points="10 2 10 6 6 6"/>
            </svg>
            Re-check
          </button>
        )}
      </div>

      {!hasTokens && (
        <div className="border border-dashed border-muted-foreground/30 rounded-xl p-10 text-center">
          <p className="text-[12px] text-muted-foreground">
            No hex colour tokens found. Add colours in the Tokens tab, then come back to audit them.
          </p>
        </div>
      )}

      {hasTokens && (
        <>
          {/* Summary pills */}
          <div className="flex items-center gap-2 mb-5">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-[11px] font-medium">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 6l3 3 5-5"/></svg>
              {passes.length} pass AA
            </div>
            {warnings.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-[11px] font-medium">
                {warnings.length} large text only
              </div>
            )}
            {failures.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-[11px] font-medium">
                {failures.length} fail
              </div>
            )}
          </div>

          {/* Results grouped by severity */}
          <div className="rounded-xl border overflow-hidden">
            {failures.length > 0 && (
              <>
                <SectionHeader title="Failures" count={failures.length} colour="bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300" />
                <div className="divide-y divide-border">
                  {failures.map((c) => <CheckRow key={c.id} check={c} />)}
                </div>
              </>
            )}
            {warnings.length > 0 && (
              <>
                <SectionHeader title="Large text only (AA+)" count={warnings.length} colour="bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-300 border-t" />
                <div className="divide-y divide-border">
                  {warnings.map((c) => <CheckRow key={c.id} check={c} />)}
                </div>
              </>
            )}
            {passes.length > 0 && (
              <>
                <SectionHeader title="Passes AA" count={passes.length} colour="bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300 border-t" />
                <div className="divide-y divide-border">
                  {passes.map((c) => <CheckRow key={c.id} check={c} />)}
                </div>
              </>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground mt-3">
            WCAG 2.1 · AA = 4.5:1 (body text) · AAA = 7:1 · AA Large = 3:1 (headings ≥ 18px or bold ≥ 14px)
          </p>
        </>
      )}
    </div>
  );
}
