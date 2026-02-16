"use client";

import React, { useMemo } from "react";
import { useEditorStore } from "@/lib/studio/store";
import type { Node } from "@/lib/studio/types";

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

export type A11yIssue = {
  nodeId: string;
  severity: "error" | "warning";
  message: string;
  wcag?: string;
};

// -------------------------------------------------------------------------
// A11y checks
// -------------------------------------------------------------------------

function collectIssues(node: Node, issues: A11yIssue[], headingLevels: number[]): void {
  const props = node.props || {};

  // Image missing alt text
  if (node.type === "Image") {
    if (!props.alt || (typeof props.alt === "string" && !props.alt.trim())) {
      issues.push({
        nodeId: node.id,
        severity: "error",
        message: "Image is missing alt text",
        wcag: "1.1.1",
      });
    }
  }

  // Heading hierarchy
  if (node.type === "Heading" && props.level) {
    const level = parseInt(String(props.level).replace("h", ""), 10);
    if (!isNaN(level)) {
      if (headingLevels.length > 0) {
        const lastLevel = headingLevels[headingLevels.length - 1];
        if (level > lastLevel + 1) {
          issues.push({
            nodeId: node.id,
            severity: "warning",
            message: `Heading level gap: h${lastLevel} to h${level} (skipped h${lastLevel + 1})`,
            wcag: "1.3.1",
          });
        }
      }
      headingLevels.push(level);
    }
  }

  // Empty heading text
  if (node.type === "Heading") {
    if (!props.text || (typeof props.text === "string" && !props.text.trim())) {
      issues.push({
        nodeId: node.id,
        severity: "warning",
        message: "Heading has no text content",
        wcag: "1.3.1",
      });
    }
  }

  // Button/Link with empty label
  if (node.type === "Button") {
    if (!props.label || (typeof props.label === "string" && !props.label.trim())) {
      issues.push({
        nodeId: node.id,
        severity: "warning",
        message: "Button has no label text",
        wcag: "4.1.2",
      });
    }
  }
  if (node.type === "Link") {
    if (!props.label || (typeof props.label === "string" && !props.label.trim())) {
      issues.push({
        nodeId: node.id,
        severity: "warning",
        message: "Link has no label text",
        wcag: "2.4.4",
      });
    }
  }

  // Input without placeholder (proxy for label)
  if (node.type === "Input") {
    if (!props.placeholder || (typeof props.placeholder === "string" && !props.placeholder.trim())) {
      issues.push({
        nodeId: node.id,
        severity: "warning",
        message: "Input field has no placeholder or label",
        wcag: "1.3.1",
      });
    }
  }

  // Recurse
  if (node.children) {
    for (const child of node.children) {
      collectIssues(child, issues, headingLevels);
    }
  }
}

export function useA11yIssues(): A11yIssue[] {
  const spec = useEditorStore((s) => s.spec);
  return useMemo(() => {
    if (!spec) return [];
    const issues: A11yIssue[] = [];
    collectIssues(spec.tree, issues, []);
    return issues;
  }, [spec]);
}

// -------------------------------------------------------------------------
// A11y panel UI
// -------------------------------------------------------------------------

export function A11yPanel({ onClose }: { onClose: () => void }) {
  const issues = useA11yIssues();
  const selectNode = useEditorStore((s) => s.selectNode);

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[70vh] bg-background border rounded-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Accessibility Checker</h2>
            {issues.length === 0 ? (
              <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 px-2 py-0.5 rounded-full">
                No issues
              </span>
            ) : (
              <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 px-2 py-0.5 rounded-full">
                {issues.length} issue{issues.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            &times;
          </button>
        </div>

        {/* Issues */}
        <div className="flex-1 overflow-y-auto">
          {issues.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <p className="text-sm">All accessibility checks passed!</p>
            </div>
          )}

          {errors.length > 0 && (
            <div className="px-4 py-2">
              <div className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2">
                Errors ({errors.length})
              </div>
              {errors.map((issue, i) => (
                <IssueRow key={`e-${i}`} issue={issue} onSelect={() => { selectNode(issue.nodeId); onClose(); }} />
              ))}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="px-4 py-2">
              <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
                Warnings ({warnings.length})
              </div>
              {warnings.map((issue, i) => (
                <IssueRow key={`w-${i}`} issue={issue} onSelect={() => { selectNode(issue.nodeId); onClose(); }} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IssueRow({
  issue,
  onSelect,
}: {
  issue: A11yIssue;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left flex items-start gap-2 px-3 py-2 rounded hover:bg-accent transition-colors mb-1"
    >
      <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
        issue.severity === "error" ? "bg-destructive" : "bg-amber-500"
      }`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm">{issue.message}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground font-mono">{issue.nodeId}</span>
          {issue.wcag && (
            <span className="text-[10px] text-muted-foreground">WCAG {issue.wcag}</span>
          )}
        </div>
      </div>
    </button>
  );
}
