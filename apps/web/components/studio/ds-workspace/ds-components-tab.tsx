"use client";

import React, { useState, useCallback, useMemo } from "react";
import { LiveNode } from "@/components/studio/live-node";
import { toast } from "@/lib/studio/toast";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type PropType = "string" | "number" | "boolean" | "enum" | "icon" | "node";

interface ComponentProp {
  name: string;
  type: PropType;
  default?: string | number | boolean;
  options?: string[];
  description?: string;
}

interface VariantGroup {
  name: string;
  options: string[];
  default: string;
}

type ComponentState = "default" | "hover" | "pressed" | "focus" | "disabled";

interface TemplateNode {
  id: string;
  type: string;
  props: Record<string, string | number | boolean>;
  children: TemplateNode[];
}

interface ComponentDef {
  name: string;
  description?: string;
  importPath?: string;
  variants: VariantGroup[];
  states: ComponentState[];
  props: ComponentProp[];
  defaultTemplate?: { type: string; props: Record<string, unknown>; children: TemplateNode[] } | null;
}

type ComponentStore = Record<string, ComponentDef>;

const ALL_STATES: ComponentState[] = ["default", "hover", "pressed", "focus", "disabled"];

function tplId() {
  return Math.random().toString(36).slice(2, 9);
}

// ─────────────────────────────────────────────────────────────
// Category map
// ─────────────────────────────────────────────────────────────

const CATEGORIES: Record<string, string[]> = {
  "Form & Input": [
    "button","input","textarea","select","checkbox","radiogroup","radio","radiobutton",
    "switch","toggle","slider","label","form","inputnumber","inputotp","rating","rate",
    "autocomplete","cascader","datepicker","timepicker","upload","transfer","colorpicker",
  ],
  "Feedback & Overlay": [
    "alert","alertdialog","dialog","modal","drawer","sheet","toast","snackbar","notification",
    "message","tooltip","popover","popconfirm","progress","progressbar","progressview",
    "skeleton","spinner","activityindicator","circularprogress","linearprogress","spin",
    "result","empty","banner","portal",
  ],
  "Navigation": [
    "tabs","tabview","tabbar","navigationmenu","breadcrumb","breadcrumbs","pagination",
    "dropdownmenu","contextmenu","command","menubar","menu","appbar","navbar","header",
    "bottomnavigation","navigationdrawer","navigationstack","sidebar","stepper","steps",
    "speeddial","dropdown",
  ],
  "Data Display": [
    "table","datatable","flatlist","sectionlist","list","card","badge","avatar","tag","chip",
    "stat","statistic","timeline","hovercard","image","descriptions","avatargroup","icon",
  ],
  "Layout": [
    "accordion","collapsible","collapse","divider","separator","skeleton","scrollarea",
    "togglegroup","resizablepanelgroup","aspectratio","carousel","surface","safeareaview",
    "keyboardavoidingview","container","grid","stack","spacer","fab","iconbutton","searchbar",
  ],
};

function getCategory(name: string): string {
  const key = name.toLowerCase().replace(/[^a-z]/g, "");
  for (const [cat, names] of Object.entries(CATEGORIES)) {
    if (names.includes(key)) return cat;
  }
  return "Other";
}

// ─────────────────────────────────────────────────────────────
// Token CSS variable builder
// ─────────────────────────────────────────────────────────────

function buildCssVars(tokens: Record<string, unknown>): string {
  const lines: string[] = [];
  function recurse(obj: unknown, prefix: string) {
    if (!obj || typeof obj !== "object") return;
    const rec = obj as Record<string, unknown>;
    if ("value" in rec && typeof rec.value === "string") {
      lines.push(`--${prefix}: ${rec.value};`);
      return;
    }
    for (const [k, v] of Object.entries(rec)) {
      recurse(v, prefix ? `${prefix}-${k}` : k);
    }
  }
  recurse(tokens, "");
  return lines.join(" ");
}

// ─────────────────────────────────────────────────────────────
// Component Preview
// ─────────────────────────────────────────────────────────────

type PreviewState = ComponentState;

interface PreviewProps {
  def: ComponentDef;
  tokens: Record<string, unknown>;
  selectedVariants: Record<string, string>;
  previewState: PreviewState;
  bg: "white" | "grey" | "dark";
}

function ButtonPreview({ variant, state }: { variant: string; state: PreviewState }) {
  const isOutline = ["outlined", "outline", "secondary", "tonal"].includes(variant);
  const isGhost = ["ghost", "text", "link", "plain"].includes(variant);
  const isDestructive = ["destructive", "danger", "error"].includes(variant);
  const disabled = state === "disabled";

  let bg = "var(--color-primary, #6d28d9)";
  let color = "#fff";
  let border = "none";

  if (isDestructive) { bg = "var(--color-destructive, #ef4444)"; }
  if (isOutline) { bg = "transparent"; color = "var(--color-primary, #6d28d9)"; border = "1.5px solid var(--color-primary, #6d28d9)"; }
  if (isGhost) { bg = "transparent"; color = "var(--color-primary, #6d28d9)"; border = "none"; }
  if (disabled) { bg = "var(--color-muted, #e4e4e7)"; color = "var(--color-muted-foreground, #71717a)"; border = "none"; }

  return (
    <button
      style={{
        background: bg, color, border,
        padding: "8px 18px",
        borderRadius: "var(--radius-md, 8px)",
        fontSize: "13px", fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : state === "hover" ? 0.85 : 1,
        outline: state === "focus" ? "2px solid var(--color-ring, #6d28d9)" : "none",
        outlineOffset: "2px",
        boxShadow: state === "focus" ? "0 0 0 3px var(--color-ring,#6d28d9)33" : "none",
      }}
    >
      Button
    </button>
  );
}

function InputPreview({ variant, state }: { variant: string; state: PreviewState }) {
  const isError = variant === "error" || state === "disabled";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, width: 220 }}>
      <label style={{ fontSize: 11, color: "var(--color-foreground,#09090b)", fontWeight: 500 }}>Label</label>
      <input
        readOnly
        value={state === "disabled" ? "" : "Placeholder text"}
        placeholder="Placeholder text"
        disabled={state === "disabled"}
        style={{
          padding: "8px 12px", fontSize: 13,
          border: `1.5px solid ${isError ? "var(--color-destructive,#ef4444)" : state === "focus" ? "var(--color-ring,#6d28d9)" : "var(--color-border,#e4e4e7)"}`,
          borderRadius: "var(--radius-md,8px)",
          outline: state === "focus" ? "2px solid var(--color-ring,#6d28d9)33" : "none",
          background: state === "disabled" ? "var(--color-muted,#f4f4f5)" : "var(--color-background,#fff)",
          color: "var(--color-foreground,#09090b)",
          cursor: state === "disabled" ? "not-allowed" : "text",
        }}
      />
      {isError && <span style={{ fontSize: 10, color: "var(--color-destructive,#ef4444)" }}>Error message</span>}
    </div>
  );
}

function CheckboxPreview({ state }: { state: PreviewState }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 18, height: 18, borderRadius: 4,
        background: state === "disabled" ? "var(--color-muted,#f4f4f5)" : "var(--color-primary,#6d28d9)",
        border: `1.5px solid ${state === "disabled" ? "var(--color-border,#e4e4e7)" : "var(--color-primary,#6d28d9)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: state === "disabled" ? 0.5 : 1,
        outline: state === "focus" ? "2px solid var(--color-ring,#6d28d9)44" : "none",
      }}>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2,6 5,9 10,3"/>
        </svg>
      </div>
      <span style={{ fontSize: 13, color: state === "disabled" ? "var(--color-muted-foreground,#71717a)" : "var(--color-foreground,#09090b)" }}>
        Checkbox label
      </span>
    </div>
  );
}

function RadioPreview({ state }: { state: PreviewState }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {["Option A", "Option B", "Option C"].map((label, i) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 18, height: 18, borderRadius: "50%",
            border: `2px solid ${i === 0 && state !== "disabled" ? "var(--color-primary,#6d28d9)" : "var(--color-border,#e4e4e7)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            opacity: state === "disabled" ? 0.5 : 1,
          }}>
            {i === 0 && (
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-primary,#6d28d9)" }} />
            )}
          </div>
          <span style={{ fontSize: 13, color: "var(--color-foreground,#09090b)" }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function SwitchPreview({ state }: { state: PreviewState }) {
  const on = state !== "disabled";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 44, height: 24, borderRadius: 12,
        background: on ? "var(--color-primary,#6d28d9)" : "var(--color-muted,#e4e4e7)",
        position: "relative", transition: "background 0.2s",
        opacity: state === "disabled" ? 0.5 : 1,
        outline: state === "focus" ? "2px solid var(--color-ring,#6d28d9)44" : "none",
      }}>
        <div style={{
          position: "absolute", top: 3, left: on ? 23 : 3,
          width: 18, height: 18, borderRadius: "50%", background: "#fff",
          transition: "left 0.2s", boxShadow: "0 1px 3px #0002",
        }} />
      </div>
      <span style={{ fontSize: 13, color: "var(--color-foreground,#09090b)" }}>Toggle</span>
    </div>
  );
}

function SliderPreview({ state }: { state: PreviewState }) {
  return (
    <div style={{ width: 220, position: "relative" }}>
      <div style={{ height: 6, borderRadius: 3, background: "var(--color-muted,#e4e4e7)", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "65%", borderRadius: 3, background: state === "disabled" ? "var(--color-muted-foreground,#a1a1aa)" : "var(--color-primary,#6d28d9)" }} />
        <div style={{
          position: "absolute", top: "50%", left: "65%", transform: "translate(-50%,-50%)",
          width: 18, height: 18, borderRadius: "50%", background: "#fff",
          border: `2px solid ${state === "disabled" ? "var(--color-muted-foreground,#a1a1aa)" : "var(--color-primary,#6d28d9)"}`,
          boxShadow: state === "focus" ? "0 0 0 3px var(--color-ring,#6d28d9)33" : "0 1px 3px #0002",
          opacity: state === "disabled" ? 0.5 : 1,
        }} />
      </div>
    </div>
  );
}

function BadgePreview({ variant, state }: { variant: string; state: PreviewState }) {
  const colorMap: Record<string, [string, string]> = {
    default:     ["var(--color-primary,#6d28d9)", "#fff"],
    secondary:   ["var(--color-secondary,#f4f4f5)", "var(--color-foreground,#09090b)"],
    destructive: ["var(--color-destructive,#ef4444)", "#fff"],
    success:     ["#22c55e", "#fff"],
    warning:     ["#f59e0b", "#fff"],
    outline:     ["transparent", "var(--color-foreground,#09090b)"],
    processing:  ["#3b82f6", "#fff"],
    error:       ["var(--color-destructive,#ef4444)", "#fff"],
  };
  const [bg, fg] = colorMap[variant] ?? colorMap.default;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: bg, color: fg,
      border: variant === "outline" ? "1.5px solid var(--color-border,#e4e4e7)" : "none",
      opacity: state === "disabled" ? 0.5 : 1,
    }}>
      Badge
    </span>
  );
}

function AlertPreview({ variant, state }: { variant: string; state: PreviewState }) {
  const typeMap: Record<string, [string, string, string]> = {
    info:        ["#eff6ff", "#2563eb", "ℹ"],
    success:     ["#f0fdf4", "#16a34a", "✓"],
    warning:     ["#fffbeb", "#d97706", "⚠"],
    error:       ["#fef2f2", "#dc2626", "✕"],
    destructive: ["#fef2f2", "#dc2626", "✕"],
    default:     ["var(--color-muted,#f4f4f5)", "var(--color-foreground,#09090b)", "ℹ"],
  };
  const [bg, fg, icon] = typeMap[variant] ?? typeMap.default;
  return (
    <div style={{
      padding: "12px 14px", borderRadius: "var(--radius-lg,8px)",
      background: bg, border: `1px solid ${fg}33`,
      display: "flex", gap: 10, alignItems: "flex-start",
      maxWidth: 280, opacity: state === "disabled" ? 0.5 : 1,
    }}>
      <span style={{ fontSize: 14, color: fg, marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: fg }}>Alert title</div>
        <div style={{ fontSize: 11, color: fg, opacity: 0.8, marginTop: 2 }}>This is the alert description.</div>
      </div>
    </div>
  );
}

function ProgressPreview({ variant, state }: { variant: string; state: PreviewState }) {
  const isCircle = ["circle","circular","dashboard"].includes(variant);
  if (isCircle) {
    const r = 28; const cx = 36; const cy = 36; const circ = 2 * Math.PI * r;
    const pct = 0.65;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <svg width={72} height={72}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-muted,#e4e4e7)" strokeWidth={6} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-primary,#6d28d9)" strokeWidth={6}
            strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
            strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
            style={{ opacity: state === "disabled" ? 0.4 : 1 }} />
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--color-foreground,#09090b)">65%</text>
        </svg>
      </div>
    );
  }
  return (
    <div style={{ width: 220 }}>
      <div style={{ height: 8, borderRadius: 4, background: "var(--color-muted,#e4e4e7)" }}>
        <div style={{
          height: "100%", width: "65%", borderRadius: 4,
          background: state === "disabled" ? "var(--color-muted-foreground,#a1a1aa)" : "var(--color-primary,#6d28d9)",
        }} />
      </div>
      <div style={{ fontSize: 10, color: "var(--color-muted-foreground,#71717a)", marginTop: 4 }}>65%</div>
    </div>
  );
}

function SkeletonPreview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 220 }}>
      <div style={{ height: 12, borderRadius: 6, background: "var(--color-muted,#e4e4e7)", width: "100%", animation: "pulse 1.5s infinite" }} />
      <div style={{ height: 12, borderRadius: 6, background: "var(--color-muted,#e4e4e7)", width: "80%" }} />
      <div style={{ height: 12, borderRadius: 6, background: "var(--color-muted,#e4e4e7)", width: "60%" }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}

function SpinnerPreview({ state }: { state: PreviewState }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width={32} height={32} viewBox="0 0 32 32" style={{ animation: state === "disabled" ? "none" : "spin 1s linear infinite" }}>
        <circle cx={16} cy={16} r={12} fill="none" stroke="var(--color-muted,#e4e4e7)" strokeWidth={3} />
        <path d="M16 4 A12 12 0 0 1 28 16" fill="none" stroke="var(--color-primary,#6d28d9)" strokeWidth={3} strokeLinecap="round" />
        <style>{`@keyframes spin { from{transform-origin:50% 50%;transform:rotate(0deg)} to{transform-origin:50% 50%;transform:rotate(360deg)} }`}</style>
      </svg>
      <span style={{ fontSize: 12, color: "var(--color-muted-foreground,#71717a)" }}>Loading…</span>
    </div>
  );
}

function AvatarPreview({ variant, state }: { variant: string; state: PreviewState }) {
  const isSquare = ["square","rounded"].includes(variant);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {["lg","md","sm"].map((sz) => {
        const size = sz === "lg" ? 48 : sz === "md" ? 36 : 24;
        return (
          <div key={sz} style={{
            width: size, height: size,
            borderRadius: isSquare ? "var(--radius-md,8px)" : "50%",
            background: "var(--color-primary,#6d28d9)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontSize: size * 0.35, fontWeight: 700,
            opacity: state === "disabled" ? 0.4 : 1,
          }}>
            AB
          </div>
        );
      })}
    </div>
  );
}

function CardPreview({ variant, state }: { variant: string; state: PreviewState }) {
  const elevated = variant === "elevated" || variant === "raised";
  return (
    <div style={{
      width: 240, padding: "14px 16px",
      borderRadius: "var(--radius-lg,12px)",
      background: "var(--color-card,var(--color-background,#fff))",
      border: variant === "outlined" || variant === "outlined" ? "1.5px solid var(--color-border,#e4e4e7)" : "1px solid var(--color-border,#e4e4e7)",
      boxShadow: elevated ? "0 2px 8px #0001, 0 1px 3px #0001" : "none",
      opacity: state === "disabled" ? 0.5 : 1,
      transform: state === "hover" ? "translateY(-1px)" : "none",
      transition: "transform 0.15s",
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-foreground,#09090b)", marginBottom: 4 }}>Card title</div>
      <div style={{ fontSize: 11, color: "var(--color-muted-foreground,#71717a)", marginBottom: 10 }}>Subtitle or description text</div>
      <div style={{ fontSize: 12, color: "var(--color-foreground,#09090b)" }}>Card body content goes here.</div>
    </div>
  );
}

function TabsPreview({ variant, state }: { variant: string; state: PreviewState }) {
  const isCard = variant === "card";
  return (
    <div style={{ width: 280 }}>
      <div style={{ display: "flex", borderBottom: isCard ? "none" : "1px solid var(--color-border,#e4e4e7)", gap: isCard ? 4 : 0 }}>
        {["Overview", "Settings", "Billing"].map((tab, i) => (
          <div key={tab} style={{
            padding: "8px 14px", fontSize: 12, fontWeight: i === 0 ? 600 : 400, cursor: "pointer",
            color: i === 0 ? "var(--color-primary,#6d28d9)" : "var(--color-muted-foreground,#71717a)",
            borderBottom: !isCard && i === 0 ? "2px solid var(--color-primary,#6d28d9)" : isCard ? "none" : "2px solid transparent",
            background: isCard && i === 0 ? "var(--color-background,#fff)" : isCard ? "var(--color-muted,#f4f4f5)" : "transparent",
            borderRadius: isCard ? "var(--radius-md,8px) var(--radius-md,8px) 0 0" : 0,
            opacity: state === "disabled" && i > 0 ? 0.4 : 1,
          }}>
            {tab}
          </div>
        ))}
      </div>
      <div style={{ padding: "10px 0", fontSize: 11, color: "var(--color-muted-foreground,#71717a)" }}>Tab content panel</div>
    </div>
  );
}

function BreadcrumbPreview() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
      {["Home", "Products", "Category"].map((item, i) => (
        <React.Fragment key={item}>
          {i > 0 && <span style={{ color: "var(--color-muted-foreground,#71717a)" }}>/</span>}
          <span style={{ color: i < 2 ? "var(--color-primary,#6d28d9)" : "var(--color-foreground,#09090b)", cursor: i < 2 ? "pointer" : "default" }}>{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

function PaginationPreview({ state }: { state: PreviewState }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {["‹", "1", "2", "3", "…", "8", "›"].map((p, i) => (
        <div key={i} style={{
          width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
          borderRadius: "var(--radius-md,8px)", fontSize: 12, cursor: "pointer",
          background: i === 2 ? "var(--color-primary,#6d28d9)" : "transparent",
          color: i === 2 ? "#fff" : "var(--color-foreground,#09090b)",
          border: i === 2 ? "none" : "1px solid var(--color-border,#e4e4e7)",
          opacity: state === "disabled" ? 0.4 : (p === "‹" || p === "1") ? 0.4 : 1,
        }}>{p}</div>
      ))}
    </div>
  );
}

function TablePreview() {
  return (
    <div style={{ width: 280, fontSize: 11, borderRadius: "var(--radius-md,8px)", overflow: "hidden", border: "1px solid var(--color-border,#e4e4e7)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", background: "var(--color-muted,#f4f4f5)" }}>
        {["Name", "Status", "Amount"].map((h) => (
          <div key={h} style={{ padding: "7px 10px", fontWeight: 600, color: "var(--color-foreground,#09090b)", borderBottom: "1px solid var(--color-border,#e4e4e7)" }}>{h}</div>
        ))}
      </div>
      {[["Alice", "Active", "$120"],["Bob", "Pending", "$80"],["Carol", "Done", "$200"]].map(([n, s, a], i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: i > 0 ? "1px solid var(--color-border,#e4e4e7)" : "none" }}>
          {[n, s, a].map((cell, j) => (
            <div key={j} style={{ padding: "7px 10px", color: "var(--color-foreground,#09090b)" }}>{cell}</div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ListPreview() {
  return (
    <div style={{ width: 240, borderRadius: "var(--radius-md,8px)", overflow: "hidden", border: "1px solid var(--color-border,#e4e4e7)" }}>
      {["Alice Johnson", "Bob Smith", "Carol Williams"].map((name, i) => (
        <div key={name} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
          borderTop: i > 0 ? "1px solid var(--color-border,#e4e4e7)" : "none",
        }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--color-primary,#6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 700 }}>
            {name[0]}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-foreground,#09090b)" }}>{name}</div>
            <div style={{ fontSize: 10, color: "var(--color-muted-foreground,#71717a)" }}>user@example.com</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SelectPreview({ state }: { state: PreviewState }) {
  return (
    <div style={{ width: 200, position: "relative" }}>
      <div style={{
        padding: "8px 12px", fontSize: 13,
        border: `1.5px solid ${state === "focus" ? "var(--color-ring,#6d28d9)" : "var(--color-border,#e4e4e7)"}`,
        borderRadius: "var(--radius-md,8px)",
        background: state === "disabled" ? "var(--color-muted,#f4f4f5)" : "var(--color-background,#fff)",
        color: "var(--color-muted-foreground,#71717a)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        opacity: state === "disabled" ? 0.6 : 1,
      }}>
        <span>Select option…</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="2,4 6,8 10,4"/></svg>
      </div>
    </div>
  );
}

function TextareaPreview({ state }: { state: PreviewState }) {
  return (
    <textarea
      readOnly
      placeholder="Enter text…"
      disabled={state === "disabled"}
      style={{
        width: 220, height: 80, padding: "8px 12px", fontSize: 12, resize: "none",
        border: `1.5px solid ${state === "focus" ? "var(--color-ring,#6d28d9)" : "var(--color-border,#e4e4e7)"}`,
        borderRadius: "var(--radius-md,8px)",
        background: state === "disabled" ? "var(--color-muted,#f4f4f5)" : "var(--color-background,#fff)",
        color: "var(--color-foreground,#09090b)",
        outline: "none",
      }}
    />
  );
}

function ModalPreview() {
  return (
    <div style={{ width: 260, borderRadius: "var(--radius-xl,16px)", overflow: "hidden", border: "1px solid var(--color-border,#e4e4e7)", boxShadow: "0 8px 24px #0003" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--color-border,#e4e4e7)" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-foreground,#09090b)" }}>Dialog title</div>
      </div>
      <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--color-muted-foreground,#71717a)" }}>Dialog content and description text goes here.</div>
      <div style={{ padding: "10px 16px", borderTop: "1px solid var(--color-border,#e4e4e7)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <div style={{ padding: "6px 12px", fontSize: 11, borderRadius: "var(--radius-md,8px)", border: "1px solid var(--color-border,#e4e4e7)", cursor: "pointer", color: "var(--color-foreground,#09090b)" }}>Cancel</div>
        <div style={{ padding: "6px 12px", fontSize: 11, borderRadius: "var(--radius-md,8px)", background: "var(--color-primary,#6d28d9)", color: "#fff", cursor: "pointer" }}>Confirm</div>
      </div>
    </div>
  );
}

function DrawerPreview() {
  return (
    <div style={{ display: "flex", gap: 0, width: 280, height: 160, borderRadius: "var(--radius-lg,12px)", overflow: "hidden", border: "1px solid var(--color-border,#e4e4e7)" }}>
      <div style={{ flex: 1, background: "var(--color-muted,#f4f4f5)", opacity: 0.5 }} />
      <div style={{ width: 180, background: "var(--color-background,#fff)", borderLeft: "1px solid var(--color-border,#e4e4e7)", padding: "12px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--color-foreground,#09090b)" }}>Drawer title</div>
        <div style={{ fontSize: 11, color: "var(--color-muted-foreground,#71717a)" }}>Drawer content area</div>
      </div>
    </div>
  );
}

function TooltipPreview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{
        padding: "5px 10px", borderRadius: "var(--radius-md,8px)",
        background: "var(--color-foreground,#09090b)", color: "#fff", fontSize: 11,
        boxShadow: "0 2px 8px #0002",
      }}>Tooltip content</div>
      <div style={{ width: 6, height: 6, background: "var(--color-foreground,#09090b)", transform: "rotate(45deg)", marginTop: -8 }} />
      <div style={{ padding: "6px 12px", borderRadius: "var(--radius-md,8px)", border: "1px solid var(--color-border,#e4e4e7)", fontSize: 12, color: "var(--color-foreground,#09090b)" }}>Hover target</div>
    </div>
  );
}

function FABPreview({ state }: { state: PreviewState }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
      <div style={{
        width: 56, height: 56, borderRadius: "var(--radius-xl,16px)",
        background: "var(--color-primary,#6d28d9)", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 12px #0003",
        opacity: state === "disabled" ? 0.4 : 1,
        fontSize: 22,
      }}>+</div>
      <div style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderRadius: 28, background: "var(--color-primary,#6d28d9)", color: "#fff", gap: 8, boxShadow: "0 4px 12px #0003", fontSize: 13, fontWeight: 500, opacity: state === "disabled" ? 0.4 : 1 }}>
        <span>+</span> Create
      </div>
    </div>
  );
}

function GenericPreview({ name }: { name: string }) {
  return (
    <div style={{
      width: 200, height: 80, borderRadius: "var(--radius-lg,12px)",
      border: "2px dashed var(--color-border,#e4e4e7)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--color-muted-foreground,#71717a)", fontSize: 12,
    }}>
      {name}
    </div>
  );
}

/** Catches render errors from components that require a parent context (e.g. ResizablePanel). */
class PreviewErrorBoundary extends React.Component<
  { children: React.ReactNode; name: string },
  { error: string | null }
> {
  constructor(props: { children: React.ReactNode; name: string }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
          <p className="text-xs font-medium text-muted-foreground">{this.props.name}</p>
          <p className="text-[10px] text-muted-foreground/50">Must be placed inside its parent component</p>
        </div>
      );
    }
    return this.props.children;
  }
}

// Props that make a component "controlled" — if passed as static values with no
// change handler, the component locks and can't be interacted with in the preview.
const CONTROLLED_STATE_PROPS = new Set(["checked", "value", "pressed", "selected", "indeterminate"]);

// Overlay components should always be forced closed so they don't block the preview.
const OVERLAY_COMPONENTS = new Set(["Dialog","Sheet","Popover","Tooltip","HoverCard","DropdownMenu","ContextMenu","AlertDialog","Command","Menubar","Drawer"]);

/**
 * Build a clean props object for a component preview. Applies all known
 * Radix/shadcn-specific coercions in one place so no scattered per-component
 * patches are needed elsewhere.
 */
function normalizePreviewProps(
  def: ComponentDef,
  selectedVariants: Record<string, string>
): Record<string, unknown> {
  const base: Record<string, unknown> = {};

  for (const prop of def.props ?? []) {
    if (prop.default !== undefined && !CONTROLLED_STATE_PROPS.has(prop.name)) {
      base[prop.name] = prop.default;
    }
  }

  // Radix Slider expects number[] — coerce a bare number just in case the
  // token definition ever stores it as a scalar.
  if (def.name === "Slider" && typeof base.defaultValue === "number") {
    base.defaultValue = [base.defaultValue as number];
  }

  if (OVERLAY_COMPONENTS.has(def.name)) base.open = false;

  Object.assign(base, selectedVariants);
  return base;
}

/** Live preview using the real React component via LiveNode. */
function LiveNodePreview({ def, selectedVariants }: { def: ComponentDef; selectedVariants: Record<string, string> }) {
  const importPath = def.importPath ?? "studio:shadcn";

  const componentProps = useMemo(
    () => normalizePreviewProps(def, selectedVariants),
    [def, selectedVariants]
  );

  // studio:template components have rich built-in mock content — injecting
  // template tree children overrides that and produces broken partial renders.
  // Only pass template children for shadcn/external components that need their
  // compound sub-components (Accordion → AccordionItem, Alert → AlertTitle, etc.)
  const templateChildren = importPath !== "studio:template"
    ? def.defaultTemplate?.children
    : undefined;

  return (
    <div style={{ minWidth: 200, maxWidth: "100%" }}>
      <LiveNode importPath={importPath} componentName={def.name} componentProps={componentProps} previewMode={true}>
        {templateChildren?.map((child, i) => {
          const cp = (child.props ?? {}) as Record<string, unknown>;
          const childPath = (cp.importPath as string | undefined) ?? importPath;
          const childName = (cp.componentName as string | undefined) ?? child.type;
          const childCompProps = (cp.componentProps as Record<string, unknown> | undefined) ?? {};
          const grandChildren = (child as { children?: typeof templateChildren }).children;
          return (
            <LiveNode key={i} importPath={childPath} componentName={childName} componentProps={childCompProps} previewMode={true}>
              {grandChildren?.map((gc, j) => {
                const gcp = (gc.props ?? {}) as Record<string, unknown>;
                const gcPath = (gcp.importPath as string | undefined) ?? childPath;
                const gcName = (gcp.componentName as string | undefined) ?? gc.type;
                const gcProps = (gcp.componentProps as Record<string, unknown> | undefined) ?? {};
                return <LiveNode key={j} importPath={gcPath} componentName={gcName} componentProps={gcProps} previewMode={true} />;
              })}
            </LiveNode>
          );
        })}
      </LiveNode>
    </div>
  );
}

function ComponentPreview({ def, tokens, selectedVariants }: PreviewProps) {
  const cssVars = useMemo(() => buildCssVars(tokens), [tokens]);

  return (
    <div style={{ ["--"] : cssVars } as React.CSSProperties} className="relative">
      <style>{`:root { ${cssVars} }`}</style>
      <div className="flex items-center justify-center min-h-[120px] p-4 rounded-xl bg-white dark:bg-zinc-900 border overflow-hidden">
        <PreviewErrorBoundary name={def.name}>
          <LiveNodePreview def={def} selectedVariants={selectedVariants} />
        </PreviewErrorBoundary>
      </div>
      <p className="text-[9px] text-muted-foreground text-center mt-1.5">
        Live preview · uses real component
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Inline-editable Variant Editor
// ─────────────────────────────────────────────────────────────

function VariantEditor({ variants, onChange }: { variants: VariantGroup[]; onChange: (v: VariantGroup[]) => void }) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editBuf, setEditBuf] = useState<VariantGroup>({ name: "", options: [], default: "" });
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newOptions, setNewOptions] = useState("");
  const [newDefault, setNewDefault] = useState("");

  const startEdit = (i: number) => {
    setEditingIdx(i);
    setEditBuf({ ...variants[i] });
    setAdding(false);
  };

  const saveEdit = (i: number) => {
    if (!editBuf.name.trim()) return;
    const next = variants.map((v, j) => j === i ? editBuf : v);
    onChange(next);
    setEditingIdx(null);
  };

  const handleAdd = () => {
    if (!newName.trim() || !newOptions.trim()) return;
    const opts = newOptions.split(",").map((o) => o.trim()).filter(Boolean);
    if (opts.length < 2) { toast.error("Add at least 2 options, comma-separated"); return; }
    onChange([...variants, { name: newName.trim(), options: opts, default: newDefault.trim() || opts[0] }]);
    setAdding(false); setNewName(""); setNewOptions(""); setNewDefault("");
  };

  return (
    <div className="space-y-2">
      {variants.map((vg, i) => (
        <div key={i}>
          {editingIdx === i ? (
            <div className="p-3 rounded-lg border bg-muted/10 space-y-2">
              <input
                autoFocus
                type="text"
                value={editBuf.name}
                onChange={(e) => setEditBuf((b) => ({ ...b, name: e.target.value }))}
                placeholder="Prop name (e.g. variant, size)"
                className="w-full px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
              />
              <input
                type="text"
                value={editBuf.options.join(", ")}
                onChange={(e) => setEditBuf((b) => ({ ...b, options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) }))}
                placeholder="Options, comma-separated"
                className="w-full px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
              />
              <div className="flex flex-wrap gap-1">
                {editBuf.options.map((opt) => (
                  <button key={opt}
                    onClick={() => setEditBuf((b) => ({ ...b, default: opt }))}
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${editBuf.default === opt ? "bg-[var(--s-accent)]/10 border-[var(--s-accent)]/40 text-[var(--s-accent)]" : "border-border text-muted-foreground hover:bg-accent"}`}
                  >
                    {opt === editBuf.default ? "★ " : ""}{opt}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground">Click an option to set as default</p>
              <div className="flex gap-2">
                <button onClick={() => saveEdit(i)} className="px-2 py-1 text-[10px] bg-[var(--s-accent)] text-white rounded hover:opacity-90">Save</button>
                <button onClick={() => setEditingIdx(null)} className="px-2 py-1 text-[10px] hover:bg-accent rounded">Cancel</button>
                <button onClick={() => { onChange(variants.filter((_, j) => j !== i)); setEditingIdx(null); }} className="px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10 rounded ml-auto">Delete</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => startEdit(i)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors text-left group"
            >
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold font-mono text-foreground">{vg.name}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {vg.options.map((opt) => (
                    <span key={opt} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${opt === vg.default ? "bg-[var(--s-accent)]/10 border-[var(--s-accent)]/30 text-[var(--s-accent)]" : "bg-muted border-border text-muted-foreground"}`}>
                      {opt}
                    </span>
                  ))}
                </div>
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100">
                <path d="M2 9L9 2M9 2H5M9 2V6"/>
              </svg>
            </button>
          )}
        </div>
      ))}

      {adding ? (
        <div className="p-3 rounded-lg border bg-muted/10 space-y-2">
          <input autoFocus type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Prop name (e.g. variant, size)"
            className="w-full px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none" />
          <input type="text" value={newOptions} onChange={(e) => setNewOptions(e.target.value)}
            placeholder="Options, comma-separated (e.g. primary, secondary, ghost)"
            className="w-full px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none" />
          <input type="text" value={newDefault} onChange={(e) => setNewDefault(e.target.value)}
            placeholder="Default option (optional)"
            className="w-full px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-2 py-1 text-[10px] bg-[var(--s-accent)] text-white rounded hover:opacity-90">Add</button>
            <button onClick={() => setAdding(false)} className="px-2 py-1 text-[10px] hover:bg-accent rounded">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
          Add variant group
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Inline-editable Prop Editor
// ─────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<PropType, string> = {
  string: "string", number: "number", boolean: "boolean", enum: "enum", icon: "icon", node: "node",
};

function PropEditor({ props, onChange }: { props: ComponentProp[]; onChange: (p: ComponentProp[]) => void }) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editBuf, setEditBuf] = useState<ComponentProp>({ name: "", type: "string" });
  const [adding, setAdding] = useState(false);
  const [newProp, setNewProp] = useState<Partial<ComponentProp>>({ type: "string" });

  const startEdit = (i: number) => { setEditingIdx(i); setEditBuf({ ...props[i] }); setAdding(false); };

  const saveEdit = (i: number) => {
    if (!editBuf.name.trim()) return;
    onChange(props.map((p, j) => j === i ? editBuf : p));
    setEditingIdx(null);
  };

  const handleAdd = () => {
    if (!newProp.name?.trim()) return;
    onChange([...props, { name: newProp.name.trim(), type: newProp.type ?? "string", default: newProp.default, options: newProp.options, description: newProp.description }]);
    setAdding(false); setNewProp({ type: "string" });
  };

  return (
    <div className="space-y-1.5">
      {props.map((p, i) => (
        <div key={i}>
          {editingIdx === i ? (
            <div className="p-3 rounded-lg border bg-muted/10 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input autoFocus type="text" value={editBuf.name}
                  onChange={(e) => setEditBuf((b) => ({ ...b, name: e.target.value }))}
                  placeholder="prop name"
                  className="px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none" />
                <select value={editBuf.type}
                  onChange={(e) => setEditBuf((b) => ({ ...b, type: e.target.value as PropType }))}
                  className="px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none">
                  {(Object.keys(TYPE_LABELS) as PropType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              {editBuf.type === "enum" && (
                <input type="text" value={editBuf.options?.join(", ") ?? ""}
                  onChange={(e) => setEditBuf((b) => ({ ...b, options: e.target.value.split(",").map(s => s.trim()) }))}
                  placeholder="Options: val1, val2, val3"
                  className="w-full px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none" />
              )}
              <input type="text" value={editBuf.default !== undefined ? String(editBuf.default) : ""}
                onChange={(e) => setEditBuf((b) => ({ ...b, default: e.target.value }))}
                placeholder="Default value (optional)"
                className="w-full px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none" />
              <input type="text" value={editBuf.description ?? ""}
                onChange={(e) => setEditBuf((b) => ({ ...b, description: e.target.value }))}
                placeholder="Description (optional)"
                className="w-full px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none" />
              <div className="flex gap-2">
                <button onClick={() => saveEdit(i)} className="px-2 py-1 text-[10px] bg-[var(--s-accent)] text-white rounded hover:opacity-90">Save</button>
                <button onClick={() => setEditingIdx(null)} className="px-2 py-1 text-[10px] hover:bg-accent rounded">Cancel</button>
                <button onClick={() => { onChange(props.filter((_, j) => j !== i)); setEditingIdx(null); }} className="px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10 rounded ml-auto">Delete</button>
              </div>
            </div>
          ) : (
            <button onClick={() => startEdit(i)}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors text-left group text-[11px]">
              <span className="font-mono font-semibold text-foreground flex-1 truncate">{p.name}</span>
              <span className="text-muted-foreground font-mono bg-muted px-1 rounded text-[10px]">{p.type}</span>
              {p.default !== undefined && <span className="text-muted-foreground/60 text-[10px] truncate max-w-[80px]">{String(p.default)}</span>}
              {p.description && <span className="text-muted-foreground/50 truncate max-w-[60px] text-[10px] hidden group-hover:block">{p.description}</span>}
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100">
                <path d="M2 9L9 2M9 2H5M9 2V6"/>
              </svg>
            </button>
          )}
        </div>
      ))}

      {adding ? (
        <div className="p-3 rounded-lg border bg-muted/10 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input autoFocus type="text" value={newProp.name ?? ""}
              onChange={(e) => setNewProp((p) => ({ ...p, name: e.target.value }))}
              placeholder="prop name"
              className="px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none" />
            <select value={newProp.type ?? "string"}
              onChange={(e) => setNewProp((p) => ({ ...p, type: e.target.value as PropType }))}
              className="px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none">
              {(Object.keys(TYPE_LABELS) as PropType[]).map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          {newProp.type === "enum" && (
            <input type="text" value={newProp.options?.join(", ") ?? ""}
              onChange={(e) => setNewProp((p) => ({ ...p, options: e.target.value.split(",").map(s => s.trim()) }))}
              placeholder="Options: option1, option2, option3"
              className="w-full px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none" />
          )}
          <input type="text" value={newProp.default !== undefined ? String(newProp.default) : ""}
            onChange={(e) => setNewProp((p) => ({ ...p, default: e.target.value }))}
            placeholder="Default value (optional)"
            className="w-full px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none" />
          <input type="text" value={newProp.description ?? ""}
            onChange={(e) => setNewProp((p) => ({ ...p, description: e.target.value }))}
            placeholder="Description (optional)"
            className="w-full px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-2 py-1 text-[10px] bg-[var(--s-accent)] text-white rounded hover:opacity-90">Add</button>
            <button onClick={() => setAdding(false)} className="px-2 py-1 text-[10px] hover:bg-accent rounded">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
          Add prop
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Template editor
// ─────────────────────────────────────────────────────────────

const TEMPLATE_NODE_TYPES = [
  { type: "Heading",   label: "Heading",   defaultProps: { text: "Heading", level: 2 } },
  { type: "Text",      label: "Text",       defaultProps: { text: "Body text goes here." } },
  { type: "Image",     label: "Image",      defaultProps: { src: "", alt: "Image" } },
  { type: "Stack",     label: "Stack",      defaultProps: { direction: "vertical" } },
  { type: "Button",    label: "Button",     defaultProps: { text: "Button" } },
  { type: "Divider",   label: "Divider",    defaultProps: {} },
  { type: "Spacer",    label: "Spacer",     defaultProps: {} },
  { type: "Badge",     label: "Badge",      defaultProps: { text: "Badge" } },
  { type: "Avatar",    label: "Avatar",     defaultProps: { fallback: "AB" } },
] as const;

function TemplateNodeRow({
  node,
  onUpdate,
  onRemove,
  dragging,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  node: TemplateNode;
  onUpdate: (id: string, props: Record<string, string | number | boolean>) => void;
  onRemove: (id: string) => void;
  dragging: string | null;
  onDragStart: (id: string) => void;
  onDragOver: (id: string) => void;
  onDrop: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const editableProps = Object.entries(node.props).filter(([, v]) => typeof v === "string" || typeof v === "number");

  return (
    <div
      draggable
      onDragStart={() => onDragStart(node.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver(node.id); }}
      onDrop={(e) => { e.preventDefault(); onDrop(node.id); }}
      className={`rounded-lg border transition-colors ${dragging === node.id ? "opacity-40" : "opacity-100"}`}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        {/* drag handle */}
        <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor" className="text-muted-foreground/30 shrink-0 cursor-grab">
          <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
          <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
          <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
        </svg>

        <span className="text-[11px] font-semibold text-foreground flex-1">{node.type}</span>

        {/* Quick text preview */}
        {typeof node.props.text === "string" && node.props.text && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{node.props.text as string}</span>
        )}

        {editableProps.length > 0 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-muted-foreground hover:text-foreground px-1"
            title={expanded ? "Collapse" : "Edit props"}
          >
            {expanded ? "▲" : "▼"}
          </button>
        )}

        <button
          onClick={() => onRemove(node.id)}
          className="text-[10px] text-muted-foreground hover:text-destructive px-1"
          title="Remove"
        >
          ×
        </button>
      </div>

      {expanded && editableProps.length > 0 && (
        <div className="px-3 pb-2.5 space-y-1.5 border-t bg-muted/20">
          {editableProps.map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0">{key}</span>
              <input
                type={typeof val === "number" ? "number" : "text"}
                value={String(val)}
                onChange={(e) => onUpdate(node.id, {
                  ...node.props,
                  [key]: typeof val === "number" ? Number(e.target.value) : e.target.value,
                })}
                className="flex-1 px-2 py-1 text-[11px] bg-background border rounded focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateEditor({
  initialTemplate,
  onSave,
  onClose,
}: {
  initialTemplate: ComponentDef["defaultTemplate"];
  onSave: (tpl: ComponentDef["defaultTemplate"]) => void;
  onClose: () => void;
}) {
  const [nodes, setNodes] = useState<TemplateNode[]>(() => {
    if (initialTemplate && Array.isArray(initialTemplate.children)) {
      return initialTemplate.children.map((n) => ({
        id: tplId(),
        type: n.type ?? "Text",
        props: (n.props ?? {}) as Record<string, string | number | boolean>,
        children: [],
      }));
    }
    return [];
  });
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [addType, setAddType] = useState<string>(TEMPLATE_NODE_TYPES[0].type);

  const handleAdd = () => {
    const meta = TEMPLATE_NODE_TYPES.find((t) => t.type === addType);
    const newNode: TemplateNode = {
      id: tplId(),
      type: addType,
      props: (meta?.defaultProps ?? {}) as Record<string, string | number | boolean>,
      children: [],
    };
    setNodes((prev) => [...prev, newNode]);
  };

  const handleUpdate = (id: string, props: Record<string, string | number | boolean>) => {
    setNodes((prev) => prev.map((n) => n.id === id ? { ...n, props } : n));
  };

  const handleRemove = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleDrop = (toId: string) => {
    if (!dragId || dragId === toId) return;
    setNodes((prev) => {
      const from = prev.find((n) => n.id === dragId);
      if (!from) return prev;
      const without = prev.filter((n) => n.id !== dragId);
      const toIdx = without.findIndex((n) => n.id === toId);
      const result = [...without];
      result.splice(toIdx, 0, from);
      return result;
    });
    setDragId(null);
    setOverId(null);
  };

  const handleSave = () => {
    if (nodes.length === 0) {
      onSave(null);
    } else {
      onSave({
        type: "ComponentInstance",
        props: {},
        children: nodes,
      });
    }
    onClose();
  };

  return (
    <div className="mt-4 rounded-xl border bg-muted/10 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
        <div>
          <span className="text-[11px] font-semibold">Default Template</span>
          <p className="text-[9px] text-muted-foreground mt-0.5">
            Nodes dropped here appear as children when this component is placed on the canvas
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-[10px] text-muted-foreground hover:text-foreground px-1"
        >
          ✕
        </button>
      </div>

      <div className="p-3 space-y-2">
        {/* Node list */}
        {nodes.length === 0 ? (
          <div className="border border-dashed border-muted-foreground/30 rounded-lg p-5 text-center">
            <p className="text-[11px] text-muted-foreground">
              No child nodes yet. Add nodes below to define the default structure.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {nodes.map((node) => (
              <TemplateNodeRow
                key={node.id}
                node={node}
                onUpdate={handleUpdate}
                onRemove={handleRemove}
                dragging={dragId}
                onDragStart={setDragId}
                onDragOver={setOverId}
                onDrop={handleDrop}
              />
            ))}
          </div>
        )}

        {/* Add node row */}
        <div className="flex items-center gap-2 pt-1">
          <select
            value={addType}
            onChange={(e) => setAddType(e.target.value)}
            className="flex-1 px-2 py-1.5 text-[11px] bg-background border rounded focus:outline-none"
          >
            {TEMPLATE_NODE_TYPES.map((t) => (
              <option key={t.type} value={t.type}>{t.label}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] bg-[var(--s-accent)] text-white rounded hover:opacity-90 whitespace-nowrap"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
            Add node
          </button>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-2 pt-1 border-t mt-2">
          {nodes.length > 0 && (
            <button
              onClick={() => { if (confirm("Clear all template nodes?")) setNodes([]); }}
              className="px-3 py-1.5 text-[11px] text-destructive hover:bg-destructive/10 rounded"
            >
              Clear
            </button>
          )}
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] hover:bg-accent rounded">
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-[11px] bg-[var(--s-accent)] text-white rounded hover:opacity-90 font-medium"
          >
            Save template
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Create component modal
// ─────────────────────────────────────────────────────────────

function CreateComponentModal({ onSave, onClose }: { onSave: (def: ComponentDef) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-background border rounded-xl shadow-2xl w-full max-w-xs mx-4 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold">New Component</h3>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Name</label>
          <input autoFocus type="text" value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && name.trim()) { onSave({ name: name.trim(), description: description.trim(), variants: [], states: ["default"], props: [] }); onClose(); }}}
            placeholder="e.g. Button, Card, Input"
            className="w-full px-3 py-2 text-[12px] bg-muted/40 border rounded-md focus:outline-none" />
        </div>
        <div>
          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Description <span className="font-normal">(optional)</span></label>
          <input type="text" value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Primary action trigger"
            className="w-full px-3 py-2 text-[12px] bg-muted/40 border rounded-md focus:outline-none" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-[11px] rounded hover:bg-accent">Cancel</button>
          <button onClick={() => { if (name.trim()) { onSave({ name: name.trim(), description: description.trim(), variants: [], states: ["default"], props: [] }); onClose(); }}}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-[11px] bg-[var(--s-accent)] text-white rounded hover:opacity-90 disabled:opacity-50 font-medium">
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main tab
// ─────────────────────────────────────────────────────────────

export function DSComponentsTab({
  dsId,
  components: initialComponents,
  tokens = {},
}: {
  dsId: string;
  components: Record<string, unknown>;
  tokens?: Record<string, unknown>;
}) {
  const [components, setComponents] = useState<ComponentStore>((initialComponents ?? {}) as ComponentStore);
  const [selected, setSelected] = useState<string | null>(Object.keys(initialComponents ?? {})[0] ?? null);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const [dragCompKey, setDragCompKey] = useState<string | null>(null);
  const [dropCompKey, setDropCompKey] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState(false);

  // Preview controls
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [previewState, setPreviewState] = useState<PreviewState>("default");
  const [previewBg, setPreviewBg] = useState<"white" | "grey" | "dark">("white");

  const componentKeys = Object.keys(components);
  const currentDef = selected ? components[selected] : null;

  // Reset preview controls when selection changes
  const selectComponent = (key: string) => {
    setSelected(key);
    setSelectedVariants({});
    setPreviewState("default");
    setEditingTemplate(false);
  };

  // Categorised, filtered list
  const filteredKeys = useMemo(() =>
    componentKeys.filter((k) => components[k].name.toLowerCase().includes(search.toLowerCase())),
    [componentKeys, components, search]
  );

  const grouped = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const key of filteredKeys) {
      const cat = getCategory(components[key].name);
      if (!map[cat]) map[cat] = [];
      map[cat].push(key);
    }
    return map;
  }, [filteredKeys, components]);

  const saveComponents = useCallback(async (next: ComponentStore) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/studio/design-systems/${dsId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ components: next }),
      });
      if (res.ok) toast.success("Saved");
      else toast.error("Failed to save");
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }, [dsId]);

  const handleCreate = (def: ComponentDef) => {
    const key = def.name.toLowerCase().replace(/\s+/g, "-");
    const next = { ...components, [key]: def };
    setComponents(next);
    selectComponent(key);
    saveComponents(next);
  };

  const handleDelete = (key: string) => {
    if (!confirm(`Delete "${components[key].name}"?`)) return;
    const next = { ...components };
    delete next[key];
    setComponents(next);
    setSelected(Object.keys(next)[0] ?? null);
    saveComponents(next);
  };

  const handleDuplicate = (key: string) => {
    const original = components[key];
    let newName = `${original.name} Copy`;
    let newKey = `${key}-copy`;
    let i = 2;
    while (components[newKey]) { newKey = `${key}-copy-${i}`; newName = `${original.name} Copy ${i}`; i++; }
    const next = { ...components, [newKey]: { ...original, name: newName } };
    setComponents(next);
    selectComponent(newKey);
    saveComponents(next);
  };

  const handleCompDrop = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    const keys = Object.keys(components);
    const fromIdx = keys.indexOf(fromKey);
    const toIdx = keys.indexOf(toKey);
    if (fromIdx < 0 || toIdx < 0) return;
    const reordered = [...keys];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const next: ComponentStore = {};
    for (const k of reordered) next[k] = components[k];
    setComponents(next);
    saveComponents(next);
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(components, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "components.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as ComponentStore;
        if (typeof parsed !== "object" || Array.isArray(parsed)) { toast.error("Invalid component JSON"); return; }
        const next = { ...components, ...parsed };
        setComponents(next);
        saveComponents(next);
        toast.success(`Imported ${Object.keys(parsed).length} component(s)`);
      } catch { toast.error("Failed to parse JSON"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const updateSelected = (patch: Partial<ComponentDef>) => {
    if (!selected) return;
    const next = { ...components, [selected]: { ...components[selected], ...patch } };
    setComponents(next);
    saveComponents(next);
  };

  const bgStyles: Record<string, string> = {
    white: "bg-white",
    grey:  "bg-zinc-100 dark:bg-zinc-800",
    dark:  "bg-zinc-900",
  };

  if (componentKeys.length === 0) {
    return (
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold">Components</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">0 components · Define variants, states, and typed props</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-1.5 text-[11px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 font-medium">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
            New Component
          </button>
        </div>
        <div className="border border-dashed border-muted-foreground/30 rounded-xl p-10 text-center space-y-3">
          <p className="text-[12px] text-muted-foreground">No components defined yet. Apply a starter boilerplate or create one manually.</p>
          <button onClick={() => setShowCreate(true)} className="px-3 py-1.5 text-[11px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 font-medium">Define your first component</button>
        </div>
        {showCreate && <CreateComponentModal onSave={handleCreate} onClose={() => setShowCreate(false)} />}
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold">Components</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {componentKeys.length} component{componentKeys.length !== 1 ? "s" : ""} · Click a row to edit inline
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-[10px] text-muted-foreground animate-pulse">Saving…</span>}
          <button onClick={handleExportJSON} className="px-3 py-1.5 text-[11px] border rounded-md hover:bg-accent transition-colors text-muted-foreground">Export JSON</button>
          <button onClick={() => importInputRef.current?.click()} className="px-3 py-1.5 text-[11px] border rounded-md hover:bg-accent transition-colors text-muted-foreground">Import JSON</button>
          <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-3 py-1.5 text-[11px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 font-medium">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg>
            New
          </button>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Zone 1 — Component list */}
        <div className="w-48 shrink-0 space-y-3">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="5" cy="5" r="4"/><line x1="8.5" y1="8.5" x2="11" y2="11"/></svg>
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter…"
              className="w-full pl-6 pr-2 py-1.5 text-[11px] bg-muted/40 border rounded-lg focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]" />
          </div>
          {/* Grouped list */}
          {Object.entries(grouped).map(([cat, keys]) => (
            <div key={cat}>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1 mb-1">{cat}</div>
              <div className="space-y-0.5">
                {keys.map((key) => (
                  <div key={key}
                    role="button" tabIndex={0}
                    draggable
                    onDragStart={() => setDragCompKey(key)}
                    onDragEnd={() => { setDragCompKey(null); setDropCompKey(null); }}
                    onDragOver={(e) => { e.preventDefault(); setDropCompKey(key); }}
                    onDragLeave={() => setDropCompKey(null)}
                    onDrop={(e) => { e.preventDefault(); if (dragCompKey) handleCompDrop(dragCompKey, key); setDragCompKey(null); setDropCompKey(null); }}
                    onClick={() => selectComponent(key)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") selectComponent(key); }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md transition-colors text-[12px] group flex items-center justify-between cursor-grab active:cursor-grabbing ${selected === key ? "bg-[var(--s-accent)]/10 text-[var(--s-accent)] font-semibold" : "hover:bg-accent text-foreground"} ${dropCompKey === key && dragCompKey !== key ? "border border-[var(--s-accent)]" : ""}`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" className="text-muted-foreground/30 shrink-0">
                        <circle cx="3" cy="2" r="1"/><circle cx="7" cy="2" r="1"/>
                        <circle cx="3" cy="5" r="1"/><circle cx="7" cy="5" r="1"/>
                        <circle cx="3" cy="8" r="1"/><circle cx="7" cy="8" r="1"/>
                      </svg>
                      <span className="truncate">{components[key].name}</span>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); handleDuplicate(key); }}
                        title="Duplicate" className="text-muted-foreground hover:text-foreground text-[10px] px-1 py-0.5 rounded hover:bg-accent/80">⎘</button>
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(key); }}
                        title="Delete" className="text-muted-foreground hover:text-destructive text-[10px] px-1 py-0.5 rounded hover:bg-accent/80">×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filteredKeys.length === 0 && search && (
            <p className="text-[11px] text-muted-foreground px-1">No components match "{search}"</p>
          )}
        </div>

        {/* Zone 2+3 — Preview + Editor */}
        {currentDef && (
          <div className="flex-1 min-w-0 space-y-5">

            {/* Zone 2 — Preview */}
            <div className="rounded-xl border overflow-hidden">
              {/* Preview topbar */}
              <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Preview</span>
                <div className="flex items-center gap-2">
                  {/* Background toggle */}
                  <div className="flex gap-0.5">
                    {(["white","grey","dark"] as const).map((b) => (
                      <button key={b} onClick={() => setPreviewBg(b)}
                        className={`w-5 h-5 rounded text-[9px] border transition-all ${previewBg === b ? "ring-1 ring-[var(--s-accent)]" : "opacity-50"}`}
                        style={{ background: b === "white" ? "#fff" : b === "grey" ? "#e4e4e7" : "#18181b" }}
                        title={b}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Preview area */}
              <div className={`flex items-center justify-center py-8 px-6 ${bgStyles[previewBg]}`}>
                <ComponentPreview
                  def={currentDef}
                  tokens={tokens}
                  selectedVariants={selectedVariants}
                  previewState={previewState}
                  bg={previewBg}
                />
              </div>

              {/* Variant controls */}
              {currentDef.variants.length > 0 && (
                <div className="px-3 py-2 border-t bg-muted/10 space-y-2">
                  {currentDef.variants.map((vg) => (
                    <div key={vg.name} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0">{vg.name}</span>
                      <div className="flex flex-wrap gap-1">
                        {vg.options.map((opt) => (
                          <button key={opt}
                            onClick={() => setSelectedVariants((prev) => ({ ...prev, [vg.name]: opt }))}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${(selectedVariants[vg.name] ?? vg.default) === opt ? "bg-[var(--s-accent)]/10 border-[var(--s-accent)]/40 text-[var(--s-accent)]" : "border-border text-muted-foreground hover:bg-accent"}`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* State controls */}
              {currentDef.states.length > 0 && (
                <div className="px-3 py-2 border-t bg-muted/10 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0">state</span>
                  {currentDef.states.map((state) => (
                    <button key={state}
                      onClick={() => setPreviewState(state)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${previewState === state ? "bg-[var(--s-accent)]/10 border-[var(--s-accent)]/40 text-[var(--s-accent)]" : "border-border text-muted-foreground hover:bg-accent"}`}
                    >
                      :{state}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Zone 3 — Definition editor */}
            <div className="space-y-5">
              {/* Name + description */}
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Name</label>
                  <input type="text" value={currentDef.name}
                    onChange={(e) => updateSelected({ name: e.target.value })}
                    className="text-sm font-semibold bg-transparent border-b border-border focus:border-[var(--s-accent)] outline-none w-full" />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 block">Description</label>
                  <input type="text" value={currentDef.description ?? ""}
                    onChange={(e) => updateSelected({ description: e.target.value })}
                    placeholder="What does this component do?"
                    className="text-[12px] bg-muted/30 border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)] w-full" />
                </div>
              </div>

              {/* Variants */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Variants
                  <span className="normal-case font-normal ml-1 text-muted-foreground/70">— click a row to edit</span>
                </label>
                <VariantEditor variants={currentDef.variants} onChange={(v) => updateSelected({ variants: v })} />
              </div>

              {/* States */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  States
                  <span className="normal-case font-normal ml-1 text-muted-foreground/70">— emitted as CSS pseudo-classes</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_STATES.map((state) => {
                    const active = currentDef.states.includes(state);
                    return (
                      <button key={state}
                        onClick={() => {
                          const next = active ? currentDef.states.filter((s) => s !== state) : [...currentDef.states, state];
                          if (!next.includes("default")) next.unshift("default");
                          updateSelected({ states: next });
                        }}
                        disabled={state === "default"}
                        className={`px-3 py-1 rounded-full text-[11px] border transition-colors ${active ? "bg-[var(--s-accent)]/10 border-[var(--s-accent)]/40 text-[var(--s-accent)]" : "border-border text-muted-foreground hover:bg-accent"} disabled:opacity-60 disabled:cursor-default`}
                      >
                        :{state}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Props */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Props
                  <span className="normal-case font-normal ml-1 text-muted-foreground/70">— click a row to edit</span>
                </label>
                <PropEditor props={currentDef.props} onChange={(p) => updateSelected({ props: p })} />
              </div>

              {/* Default template */}
              <div className="pb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Default Template
                    <span className="normal-case font-normal ml-1 text-muted-foreground/70">— child nodes on drop</span>
                  </label>
                  {!editingTemplate && (
                    <button
                      onClick={() => setEditingTemplate(true)}
                      className="text-[10px] text-[var(--s-accent)] hover:underline"
                    >
                      {currentDef.defaultTemplate ? "Edit template" : "Add template"}
                    </button>
                  )}
                </div>

                {/* Summary when not editing */}
                {!editingTemplate && (
                  <div className="rounded-lg border bg-muted/10 px-3 py-2.5">
                    {currentDef.defaultTemplate && Array.isArray(currentDef.defaultTemplate.children) && currentDef.defaultTemplate.children.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(currentDef.defaultTemplate.children as TemplateNode[]).map((n, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border bg-muted text-muted-foreground font-mono">
                            {n.type}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground/60 italic">
                        No template — component drops as empty instance
                      </p>
                    )}
                  </div>
                )}

                {/* Inline template editor */}
                {editingTemplate && (
                  <TemplateEditor
                    initialTemplate={currentDef.defaultTemplate}
                    onSave={(tpl) => updateSelected({ defaultTemplate: tpl })}
                    onClose={() => setEditingTemplate(false)}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showCreate && <CreateComponentModal onSave={handleCreate} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
