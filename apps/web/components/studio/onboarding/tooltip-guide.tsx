"use client";

import React, { useState, useEffect, useCallback } from "react";

interface TooltipStep {
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

const GUIDE_STEPS: TooltipStep[] = [
  {
    target: "[data-guide='palette']",
    title: "Component Palette",
    description: "Drag components from here onto the canvas to build your screen.",
    position: "right",
  },
  {
    target: "[data-guide='canvas']",
    title: "Canvas",
    description: "Your design canvas. Select elements to edit their properties. Scroll to zoom, drag to pan.",
    position: "bottom",
  },
  {
    target: "[data-guide='properties']",
    title: "Properties Panel",
    description: "Edit the selected element's content, style, and layout here.",
    position: "left",
  },
  {
    target: "[data-guide='save']",
    title: "Save & Compile",
    description: "Save your changes and compile to production code. Ctrl+S also works!",
    position: "bottom",
  },
  {
    target: "[data-guide='preview']",
    title: "Preview Mode",
    description: "Toggle preview to see your design as users would -- interactive tabs, modals, and navigation.",
    position: "bottom",
  },
];

interface TooltipGuideProps {
  onComplete: () => void;
}

export function TooltipGuide({ onComplete }: TooltipGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [arrowPosition, setArrowPosition] = useState<"top" | "bottom" | "left" | "right">("bottom");

  const step = GUIDE_STEPS[currentStep];

  const updatePosition = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const pos = step.position ?? "bottom";
    setArrowPosition(pos);

    const tooltipW = 280;
    const tooltipH = 120;
    const gap = 12;

    let top = 0;
    let left = 0;

    switch (pos) {
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipW / 2;
        break;
      case "top":
        top = rect.top - tooltipH - gap;
        left = rect.left + rect.width / 2 - tooltipW / 2;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipH / 2;
        left = rect.right + gap;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipH / 2;
        left = rect.left - tooltipW - gap;
        break;
    }

    setPosition({ top: Math.max(8, top), left: Math.max(8, Math.min(left, window.innerWidth - tooltipW - 8)) });

    el.classList.add("ring-2", "ring-blue-500", "ring-offset-2", "relative", "z-[60]");
    return () => {
      el.classList.remove("ring-2", "ring-blue-500", "ring-offset-2", "relative", "z-[60]");
    };
  }, [step]);

  useEffect(() => {
    const cleanup = updatePosition();
    return cleanup;
  }, [updatePosition]);

  if (!step) return null;

  function handleNext() {
    const el = document.querySelector(GUIDE_STEPS[currentStep].target);
    if (el) el.classList.remove("ring-2", "ring-blue-500", "ring-offset-2", "relative", "z-[60]");

    if (currentStep < GUIDE_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  }

  function handleSkip() {
    const el = document.querySelector(GUIDE_STEPS[currentStep].target);
    if (el) el.classList.remove("ring-2", "ring-blue-500", "ring-offset-2", "relative", "z-[60]");
    onComplete();
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[55] bg-black/20 pointer-events-none" />

      {/* Tooltip */}
      <div
        className="fixed z-[70] w-[280px] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3"
        style={{ top: position.top, left: position.left }}
      >
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              {step.title}
            </h4>
            <span className="text-[10px] text-zinc-400">
              {currentStep + 1} / {GUIDE_STEPS.length}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {step.description}
          </p>
        </div>
        <div className="flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            Skip tour
          </button>
          <button
            onClick={handleNext}
            className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {currentStep < GUIDE_STEPS.length - 1 ? "Next" : "Done"}
          </button>
        </div>
      </div>
    </>
  );
}
