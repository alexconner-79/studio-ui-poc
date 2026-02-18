"use client";

import React, { useState } from "react";

type ExportFormat = "zip" | "docker" | "vercel" | "github" | "expo";
type FrameworkTarget = "nextjs" | "vue" | "svelte" | "html" | "expo";

const FORMATS: { key: ExportFormat; label: string; description: string }[] = [
  { key: "zip", label: "Download Zip", description: "Download the full project as a zip archive." },
  { key: "expo", label: "Expo (RN)", description: "Zip with Expo app structure for React Native." },
  { key: "docker", label: "Docker", description: "Zip with Dockerfile and docker-compose.yml included." },
  { key: "vercel", label: "Vercel", description: "Zip with vercel.json config for easy deployment." },
  { key: "github", label: "GitHub", description: "Get instructions and a script to push to a new GitHub repo." },
];

const FRAMEWORKS: { key: FrameworkTarget; label: string }[] = [
  { key: "nextjs", label: "Next.js" },
  { key: "vue", label: "Vue" },
  { key: "svelte", label: "Svelte" },
  { key: "html", label: "HTML/CSS" },
  { key: "expo", label: "Expo (RN)" },
];

export function ExportModal({ onClose }: { onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>("zip");
  const [framework, setFramework] = useState<FrameworkTarget>("nextjs");
  const [loading, setLoading] = useState(false);
  const [githubResult, setGithubResult] = useState<{
    message: string;
    script: string;
    instructions: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    setGithubResult(null);

    try {
      const res = await fetch("/api/studio/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, framework }),
      });

      if (format === "github") {
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setGithubResult(data);
        }
      } else {
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Export failed");
          return;
        }
        // Download the zip
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const fileName =
          format === "docker" ? "studio-project-docker.zip"
            : format === "vercel" ? "studio-project-vercel.zip"
            : "studio-project.zip";
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      setError("Export failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-background border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Export Project</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">&times;</button>
        </div>

        <div className="p-6 space-y-4">
          {/* Framework selection */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Target Framework</label>
            <div className="flex flex-wrap gap-1.5">
              {FRAMEWORKS.map((fw) => (
                <button
                  key={fw.key}
                  onClick={() => setFramework(fw.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    framework === fw.key
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "border hover:bg-muted"
                  }`}
                >
                  {fw.label}
                </button>
              ))}
            </div>
          </div>

          {/* Format selection */}
          <div className="grid grid-cols-2 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.key}
                onClick={() => { setFormat(f.key); setGithubResult(null); setError(null); }}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  format === f.key
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                    : "border-border hover:border-blue-400"
                }`}
              >
                <div className="text-sm font-medium">{f.label}</div>
                <div className="text-xs text-muted-foreground mt-1">{f.description}</div>
              </button>
            ))}
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded">{error}</div>
          )}

          {githubResult && (
            <div className="space-y-2">
              <p className="text-sm">{githubResult.message}</p>
              <pre className="text-xs font-mono bg-muted/30 p-3 rounded overflow-x-auto">{githubResult.script}</pre>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                {githubResult.instructions.map((inst, i) => (
                  <li key={i}>{inst}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border rounded hover:bg-accent">Cancel</button>
            <button
              onClick={handleExport}
              disabled={loading}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Exporting..." : format === "github" ? "Get Instructions" : "Export"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
