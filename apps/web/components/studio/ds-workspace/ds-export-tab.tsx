"use client";

import React, { useState, useRef } from "react";
import { toast } from "@/lib/studio/toast";

type DesignSystem = {
  id: string;
  name: string;
  platform: "web" | "native" | "universal";
  tokens: Record<string, unknown>;
  themes: Record<string, unknown>;
  components: Record<string, unknown>;
};

type ExportFormat = "css-vars" | "tailwind" | "style-dictionary" | "w3c";

const FORMATS: { id: ExportFormat; label: string; description: string; ext: string }[] = [
  {
    id: "css-vars",
    label: "CSS Variables",
    description: "Ready-to-paste :root { --token-name: value; } block",
    ext: "css",
  },
  {
    id: "tailwind",
    label: "Tailwind Config",
    description: "theme.extend object for tailwind.config.js",
    ext: "js",
  },
  {
    id: "style-dictionary",
    label: "Style Dictionary",
    description: "JSON in Amazon Style Dictionary format",
    ext: "json",
  },
  {
    id: "w3c",
    label: "W3C Design Tokens",
    description: "Community W3C DTCG format (.tokens.json)",
    ext: "json",
  },
];

function buildCSSVars(tokens: Record<string, unknown>): string {
  const lines: string[] = [":root {"];
  for (const [group, entries] of Object.entries(tokens)) {
    if (!entries || typeof entries !== "object") continue;
    for (const [key, entry] of Object.entries(entries as Record<string, unknown>)) {
      const val = (entry as { value?: unknown })?.value;
      if (val === undefined) continue;
      const cssVal = typeof val === "object" ? (val as { web?: string }).web ?? String(val) : String(val);
      lines.push(`  --${group}-${key}: ${cssVal};`);
    }
  }
  lines.push("}");
  return lines.join("\n");
}

function buildTailwindConfig(tokens: Record<string, unknown>): string {
  const result: Record<string, Record<string, string>> = {};
  for (const [group, entries] of Object.entries(tokens)) {
    if (!entries || typeof entries !== "object") continue;
    result[group] = {};
    for (const [key, entry] of Object.entries(entries as Record<string, unknown>)) {
      const val = (entry as { value?: unknown })?.value;
      if (val === undefined) continue;
      result[group][key] = typeof val === "object" ? (val as { web?: string }).web ?? String(val) : String(val);
    }
  }
  return `// tailwind.config.js — theme.extend\nmodule.exports = {\n  theme: {\n    extend: ${JSON.stringify(result, null, 4)},\n  },\n};\n`;
}

function buildStyleDictionary(tokens: Record<string, unknown>): string {
  const result: Record<string, unknown> = {};
  for (const [group, entries] of Object.entries(tokens)) {
    if (!entries || typeof entries !== "object") continue;
    result[group] = {};
    for (const [key, entry] of Object.entries(entries as Record<string, unknown>)) {
      const val = (entry as { value?: unknown })?.value;
      const desc = (entry as { description?: string })?.description;
      (result[group] as Record<string, unknown>)[key] = { value: val, ...(desc ? { comment: desc } : {}) };
    }
  }
  return JSON.stringify(result, null, 2);
}

function buildW3C(tokens: Record<string, unknown>): string {
  const result: Record<string, unknown> = {};
  for (const [group, entries] of Object.entries(tokens)) {
    if (!entries || typeof entries !== "object") continue;
    result[group] = {};
    for (const [key, entry] of Object.entries(entries as Record<string, unknown>)) {
      const val = (entry as { value?: unknown })?.value;
      const desc = (entry as { description?: string })?.description;
      (result[group] as Record<string, unknown>)[key] = {
        $value: val,
        $type: "unknown",
        ...(desc ? { $description: desc } : {}),
      };
    }
  }
  return JSON.stringify(result, null, 2);
}

const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

function addVersionHeader(output: string, ext: string, version: string, dsName: string): string {
  if (!version) return output;
  const header = ext === "css" || ext === "js"
    ? `/* ${dsName} — v${version} — generated ${new Date().toISOString().slice(0, 10)} */\n`
    : `// ${dsName} — v${version} — generated ${new Date().toISOString().slice(0, 10)}\n`;
  return header + output;
}

export function DSExportTab({ dsId, ds }: { dsId: string; ds: DesignSystem }) {
  void dsId;
  const [format, setFormat] = useState<ExportFormat>("css-vars");
  const [copied, setCopied] = useState(false);
  const [version, setVersion] = useState("");
  const [versionError, setVersionError] = useState("");

  // GitHub export state
  const [ghRepo, setGhRepo] = useState("");
  const [ghPath, setGhPath] = useState("");
  const [ghBranch, setGhBranch] = useState("main");
  const [ghPat, setGhPat] = useState("");
  const [ghPushing, setGhPushing] = useState(false);
  const [ghResult, setGhResult] = useState<{ ok: boolean; message: string } | null>(null);
  const ghPatRef = useRef<HTMLInputElement>(null);

  const fmt = FORMATS.find((f) => f.id === format)!;

  const buildOutput = (): string => {
    switch (format) {
      case "css-vars": return buildCSSVars(ds.tokens);
      case "tailwind": return buildTailwindConfig(ds.tokens);
      case "style-dictionary": return buildStyleDictionary(ds.tokens);
      case "w3c": return buildW3C(ds.tokens);
    }
  };

  const rawOutput = buildOutput();
  const output = version && SEMVER_RE.test(version)
    ? addVersionHeader(rawOutput, fmt.ext, version, ds.name)
    : rawOutput;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const slug = ds.name.toLowerCase().replace(/\s+/g, "-");
  const filename = version && SEMVER_RE.test(version)
    ? `${slug}-v${version}.${fmt.ext}`
    : `${slug}.${fmt.ext}`;

  const handleDownload = () => {
    const blob = new Blob([output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tokenCount = Object.values(ds.tokens).reduce<number>((sum, group) => {
    if (group && typeof group === "object" && !Array.isArray(group)) {
      return sum + Object.keys(group).length;
    }
    return sum;
  }, 0);

  const handleVersionChange = (v: string) => {
    setVersion(v);
    if (v && !SEMVER_RE.test(v)) setVersionError("Must be semver e.g. 1.0.0");
    else setVersionError("");
  };

  const handleGitHubPush = async () => {
    if (!ghPat.trim()) { ghPatRef.current?.focus(); toast.error("Enter a GitHub PAT"); return; }
    if (!ghRepo.trim()) { toast.error("Enter a repo (owner/repo)"); return; }
    const filePath = ghPath.trim() || `tokens/${filename}`;
    setGhPushing(true);
    setGhResult(null);
    try {
      const content = btoa(unescape(encodeURIComponent(output)));
      // Get current SHA if file exists (for update)
      const getRes = await fetch(
        `https://api.github.com/repos/${ghRepo}/contents/${filePath}?ref=${ghBranch}`,
        { headers: { Authorization: `token ${ghPat}`, Accept: "application/vnd.github.v3+json" } }
      );
      const sha = getRes.ok ? (await getRes.json()).sha as string | undefined : undefined;
      const putRes = await fetch(
        `https://api.github.com/repos/${ghRepo}/contents/${filePath}`,
        {
          method: "PUT",
          headers: { Authorization: `token ${ghPat}`, "Content-Type": "application/json", Accept: "application/vnd.github.v3+json" },
          body: JSON.stringify({
            message: `chore: update design tokens${version ? ` v${version}` : ""}`,
            content,
            branch: ghBranch,
            ...(sha ? { sha } : {}),
          }),
        }
      );
      if (putRes.ok) {
        setGhResult({ ok: true, message: `Pushed to ${ghRepo}/${filePath}` });
        toast.success("Pushed to GitHub");
      } else {
        const err = await putRes.json() as { message?: string };
        setGhResult({ ok: false, message: err.message ?? "Push failed" });
        toast.error(err.message ?? "Push failed");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setGhResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setGhPushing(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-7">
      <div>
        <h2 className="text-sm font-semibold">Export</h2>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Export {tokenCount} token{tokenCount !== 1 ? "s" : ""} in your preferred format.
        </p>
      </div>

      {/* Format picker */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFormat(f.id)}
            className={`p-3 rounded-xl border text-left transition-colors ${
              format === f.id
                ? "border-[var(--s-accent)] bg-[var(--s-accent)]/5"
                : "border-border hover:bg-accent"
            }`}
          >
            <div className={`text-[11px] font-semibold mb-0.5 ${format === f.id ? "text-[var(--s-accent)]" : ""}`}>{f.label}</div>
            <div className="text-[10px] text-muted-foreground">{f.description}</div>
          </button>
        ))}
      </div>

      {/* Version tag */}
      <div>
        <label className="text-[11px] font-semibold mb-1.5 block">Version tag <span className="font-normal text-muted-foreground">(optional)</span></label>
        <div className="flex items-center gap-2">
          <input
            value={version}
            onChange={(e) => handleVersionChange(e.target.value)}
            placeholder="e.g. 1.0.0"
            className="text-[12px] font-mono bg-background border rounded-md px-3 py-1.5 w-36 focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
          />
          {versionError && <span className="text-[10px] text-destructive">{versionError}</span>}
          {version && !versionError && <span className="text-[10px] text-green-600 dark:text-green-400">✓ {filename}</span>}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Adds a version comment header and includes semver in the downloaded filename.</p>
      </div>

      {/* Output */}
      <div className="rounded-xl border overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b">
          <span className="text-[11px] font-mono text-muted-foreground">{filename}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-[11px] px-2 py-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleDownload}
              className="text-[11px] px-2 py-1 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              Download
            </button>
          </div>
        </div>
        <pre className="p-4 text-[11px] font-mono text-foreground/80 overflow-auto max-h-96 bg-muted/20 leading-relaxed">
          {output || "// No tokens defined yet. Add tokens in the Tokens tab."}
        </pre>
      </div>

      {/* GitHub export */}
      <div className="rounded-xl border overflow-hidden">
        <div className="px-4 py-3 bg-muted/30 border-b flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-foreground/70"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
          <span className="text-[11px] font-semibold">Push to GitHub</span>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">Repository</label>
              <input
                value={ghRepo}
                onChange={(e) => setGhRepo(e.target.value)}
                placeholder="owner/repo"
                className="w-full text-[12px] font-mono bg-background border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">Branch</label>
              <input
                value={ghBranch}
                onChange={(e) => setGhBranch(e.target.value)}
                placeholder="main"
                className="w-full text-[12px] font-mono bg-background border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">File path in repo</label>
            <input
              value={ghPath}
              onChange={(e) => setGhPath(e.target.value)}
              placeholder={`tokens/${filename}`}
              className="w-full text-[12px] font-mono bg-background border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">GitHub PAT <span className="normal-case font-normal">(never stored)</span></label>
            <input
              ref={ghPatRef}
              type="password"
              value={ghPat}
              onChange={(e) => setGhPat(e.target.value)}
              placeholder="ghp_…"
              className="w-full text-[12px] font-mono bg-background border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--s-accent)]"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Requires <code className="text-[10px]">contents: write</code> scope on the target repo.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleGitHubPush}
              disabled={ghPushing}
              className="px-4 py-2 text-[11px] bg-[var(--s-accent)] text-white rounded-md hover:opacity-90 disabled:opacity-50 font-medium"
            >
              {ghPushing ? "Pushing…" : "Push to GitHub"}
            </button>
            {ghResult && (
              <span className={`text-[11px] ${ghResult.ok ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                {ghResult.ok ? "✓ " : "✗ "}{ghResult.message}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
