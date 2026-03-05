/**
 * Codebase Scanner — 0.10.5 Brownfield Import
 *
 * Scans a React component library from three entry points:
 *   - local:  filesystem path (dev machine only)
 *   - npm:    published package via unpkg.com (no install required, works on Vercel)
 *   - github: GitHub repository via Contents API
 *
 * Extracts component names, TypeScript prop interfaces, variant unions,
 * Tailwind token colours/spacing, and CSS custom property tokens.
 */

import type { ScannedComponent, ScannedProp, ScanResult, BrownfieldSourceConfig } from "./types";

// ---------------------------------------------------------------------------
// Helpers — TypeScript / prop extraction (ts-morph optional import)
// ---------------------------------------------------------------------------

interface TsMorphProject {
  createSourceFile(path: string, content: string, opts: { overwrite: boolean }): TsMorphFile;
  getSourceFiles(): TsMorphFile[];
}
interface TsMorphFile {
  getExportedDeclarations(): Map<string, unknown[]>;
  getFilePath(): string;
}

async function createProject(): Promise<TsMorphProject | null> {
  try {
    const { Project } = await import("ts-morph");
    return new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true }) as unknown as TsMorphProject;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Common extraction utilities
// ---------------------------------------------------------------------------

/** Extract colour and spacing tokens from Tailwind config content (regex-based). */
export function extractTailwindTokens(content: string): Record<string, unknown> {
  const tokens: Record<string, unknown> = {};
  const color: Record<string, { value: string }> = {};
  const spacing: Record<string, { value: string }> = {};

  // Match color key-value pairs in colors: { ... } block
  const colorsBlock = content.match(/colors\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
  if (colorsBlock) {
    const entries = colorsBlock[1].matchAll(/['"]?([\w-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g);
    for (const [, key, value] of entries) {
      if (key && value) color[key] = { value };
    }
  }

  // Match spacing key-value pairs
  const spacingBlock = content.match(/spacing\s*:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
  if (spacingBlock) {
    const entries = spacingBlock[1].matchAll(/['"]?([\w-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g);
    for (const [, key, value] of entries) {
      if (key && value) spacing[key] = { value };
    }
  }

  if (Object.keys(color).length > 0) tokens.color = color;
  if (Object.keys(spacing).length > 0) tokens.spacing = spacing;
  return tokens;
}

/** Extract CSS custom property tokens from a CSS file (regex-based). */
export function extractCSSVarTokens(content: string): Record<string, unknown> {
  const color: Record<string, { value: string }> = {};
  const spacing: Record<string, { value: string }> = {};

  const entries = content.matchAll(/--([a-z][\w-]*):\s*([^;]+);/g);
  for (const [, key, rawValue] of entries) {
    const value = rawValue.trim();
    const isColor = /^(#[0-9a-f]{3,8}|rgb|hsl|oklch|color)/i.test(value);
    const isSpacing = /^[\d.]+(px|rem|em|%)$/.test(value);
    if (isColor) color[key] = { value };
    else if (isSpacing) spacing[key] = { value };
  }

  const tokens: Record<string, unknown> = {};
  if (Object.keys(color).length > 0) tokens.color = color;
  if (Object.keys(spacing).length > 0) tokens.spacing = spacing;
  return tokens;
}

/** Extract Storybook argTypes/args to supplement or replace ts-morph prop resolution. */
export function extractStorybookProps(content: string, componentName: string): ScannedProp[] | null {
  const argTypesMatch = content.match(/argTypes\s*:\s*(\{[\s\S]*?\}),?\s*\n/);
  if (!argTypesMatch) return null;

  const props: ScannedProp[] = [];
  const entries = argTypesMatch[1].matchAll(/(\w+)\s*:\s*\{([^}]*)\}/g);
  for (const [, propName, body] of entries) {
    const typeMatch = body.match(/type\s*:\s*['"]([^'"]+)['"]/);
    const controlMatch = body.match(/control\s*:\s*['"]([^'"]+)['"]/);
    props.push({
      name: propName,
      type: typeMatch?.[1] ?? controlMatch?.[1] ?? "unknown",
      required: false,
    });
  }

  return props.length > 0 ? props : null;
  // suppress unused warning
  void componentName;
}

/**
 * Use ts-morph to extract components and props from a set of source files.
 * Falls back to a simple regex approach if ts-morph is unavailable.
 */
async function extractComponentsFromSources(
  files: Array<{ path: string; content: string }>,
  importPathPrefix: string,
  /** When true, record the source file path on each ScannedComponent (local scan). */
  recordFilePaths = false,
): Promise<ScannedComponent[]> {
  const components: ScannedComponent[] = [];
  const project = await createProject();

  if (project) {
    // ts-morph path
    for (const { path: filePath, content } of files) {
      if (!filePath.match(/\.(tsx?|d\.ts)$/)) continue;
      try {
        const sf = project.createSourceFile(filePath, content, { overwrite: true });
        const exports = sf.getExportedDeclarations();

        for (const [name, decls] of exports) {
          if (!name[0] || name[0] !== name[0].toUpperCase()) continue; // PascalCase only
          const decl = decls[0] as Record<string, unknown> | undefined;
          if (!decl) continue;

          // Try to get props from the first parameter of a function/arrow
          const props: ScannedProp[] = [];
          const variants: string[] = [];
          let needsManualMapping = false;

          try {
            const getParams = (decl as { getParameters?: () => unknown[] }).getParameters;
            const params = typeof getParams === "function" ? getParams.call(decl) : [];
            if (Array.isArray(params) && params.length > 0) {
              const firstParam = params[0] as Record<string, unknown>;
              const getType = firstParam.getType as (() => Record<string, unknown>) | undefined;
              if (typeof getType === "function") {
                const paramType = getType.call(firstParam);
                const getProperties = paramType.getProperties as (() => unknown[]) | undefined;
                const typeProps = typeof getProperties === "function" ? getProperties.call(paramType) : [];
                for (const prop of typeProps as Array<Record<string, unknown>>) {
                  const getName = prop.getName as (() => string) | undefined;
                  const propName = typeof getName === "function" ? getName.call(prop) : "";
                  if (!propName || propName.startsWith("_")) continue;

                  const getDeclarations = prop.getDeclarations as (() => unknown[]) | undefined;
                  const propDecls = typeof getDeclarations === "function" ? getDeclarations.call(prop) : [];
                  const firstDecl = (propDecls[0] as Record<string, unknown> | undefined);
                  const getTypeNode = firstDecl?.getTypeNode as (() => Record<string, unknown> | undefined) | undefined;
                  const typeNode = typeof getTypeNode === "function" ? getTypeNode.call(firstDecl) : undefined;
                  const getText = typeNode?.getText as (() => string) | undefined;
                  const typeText = typeof getText === "function" ? getText.call(typeNode) : "unknown";

                  // Detect variant union: '"primary" | "secondary" | ...'
                  const unionValues = (typeText ?? "").match(/["']([^"']+)["']/g);
                  if (unionValues && unionValues.length >= 2 && propName === "variant") {
                    const vals = unionValues.map((v: string) => v.replace(/["']/g, ""));
                    variants.push(...vals);
                  }

                  const isOptional = (prop.isOptional as (() => boolean) | undefined);
                  props.push({
                    name: propName,
                    type: typeText ?? "unknown",
                    required: typeof isOptional === "function" ? !isOptional.call(prop) : false,
                  });
                }
              }
            }
          } catch {
            needsManualMapping = true;
          }

          components.push({
            name,
            importPath: importPathPrefix,
            props,
            variants,
            needsManualMapping: needsManualMapping || props.length === 0,
            ...(recordFilePaths ? { filePath, exportName: name } : {}),
          });
        }
      } catch {
        // skip malformed files
      }
    }
  } else {
    // Fallback: regex-based component detection
    for (const { path: filePath, content } of files) {
      if (!filePath.match(/\.(tsx?)$/)) continue;
      const exportMatches = content.matchAll(/export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z][a-zA-Z0-9]*)/g);
      for (const [, name] of exportMatches) {
        components.push({
          name,
          importPath: importPathPrefix,
          props: [],
          variants: [],
          needsManualMapping: true,
          ...(recordFilePaths ? { filePath, exportName: name } : {}),
        });
      }
    }
  }

  // De-duplicate by name
  const seen = new Set<string>();
  return components.filter((c) => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });
}

function mergeTokens(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const result = { ...a };
  for (const [key, val] of Object.entries(b)) {
    if (result[key] && typeof result[key] === "object" && typeof val === "object") {
      result[key] = { ...(result[key] as Record<string, unknown>), ...(val as Record<string, unknown>) };
    } else {
      result[key] = val;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Entry point A: Local path
// ---------------------------------------------------------------------------

export async function scanLocal(localPath: string, warnings: string[]): Promise<ScanResult> {
  const { readdir, readFile } = await import("fs/promises");
  const { join, extname } = await import("path");

  const files: Array<{ path: string; content: string }> = [];
  let tokens: Record<string, unknown> = {};

  async function walk(dir: string, depth = 0): Promise<void> {
    if (depth > 6) return;
    let entries: { name: string; isDirectory: () => boolean }[] = [];
    try {
      entries = await readdir(dir, { withFileTypes: true }) as typeof entries;
    } catch { return; }

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
      } else {
        const ext = extname(entry.name);
        if ([".tsx", ".ts", ".d.ts"].includes(ext)) {
          const content = await readFile(fullPath, "utf-8").catch(() => "");
          if (content) files.push({ path: fullPath, content });
        } else if (entry.name.match(/^tailwind\.config\.(ts|js|mjs)$/)) {
          const content = await readFile(fullPath, "utf-8").catch(() => "");
          if (content) tokens = mergeTokens(tokens, extractTailwindTokens(content));
        } else if (entry.name.match(/^(globals|variables|tokens?)\.css$/)) {
          const content = await readFile(fullPath, "utf-8").catch(() => "");
          if (content) tokens = mergeTokens(tokens, extractCSSVarTokens(content));
        } else if (entry.name === "tokens.json") {
          try {
            const content = await readFile(fullPath, "utf-8");
            const parsed = JSON.parse(content) as Record<string, unknown>;
            tokens = mergeTokens(tokens, parsed);
          } catch { /* skip */ }
        }
      }
    }
  }

  await walk(localPath);

  if (files.length === 0) {
    warnings.push(`No TypeScript source files found at path: ${localPath}`);
  }

  // Pass recordFilePaths=true so each component carries its source file path,
  // enabling studio:local canvas rendering in v0.10.9.
  const components = await extractComponentsFromSources(files, localPath, true);
  return {
    components,
    tokens,
    warnings,
    sourceConfig: { type: "local", path: localPath, scannedAt: new Date().toISOString() },
  };
}

// ---------------------------------------------------------------------------
// Entry point B: npm package (via unpkg.com, no install required)
// ---------------------------------------------------------------------------

export async function scanNpm(packageName: string, version = "latest", warnings: string[]): Promise<ScanResult> {
  const files: Array<{ path: string; content: string }> = [];
  let tokens: Record<string, unknown> = {};

  try {
    // Fetch package.json to find types field
    const pkgRes = await fetch(`https://unpkg.com/${packageName}@${version}/package.json`);
    if (!pkgRes.ok) {
      warnings.push(`Could not fetch package.json for ${packageName}@${version} from unpkg`);
      return { components: [], tokens: {}, warnings, sourceConfig: { type: "npm", packageName, packageVersion: version, scannedAt: new Date().toISOString() } };
    }

    const pkg = await pkgRes.json() as Record<string, unknown>;
    const typesField = (pkg.types ?? pkg.typings ?? pkg.exports) as string | undefined;

    if (typeof typesField === "string") {
      const typesUrl = `https://unpkg.com/${packageName}@${version}/${typesField.replace(/^\.\//, "")}`;
      const typesRes = await fetch(typesUrl);
      if (typesRes.ok) {
        const content = await typesRes.text();
        files.push({ path: typesField, content });
      } else {
        warnings.push(`Could not fetch types file: ${typesUrl}`);
      }
    } else {
      // Try common type file paths
      for (const candidate of ["index.d.ts", "dist/index.d.ts", "types/index.d.ts"]) {
        const url = `https://unpkg.com/${packageName}@${version}/${candidate}`;
        const res = await fetch(url);
        if (res.ok) {
          const content = await res.text();
          files.push({ path: candidate, content });
          break;
        }
      }
      if (files.length === 0) warnings.push(`No type declarations found for ${packageName}@${version}`);
    }

    // Check for Tailwind config
    const tailwindRes = await fetch(`https://unpkg.com/${packageName}@${version}/tailwind.config.js`);
    if (tailwindRes.ok) {
      const content = await tailwindRes.text();
      tokens = mergeTokens(tokens, extractTailwindTokens(content));
    }

    // Check for CSS tokens
    for (const cssCandidate of ["dist/globals.css", "styles/globals.css", "globals.css"]) {
      const cssRes = await fetch(`https://unpkg.com/${packageName}@${version}/${cssCandidate}`);
      if (cssRes.ok) {
        const content = await cssRes.text();
        tokens = mergeTokens(tokens, extractCSSVarTokens(content));
        break;
      }
    }
  } catch (err) {
    warnings.push(`Error scanning npm package ${packageName}: ${String(err)}`);
  }

  const components = await extractComponentsFromSources(files, packageName);
  return {
    components,
    tokens,
    warnings,
    sourceConfig: { type: "npm", packageName, packageVersion: version, scannedAt: new Date().toISOString() },
  };
}

// ---------------------------------------------------------------------------
// Entry point C: GitHub repository
// ---------------------------------------------------------------------------

const GITHUB_API = "https://api.github.com";

async function githubFetch(url: string, token: string): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
}

export async function scanGithub(
  owner: string,
  repo: string,
  branch: string,
  token: string,
  warnings: string[],
): Promise<ScanResult> {
  const files: Array<{ path: string; content: string }> = [];
  let tokens: Record<string, unknown> = {};
  const importPath = `@${owner}/${repo}`;

  try {
    // Get the tree recursively
    const treeRes = await githubFetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
      token,
    );
    if (!treeRes.ok) {
      warnings.push(`GitHub API error: ${treeRes.status} — check owner/repo/branch and PAT`);
      return { components: [], tokens: {}, warnings, sourceConfig: { type: "github", owner, repo, branch, scannedAt: new Date().toISOString() } };
    }

    type TreeItem = { path: string; type: string; url: string };
    const treeData = await treeRes.json() as { tree: TreeItem[] };
    const allFiles = treeData.tree ?? [];

    // Filter for relevant source files (cap at 200 to avoid rate limits)
    const sourceFiles = allFiles.filter((f) =>
      f.type === "blob" &&
      !f.path.includes("node_modules") &&
      !f.path.includes(".stories.") && // handled separately
      f.path.match(/\.(tsx?|d\.ts)$/) &&
      (f.path.includes("/components/") || f.path.includes("/src/") || f.path.match(/^(src|lib|packages)\//))
    ).slice(0, 200);

    const storybookFiles = allFiles.filter((f) =>
      f.type === "blob" && f.path.match(/\.stories\.tsx?$/)
    ).slice(0, 50);

    const configFiles = allFiles.filter((f) =>
      f.type === "blob" &&
      (f.path.match(/tailwind\.config\.(ts|js|mjs)$/) || f.path.match(/globals\.css$/) || f.path === "tokens.json")
    );

    // Fetch source files concurrently (batches of 10)
    async function fetchFileContent(item: TreeItem): Promise<string> {
      try {
        const res = await githubFetch(
          `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(item.path)}?ref=${branch}`,
          token,
        );
        if (!res.ok) return "";
        const data = await res.json() as { content?: string; encoding?: string };
        if (data.encoding === "base64" && data.content) {
          return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
        }
        return "";
      } catch { return ""; }
    }

    for (let i = 0; i < sourceFiles.length; i += 10) {
      const batch = sourceFiles.slice(i, i + 10);
      const results = await Promise.all(batch.map(async (f) => ({ path: f.path, content: await fetchFileContent(f) })));
      files.push(...results.filter((r) => r.content));
    }

    // Fetch storybook files for better prop resolution
    const storybookIndex = new Map<string, string>();
    for (let i = 0; i < storybookFiles.length; i += 5) {
      const batch = storybookFiles.slice(i, i + 5);
      const results = await Promise.all(batch.map(async (f) => ({ path: f.path, content: await fetchFileContent(f) })));
      for (const { path, content } of results.filter((r) => r.content)) {
        const nameMatch = path.match(/([A-Z][a-zA-Z0-9]*)\.stories\./);
        if (nameMatch?.[1]) storybookIndex.set(nameMatch[1], content);
      }
    }

    // Fetch config files
    for (const f of configFiles) {
      const content = await fetchFileContent(f);
      if (!content) continue;
      if (f.path.match(/tailwind\.config/)) tokens = mergeTokens(tokens, extractTailwindTokens(content));
      else if (f.path.match(/\.css$/)) tokens = mergeTokens(tokens, extractCSSVarTokens(content));
      else if (f.path === "tokens.json") {
        try { tokens = mergeTokens(tokens, JSON.parse(content) as Record<string, unknown>); } catch { /* skip */ }
      }
    }

    const components = await extractComponentsFromSources(files, importPath);

    // Apply Storybook props to components that need manual mapping
    for (const comp of components) {
      if (comp.needsManualMapping && storybookIndex.has(comp.name)) {
        const storyContent = storybookIndex.get(comp.name)!;
        const storyProps = extractStorybookProps(storyContent, comp.name);
        if (storyProps && storyProps.length > 0) {
          comp.props = storyProps;
          comp.needsManualMapping = false;
        }
      }
    }

    return {
      components,
      tokens,
      warnings,
      sourceConfig: { type: "github", owner, repo, branch, scannedAt: new Date().toISOString() },
    };
  } catch (err) {
    warnings.push(`Error scanning GitHub repo ${owner}/${repo}: ${String(err)}`);
    return { components: [], tokens: {}, warnings, sourceConfig: { type: "github", owner, repo, branch, scannedAt: new Date().toISOString() } };
  }
}

// ---------------------------------------------------------------------------
// Token diff computation (used by sync route, 0.10.6)
// ---------------------------------------------------------------------------

export function computeTokenDiff(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Array<{ key: string; category: string; status: "added" | "changed" | "removed"; oldValue?: string; newValue?: string }> {
  const diffs: ReturnType<typeof computeTokenDiff> = [];

  function flattenTokens(tokens: Record<string, unknown>, prefix = ""): Map<string, string> {
    const flat = new Map<string, string>();
    for (const [key, val] of Object.entries(tokens)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (val && typeof val === "object" && "value" in (val as Record<string, unknown>)) {
        const v = (val as Record<string, unknown>).value;
        flat.set(fullKey, String(v));
      } else if (val && typeof val === "object" && !("value" in (val as Record<string, unknown>))) {
        flattenTokens(val as Record<string, unknown>, fullKey).forEach((v, k) => flat.set(k, v));
      }
    }
    return flat;
  }

  const currentFlat = flattenTokens(current);
  const incomingFlat = flattenTokens(incoming);
  const allKeys = new Set([...currentFlat.keys(), ...incomingFlat.keys()]);

  for (const key of allKeys) {
    const category = key.split(".")[0] ?? "other";
    const oldValue = currentFlat.get(key);
    const newValue = incomingFlat.get(key);

    if (!oldValue && newValue) {
      diffs.push({ key, category, status: "added", newValue });
    } else if (oldValue && !newValue) {
      diffs.push({ key, category, status: "removed", oldValue });
    } else if (oldValue && newValue && oldValue !== newValue) {
      diffs.push({ key, category, status: "changed", oldValue, newValue });
    }
  }

  return diffs.sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key));
}
