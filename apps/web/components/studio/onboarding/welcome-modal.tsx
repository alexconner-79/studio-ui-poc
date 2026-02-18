"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";

interface WelcomeModalProps {
  onDismiss: () => void;
  onCreateFromTemplate?: (template: string) => void;
}

const TEMPLATES = [
  {
    id: "landing-page",
    name: "Landing Page",
    description: "Hero section, features grid, and call-to-action",
    icon: "&#127758;",
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Stats cards, charts area, and data table",
    icon: "&#128202;",
  },
  {
    id: "login",
    name: "Login Page",
    description: "Authentication form with social logins",
    icon: "&#128274;",
  },
  {
    id: "blank",
    name: "Blank Canvas",
    description: "Start from scratch with an empty screen",
    icon: "&#10024;",
  },
];

export function WelcomeModal({ onDismiss, onCreateFromTemplate }: WelcomeModalProps) {
  const [step, setStep] = useState(0);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden">
        {step === 0 && (
          <div className="p-8 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white text-2xl font-bold">
              S
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Welcome to Studio UI
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                Design screens visually and export production-ready code. No runtime -- your code is yours.
              </p>
            </div>
            <div className="space-y-3 text-left max-w-sm mx-auto">
              {[
                { icon: "&#127912;", text: "Drag-and-drop visual editor" },
                { icon: "&#127752;", text: "Design tokens and typography" },
                { icon: "&#9889;", text: "Export to Next.js or React Native" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                  <span className="text-lg" dangerouslySetInnerHTML={{ __html: item.icon }} />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
            <Button className="w-full max-w-sm" onClick={() => setStep(1)}>
              Get Started
            </Button>
          </div>
        )}

        {step === 1 && (
          <div className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                Pick a starting point
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Choose a template or start with a blank canvas
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => {
                    if (onCreateFromTemplate) {
                      onCreateFromTemplate(tmpl.id);
                    }
                    onDismiss();
                  }}
                  className="p-4 rounded-xl border-2 border-zinc-200 dark:border-zinc-700 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all text-left group"
                >
                  <div className="text-2xl mb-2" dangerouslySetInnerHTML={{ __html: tmpl.icon }} />
                  <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 transition-colors">
                    {tmpl.name}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {tmpl.description}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={onDismiss}
              className="w-full text-center text-sm text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Skip for now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
