"use client";

import React, { useState } from "react";

type Step = "colors" | "typography" | "spacing" | "review";

const STEPS: { key: Step; label: string }[] = [
  { key: "colors", label: "Colors" },
  { key: "typography", label: "Typography" },
  { key: "spacing", label: "Spacing" },
  { key: "review", label: "Review" },
];

const TYPE_SCALES = [
  { key: "minor-third", label: "Minor Third (1.2)" },
  { key: "major-third", label: "Major Third (1.25)" },
  { key: "perfect-fourth", label: "Perfect Fourth (1.333)" },
  { key: "augmented-fourth", label: "Augmented Fourth (1.414)" },
  { key: "perfect-fifth", label: "Perfect Fifth (1.5)" },
];

export function DSWizard({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("colors");
  const [primary, setPrimary] = useState("#3b82f6");
  const [secondary, setSecondary] = useState("#6b7280");
  const [accent, setAccent] = useState("");
  const [headingFont, setHeadingFont] = useState("Geist, system-ui, sans-serif");
  const [bodyFont, setBodyFont] = useState("Geist, system-ui, sans-serif");
  const [typeScale, setTypeScale] = useState("major-third");
  const [baseUnit, setBaseUnit] = useState(8);
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) {
      const next = STEPS[stepIndex + 1].key;
      setStep(next);
      if (next === "review") handlePreview();
    }
  };
  const goBack = () => {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1].key);
  };

  const getPayload = () => ({
    primaryColor: primary,
    secondaryColor: secondary,
    accentColor: accent || undefined,
    headingFont,
    bodyFont,
    typeScale,
    baseUnit,
  });

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/tokens/generate?preview=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getPayload()),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setPreview(data.tokens);
    } catch {
      setError("Failed to generate preview");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/studio/tokens/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getPayload()),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setSuccess(true);
        setTimeout(() => onClose(), 1500);
      }
    } catch {
      setError("Failed to generate design system");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl bg-background border rounded-lg shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Create Design System</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">&times;</button>
        </div>

        {/* Step indicator */}
        <div className="flex border-b">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`flex-1 px-3 py-2 text-xs font-medium text-center transition-colors ${
                i === stepIndex ? "border-b-2 border-blue-500 text-blue-600" :
                i < stepIndex ? "text-green-600" : "text-muted-foreground"
              }`}
            >
              {i < stepIndex ? "✓ " : ""}{s.label}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="p-6 space-y-4 min-h-[280px]">
          {step === "colors" && (
            <>
              <label className="block">
                <span className="text-sm font-medium">Primary Color</span>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                  <input type="text" value={primary} onChange={(e) => setPrimary(e.target.value)} className="flex-1 px-3 py-2 text-sm border rounded bg-background" />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Secondary Color</span>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                  <input type="text" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="flex-1 px-3 py-2 text-sm border rounded bg-background" />
                </div>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Accent Color <span className="text-muted-foreground">(optional)</span></span>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={accent || "#8b5cf6"} onChange={(e) => setAccent(e.target.value)} className="w-10 h-10 rounded border cursor-pointer" />
                  <input type="text" value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="Leave empty to skip" className="flex-1 px-3 py-2 text-sm border rounded bg-background" />
                </div>
              </label>
            </>
          )}

          {step === "typography" && (
            <>
              <label className="block">
                <span className="text-sm font-medium">Heading Font Family</span>
                <input type="text" value={headingFont} onChange={(e) => setHeadingFont(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm border rounded bg-background" />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Body Font Family</span>
                <input type="text" value={bodyFont} onChange={(e) => setBodyFont(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm border rounded bg-background" />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Type Scale</span>
                <select value={typeScale} onChange={(e) => setTypeScale(e.target.value)} className="mt-1 w-full px-3 py-2 text-sm border rounded bg-background">
                  {TYPE_SCALES.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                </select>
              </label>
            </>
          )}

          {step === "spacing" && (
            <>
              <label className="block">
                <span className="text-sm font-medium">Base Spacing Unit</span>
                <div className="flex items-center gap-3 mt-2">
                  {[4, 8].map((v) => (
                    <button
                      key={v}
                      onClick={() => setBaseUnit(v)}
                      className={`px-4 py-2 text-sm border rounded transition-colors ${
                        baseUnit === v ? "bg-blue-500 text-white border-blue-500" : "hover:bg-accent"
                      }`}
                    >
                      {v}px
                    </button>
                  ))}
                </div>
              </label>
              <div className="text-sm text-muted-foreground mt-2">
                <p>Generated scale from {baseUnit}px base:</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {["xs", "sm", "md", "lg", "xl", "2xl", "3xl"].map((name, i) => {
                    const multipliers = [0.25, 0.5, 1, 1.5, 2, 3, 4];
                    return (
                      <span key={name} className="px-2 py-1 border rounded text-xs bg-background">
                        {name}: {baseUnit * multipliers[i]}px
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {step === "review" && (
            <>
              {loading && <p className="text-sm text-muted-foreground">Generating preview...</p>}
              {error && <p className="text-sm text-destructive">{error}</p>}
              {success && <p className="text-sm text-green-600">Design system created successfully!</p>}
              {preview && !success && (
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  {Object.entries(preview).map(([category, tokens]) => (
                    <div key={category}>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{category}</div>
                      {category === "color" ? (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(tokens as Record<string, { value: string }>).map(([name, t]) => (
                            <div key={name} className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 border rounded bg-background">
                              <span className="w-3 h-3 rounded-sm border" style={{ backgroundColor: t.value }} />
                              <span>{name}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {typeof tokens === "object" && Object.entries(tokens as Record<string, unknown>).map(([name, val]) => {
                            if (typeof val === "object" && val && "value" in (val as Record<string, unknown>)) {
                              return (
                                <span key={name} className="text-[10px] px-1.5 py-0.5 border rounded bg-background">
                                  {name}: {(val as { value: string }).value}
                                </span>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t">
          <button
            onClick={goBack}
            disabled={stepIndex === 0}
            className="px-4 py-2 text-sm border rounded hover:bg-accent transition-colors disabled:opacity-50"
          >
            Back
          </button>
          {step !== "review" ? (
            <button onClick={goNext} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
              Next
            </button>
          ) : (
            <button onClick={handleGenerate} disabled={loading || success} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50">
              {loading ? "Generating..." : "Create Design System"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
