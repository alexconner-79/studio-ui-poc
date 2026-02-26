"use client";

import React, { useState, useMemo } from "react";
import { hexToHuePalette, deriveInteractionTokens } from "@/lib/studio/generate-palette";
import { contrastRatio, wcagRating } from "@/lib/studio/colour-a11y";

// -------------------------------------------------------------------------
// 5-Step Project Setup Wizard
// Triggered on first project creation (not on every editor visit)
// -------------------------------------------------------------------------

const PROJECT_TYPES = [
  { key: "webapp",    label: "Web App",             desc: "React / Next.js application",      icon: "⬛" },
  { key: "marketing", label: "Marketing Site",       desc: "Landing pages, blogs, docs",       icon: "⬜" },
  { key: "mobile",    label: "Mobile App",           desc: "React Native / Expo",               icon: "📱" },
  { key: "ds",        label: "Design System Only",  desc: "Component library, no screens",    icon: "🎨" },
] as const;

type ProjectType = typeof PROJECT_TYPES[number]["key"];

const FRAMEWORK_BY_TYPE: Record<ProjectType, string> = {
  webapp:    "nextjs",
  marketing: "nextjs",
  mobile:    "expo",
  ds:        "nextjs",
};

const FRAMEWORKS = [
  { key: "nextjs",  label: "Next.js"           },
  { key: "vue",     label: "Vue"               },
  { key: "svelte",  label: "Svelte"            },
  { key: "html",    label: "HTML / CSS"        },
  { key: "expo",    label: "Expo (React Native)" },
] as const;

const DS_OPTIONS = [
  {
    key: "link",
    label: "Link an existing design system",
    desc: "Choose one of your existing design systems to connect to this project",
    badge: "Recommended",
  },
  {
    key: "path1",
    label: "Start from a boilerplate",
    desc: "Pick shadcn/ui, Material Design 3, Ant Design, Tailwind, or a minimal starter — ready in seconds",
    badge: null,
  },
  {
    key: "path2",
    label: "Connect your component library",
    desc: "Import tokens from your existing codebase, npm package, or GitHub repo",
    badge: null,
  },
  {
    key: "scratch",
    label: "Start from scratch",
    desc: "Build your token set manually — add colours, spacing, and typography one by one",
    badge: null,
  },
  {
    key: "skip",
    label: "Skip for now",
    desc: "You can create or link a design system any time from Project Settings",
    badge: null,
  },
] as const;

const FONT_FAMILIES = [
  "Inter", "Geist", "Roboto", "Poppins", "DM Sans", "Plus Jakarta Sans",
  "Nunito", "Lato", "Open Sans", "Manrope", "Outfit", "Work Sans",
] as const;

const MONO_FONTS = ["JetBrains Mono", "Fira Code", "Source Code Pro", "Geist Mono", "IBM Plex Mono"] as const;

const TYPE_SCALE_PRESETS = {
  default: { label: "Default", sizes: ["12px", "14px", "16px", "20px", "24px", "30px", "36px", "48px"] },
  compact: { label: "Compact", sizes: ["11px", "12px", "14px", "16px", "20px", "24px", "30px", "40px"] },
  large:   { label: "Large",   sizes: ["14px", "16px", "18px", "22px", "28px", "36px", "48px", "64px"] },
} as const;

type TypeScalePreset = keyof typeof TYPE_SCALE_PRESETS;

// Wizard step — "brand" is the new 4b sub-step
type WizardStep = 1 | 2 | 3 | 4 | "brand" | 5;

export interface ProjectSetupResult {
  projectName: string;
  projectType: ProjectType;
  framework: string;
  githubRepo?: string;
  dsChoice: string;
  linkedDsId?: string;
  brandTokens?: Record<string, unknown>;
}

interface WelcomeModalProps {
  onDismiss: () => void;
  onComplete?: (result: ProjectSetupResult) => void;
}

// ─────────────────────────────────────────────────────────────
// WCAG contrast badge
// ─────────────────────────────────────────────────────────────

function ContrastBadge({ fg, bg, label }: { fg: string; bg: string; label: string }) {
  const isValidHex = (h: string) => /^#[0-9a-fA-F]{6}$/.test(h);
  if (!isValidHex(fg) || !isValidHex(bg)) return null;
  const ratio = contrastRatio(fg, bg);
  const r = wcagRating(ratio);
  const pass = r.aa ? "AA" : r.aaLarge ? "AA+" : null;
  const colour = r.aa ? "bg-green-100 text-green-700" : r.aaLarge ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";

  return (
    <div className="flex items-center justify-between py-1 text-[11px]">
      <span className="text-zinc-500">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-zinc-600">{ratio.toFixed(1)}:1</span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${colour}`}>
          {pass ?? "Fail"}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Colour picker row
// ─────────────────────────────────────────────────────────────

function ColourField({
  label,
  value,
  onChange,
  sublabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  sublabel?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300">{label}</div>
        {sublabel && <div className="text-[10px] text-zinc-400">{sublabel}</div>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div
          className="w-7 h-7 rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden cursor-pointer relative"
          title="Pick colour"
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="w-full h-full rounded-md" style={{ background: value }} />
        </div>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#([0-9a-fA-F]{0,6})$/.test(v)) onChange(v);
          }}
          maxLength={7}
          className="w-20 px-2 py-1 text-[11px] font-mono bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: WizardStep; total: number }) {
  const stepNum = current === "brand" ? 4.5 : Number(current);
  return (
    <div className="flex items-center gap-1.5 justify-center">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i + 1 === Math.round(stepNum)
              ? "w-5 bg-blue-600"
              : i + 1 < stepNum
              ? "w-2 bg-blue-400"
              : "w-2 bg-zinc-200 dark:bg-zinc-700"
          }`}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Brand colour step
// ─────────────────────────────────────────────────────────────

interface BrandConfig {
  primary: string;
  secondary: string;
  accent: string;
  hover: string;
  active: string;
  focusRing: string;
  disabled: string;
  fontSans: string;
  fontMono: string;
  typeScale: TypeScalePreset;
}

function BrandStep({
  config,
  onChange,
}: {
  config: BrandConfig;
  onChange: (updates: Partial<BrandConfig>) => void;
}) {
  const [tab, setTab] = useState<"colours" | "typography">("colours");

  // Auto-derive interaction colours when primary changes
  const handlePrimaryChange = (hex: string) => {
    onChange({ primary: hex });
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      const derived = deriveInteractionTokens(hex);
      onChange({
        primary:   hex,
        hover:     String(derived.hover?.value    ?? config.hover),
        active:    String(derived.active?.value   ?? config.active),
        focusRing: String(derived["focus-ring"]?.value ?? config.focusRing),
      });
    }
  };

  const WHITE = "#ffffff";

  return (
    <div className="space-y-3">
      {/* Tab switcher */}
      <div className="flex items-center gap-0 border-b border-zinc-200 dark:border-zinc-700 -mx-0">
        {(["colours", "typography"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-[11px] font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {t === "colours" ? "Colours" : "Typography"}
          </button>
        ))}
      </div>

      {tab === "colours" && (
        <div className="space-y-4">
          {/* Brand colours */}
          <div>
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">Brand</div>
            <div className="space-y-2">
              <ColourField label="Primary" value={config.primary} onChange={handlePrimaryChange} sublabel="Main brand colour — generates a 50–900 scale" />
              <ColourField label="Secondary" value={config.secondary} onChange={(v) => onChange({ secondary: v })} sublabel="Supporting colour" />
              <ColourField label="Accent" value={config.accent} onChange={(v) => onChange({ accent: v })} sublabel="Highlights, callouts" />
            </div>
          </div>

          {/* Interaction colours */}
          <div>
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">Interactions <span className="text-zinc-400 normal-case font-normal">(auto-derived, editable)</span></div>
            <div className="space-y-2">
              <ColourField label="Hover"      value={config.hover}     onChange={(v) => onChange({ hover: v })}     sublabel="$color.interactive.hover" />
              <ColourField label="Active"     value={config.active}    onChange={(v) => onChange({ active: v })}    sublabel="$color.interactive.active" />
              <ColourField label="Focus ring" value={config.focusRing} onChange={(v) => onChange({ focusRing: v })} sublabel="$color.interactive.focus-ring" />
              <ColourField label="Disabled"   value={config.disabled}  onChange={(v) => onChange({ disabled: v })}  sublabel="$color.interactive.disabled" />
            </div>
          </div>

          {/* Accessibility checks */}
          <div>
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">Accessibility checks</div>
            <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 px-3 py-1 divide-y divide-zinc-100 dark:divide-zinc-700/50">
              <ContrastBadge fg={config.primary} bg={WHITE}            label="Primary on white" />
              <ContrastBadge fg={WHITE}          bg={config.primary}   label="White on primary" />
              <ContrastBadge fg={config.primary} bg={config.secondary} label="Primary on secondary" />
              <ContrastBadge fg={config.focusRing} bg={WHITE}          label="Focus ring on white" />
            </div>
            <p className="text-[10px] text-zinc-400 mt-1">AA = 4.5:1 (body text) · AA+ = 3:1 (large text)</p>
          </div>
        </div>
      )}

      {tab === "typography" && (
        <div className="space-y-4">
          {/* Font families */}
          <div>
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">Font families</div>
            <div className="space-y-2">
              <div>
                <label className="text-[12px] text-zinc-600 dark:text-zinc-400 block mb-1">Sans-serif</label>
                <select
                  value={config.fontSans}
                  onChange={(e) => onChange({ fontSans: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-[12px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md focus:outline-none"
                >
                  {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] text-zinc-600 dark:text-zinc-400 block mb-1">Monospace</label>
                <select
                  value={config.fontMono}
                  onChange={(e) => onChange({ fontMono: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-[12px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md focus:outline-none"
                >
                  {MONO_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Type scale */}
          <div>
            <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2">Type scale</div>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(TYPE_SCALE_PRESETS) as [TypeScalePreset, typeof TYPE_SCALE_PRESETS[TypeScalePreset]][]).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => onChange({ typeScale: key })}
                  className={`p-2 rounded-lg border-2 text-center transition-all ${
                    config.typeScale === key
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  <div className={`text-[11px] font-semibold ${config.typeScale === key ? "text-blue-700 dark:text-blue-300" : "text-zinc-700 dark:text-zinc-300"}`}>
                    {preset.label}
                  </div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">{preset.sizes[0]}–{preset.sizes[preset.sizes.length - 1]}</div>
                </button>
              ))}
            </div>
            <div className="flex items-end gap-1 mt-2 px-1">
              {TYPE_SCALE_PRESETS[config.typeScale].sizes.map((sz) => (
                <span key={sz} style={{ fontSize: `max(8px, ${sz})`, lineHeight: 1 }} className="text-zinc-400 leading-none">
                  Aa
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Build brand tokens payload
// ─────────────────────────────────────────────────────────────

function buildBrandTokens(config: BrandConfig): Record<string, unknown> {
  return {
    color: {
      ...Object.fromEntries(
        Object.entries(hexToHuePalette(config.primary)).map(([k, v]) => [`primary-${k}`, v])
      ),
      ...Object.fromEntries(
        Object.entries(hexToHuePalette(config.secondary)).map(([k, v]) => [`secondary-${k}`, v])
      ),
      ...Object.fromEntries(
        Object.entries(hexToHuePalette(config.accent)).map(([k, v]) => [`accent-${k}`, v])
      ),
      "interactive-hover":      { value: config.hover },
      "interactive-active":     { value: config.active },
      "interactive-focus-ring": { value: config.focusRing },
      "interactive-disabled":   { value: config.disabled },
    },
    typography: {
      "font-sans": { value: config.fontSans },
      "font-mono": { value: config.fontMono },
      ...Object.fromEntries(
        TYPE_SCALE_PRESETS[config.typeScale].sizes.map((sz, i) => {
          const labels = ["xs", "sm", "base", "md", "lg", "xl", "2xl", "3xl"];
          return [`size-${labels[i] ?? i}`, { value: sz }];
        })
      ),
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Main wizard component
// ─────────────────────────────────────────────────────────────

export function WelcomeModal({ onDismiss, onComplete }: WelcomeModalProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState<ProjectType>("webapp");
  const [framework, setFramework] = useState("nextjs");
  const [githubPat, setGithubPat] = useState("");
  const [dsChoice, setDsChoice] = useState("skip");
  const [existingDsList, setExistingDsList] = useState<{ id: string; name: string }[]>([]);
  const [existingDsId, setExistingDsId] = useState<string | null>(null);
  const [dsListLoading, setDsListLoading] = useState(false);
  const [brandConfig, setBrandConfig] = useState<BrandConfig>({
    primary:   "#6366f1",
    secondary: "#8b5cf6",
    accent:    "#f59e0b",
    hover:     "#4f46e5",
    active:    "#4338ca",
    focusRing: "#818cf8",
    disabled:  "#a1a1aa",
    fontSans:  "Inter",
    fontMono:  "JetBrains Mono",
    typeScale: "default",
  });

  const handleTypeSelect = (key: ProjectType) => {
    setProjectType(key);
    setFramework(FRAMEWORK_BY_TYPE[key]);
  };

  const handleDsChoiceSelect = (key: string) => {
    setDsChoice(key);
    if (key === "link" && existingDsList.length === 0) {
      setDsListLoading(true);
      fetch("/api/studio/design-systems")
        .then((r) => r.json())
        .then((d: { designSystems?: { id: string; name: string }[] }) => {
          const list = d.designSystems ?? [];
          setExistingDsList(list);
          if (list.length > 0 && !existingDsId) setExistingDsId(list[0].id);
        })
        .catch(() => {})
        .finally(() => setDsListLoading(false));
    }
  };

  const showsBrandStep = dsChoice !== "skip" && dsChoice !== "link";

  const handleNext = () => {
    if (step === 4 && showsBrandStep) {
      setStep("brand");
      return;
    }
    if (step === 4 || step === "brand") {
      setStep(5);
      return;
    }
    setStep((s) => (s === "brand" ? 5 : (Number(s) + 1) as WizardStep));
  };

  const handleBack = () => {
    if (step === "brand") { setStep(4); return; }
    if (step === 5 && showsBrandStep) { setStep("brand"); return; }
    setStep((s) => (Number(s) - 1) as WizardStep);
  };

  const brandTokens = useMemo(
    () => (showsBrandStep ? buildBrandTokens(brandConfig) : undefined),
    [showsBrandStep, brandConfig]
  );

  const handleDone = () => {
    onComplete?.({
      projectName: projectName.trim() || "My Project",
      projectType,
      framework,
      githubRepo: githubPat.trim() || undefined,
      dsChoice,
      linkedDsId: dsChoice === "link" ? (existingDsId ?? undefined) : undefined,
      brandTokens,
    });
    onDismiss();
  };

  const stepLabel: Record<WizardStep, string> = {
    1:      "Name & Type",
    2:      "Framework",
    3:      "GitHub",
    4:      "Design System",
    brand:  "Brand & Colours",
    5:      "All Set!",
  };

  const totalDots = showsBrandStep ? 6 : 5;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center">
              S
            </div>
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {stepLabel[step]}
            </span>
          </div>
          <StepIndicator current={step} total={totalDots} />
        </div>

        {/* Body */}
        <div className="px-6 pb-5 min-h-[240px] max-h-[480px] overflow-y-auto">

          {/* Step 1: Project name + type */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Project name
                </label>
                <input
                  autoFocus
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="My App"
                  className="w-full px-3 py-2 text-[13px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  onKeyDown={(e) => { if (e.key === "Enter" && projectName.trim()) handleNext(); }}
                />
              </div>
              <div>
                <p className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300 mb-2">What are you building?</p>
                <div className="grid grid-cols-2 gap-2">
                  {PROJECT_TYPES.map((pt) => (
                    <button
                      key={pt.key}
                      onClick={() => handleTypeSelect(pt.key)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        projectType === pt.key
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                          : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                      }`}
                    >
                      <div className="text-xl mb-1">{pt.icon}</div>
                      <div className={`text-[12px] font-semibold ${projectType === pt.key ? "text-blue-700 dark:text-blue-300" : "text-zinc-800 dark:text-zinc-200"}`}>{pt.label}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{pt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Framework */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mb-4">
                Pre-selected based on your project type. Override if needed.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {FRAMEWORKS.map((fw) => (
                  <button
                    key={fw.key}
                    onClick={() => setFramework(fw.key)}
                    className={`px-3 py-2.5 text-[12px] rounded-lg border-2 text-left font-medium transition-all ${
                      framework === fw.key
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400"
                    }`}
                  >
                    {fw.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: GitHub */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                Connect a GitHub repo to enable export, change tracking, and the MCP bridge for Cursor / Claude Code.
              </p>
              <div className="space-y-2">
                <label className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300">
                  GitHub Personal Access Token
                  <span className="text-zinc-400 font-normal ml-1">(optional)</span>
                </label>
                <input
                  type="password"
                  value={githubPat}
                  onChange={(e) => setGithubPat(e.target.value)}
                  placeholder="ghp_xxxxxxxxxxxx"
                  className="w-full px-3 py-2 text-[12px] bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <p className="text-[11px] text-zinc-400">
                  Requires <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">repo</code> scope.
                  Stored locally per project.
                </p>
              </div>
              <button
                onClick={() => setStep(4)}
                className="text-[12px] text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                Skip for now →
              </button>
            </div>
          )}

          {/* Step 4: Design System */}
          {step === 4 && (
            <div className="space-y-2">
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mb-3">
                Design systems are shared across projects. How do you want to get started?
              </p>
              {DS_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => handleDsChoiceSelect(opt.key)}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    dsChoice === opt.key
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                      : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`text-[12px] font-semibold flex-1 ${dsChoice === opt.key ? "text-blue-700 dark:text-blue-300" : "text-zinc-800 dark:text-zinc-200"}`}>
                      {opt.label}
                    </div>
                    {opt.badge && (
                      <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 shrink-0">{opt.badge}</span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{opt.desc}</div>
                </button>
              ))}
              {dsChoice === "link" && (
                <div className="pt-1">
                  {dsListLoading ? (
                    <p className="text-[11px] text-zinc-400">Loading design systems…</p>
                  ) : existingDsList.length === 0 ? (
                    <p className="text-[11px] text-zinc-400">No design systems found. Create one first from the Design Systems page.</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[11px] text-zinc-500 font-medium mb-1.5">Select design system:</p>
                      {existingDsList.map((ds) => (
                        <button
                          key={ds.id}
                          onClick={() => setExistingDsId(ds.id)}
                          className={`w-full px-3 py-2 rounded-lg border text-left text-[12px] transition-all ${
                            existingDsId === ds.id
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-medium"
                              : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400"
                          }`}
                        >
                          {ds.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {dsChoice === "path1" && (
                <p className="text-[11px] text-zinc-400 pt-1">
                  Next: set your brand colours and typography →
                </p>
              )}
            </div>
          )}

          {/* Step Brand: Colours + Typography */}
          {step === "brand" && (
            <BrandStep
              config={brandConfig}
              onChange={(updates) => setBrandConfig((prev) => ({ ...prev, ...updates }))}
            />
          )}

          {/* Step 5: Done */}
          {step === 5 && (
            <div className="space-y-3">
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mb-4">Here&apos;s what&apos;s been set up:</p>
              {dsChoice === "path2" && (
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 p-4 space-y-1.5">
                  <div className="text-[12px] font-semibold text-indigo-800 dark:text-indigo-200">
                    Next: connect your component library
                  </div>
                  <div className="text-[11px] text-indigo-600 dark:text-indigo-400 leading-relaxed">
                    Once inside the canvas, open the <strong>DS Panel</strong> (left sidebar) and click <strong>Connect your codebase →</strong> to import components and tokens from your npm package, GitHub repo, or local path.
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
                {[
                  { label: "Project type", value: PROJECT_TYPES.find(p => p.key === projectType)?.label ?? projectType },
                  { label: "Framework", value: FRAMEWORKS.find(f => f.key === framework)?.label ?? framework },
                  { label: "GitHub", value: githubPat.trim() ? "Connected (PAT)" : "Not connected" },
                  {
                    label: "Design system",
                    value: dsChoice === "path1" ? "Boilerplate + brand colours" :
                           dsChoice === "path2" ? "Connect existing library" :
                           dsChoice === "scratch" ? "Build from scratch" :
                           "Skip for now",
                  },
                  ...(showsBrandStep ? [
                    { label: "Brand primary", value: brandConfig.primary },
                    { label: "Typography",    value: `${brandConfig.fontSans} · ${TYPE_SCALE_PRESETS[brandConfig.typeScale].label} scale` },
                  ] : []),
                  ...(brandTokens ? [
                    {
                      label: "Tokens",
                      value: `${Object.values(brandTokens).reduce((sum, g) => sum + (g && typeof g === "object" && !Array.isArray(g) ? Object.keys(g as object).length : 0), 0)} tokens across ${Object.keys(brandTokens).length} groups`,
                    },
                  ] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-[12px] text-zinc-500">{label}</span>
                    <div className="flex items-center gap-1.5">
                      {label === "Brand primary" && <div className="w-3.5 h-3.5 rounded-full border border-zinc-200" style={{ background: value }} />}
                      <span className="text-[12px] font-medium text-zinc-800 dark:text-zinc-200">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          {step !== 1 ? (
            <button
              onClick={handleBack}
              className="text-[12px] text-zinc-500 hover:text-zinc-800 transition-colors px-3 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              ← Back
            </button>
          ) : (
            <button
              onClick={onDismiss}
              className="text-[12px] text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Skip setup
            </button>
          )}

          {step !== 5 ? (
            <button
              onClick={handleNext}
              disabled={step === 1 && !projectName.trim()}
              className="px-4 py-1.5 text-[12px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {step === "brand" ? "Done →" : step === 4 && dsChoice === "path1" ? "Set brand colours →" : "Next →"}
            </button>
          ) : (
            <button
              onClick={handleDone}
              className="px-4 py-1.5 text-[12px] bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Open canvas →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
