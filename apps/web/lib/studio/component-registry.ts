/**
 * Component registry for live canvas rendering.
 *
 * Maps importPath values from ComponentInstance nodes to their corresponding
 * npm package dynamic imports. Only web-renderable libraries are listed here;
 * native-only libraries are in NATIVE_PATHS and show an informational badge.
 *
 * v0.10.9: Added studio:local — brownfield component files are transpiled
 * on-demand by the bundle API and evaluated via a CJS require shim.
 */

import type React from "react";

// importPaths that can be live-rendered in the web canvas
// "studio:shadcn"  — Studio's own shadcn reference copies
// "studio:template"— Studio's own template component implementations
// "studio:local"   — user-owned component files, transpiled via bundle API
export const SUPPORTED_WEB_PATHS = new Set([
  "antd",
  "@mui/material",
  "studio:shadcn",
  "studio:template",
  "studio:local",
]);

// importPaths that are native-only and cannot be rendered in the web canvas
export const NATIVE_PATHS = new Set([
  "react-native-paper",
  "@react-native-community/ios-hig",
]);

type ComponentModule = Record<string, React.ComponentType<Record<string, unknown>>>;

// Standard module cache: importPath → loaded module
const moduleCache = new Map<string, ComponentModule>();
// Per-file cache for studio:local: filePath → loaded module
// Separate from moduleCache so individual files can be invalidated on change.
const localFileCache = new Map<string, ComponentModule>();
const pendingLoads = new Map<string, Promise<ComponentModule | null>>();

// ---------------------------------------------------------------------------
// CJS require shim for studio:local bundles
// The bundle API compiles user component files to CommonJS with React and
// common peer-deps as externals. This shim provides those at evaluation time
// so the component shares the same React instance as the Studio canvas.
// ---------------------------------------------------------------------------

type RequireFn = (mod: string) => unknown;

function buildRequireShim(): RequireFn {
  // Lazy module bag — loaded on first require() call per module.
  // Keys must match the externals list in bundle/route.ts.
  const bag: Record<string, (() => Promise<unknown>) | undefined> = {
    react:               () => import("react"),
    "react-dom":         () => import("react-dom"),
    "react/jsx-runtime": () => import("react/jsx-runtime"),
    "react/jsx-dev-runtime": () => import("react/jsx-runtime"), // alias
  };

  // Synchronous cache for modules already resolved
  const resolved = new Map<string, unknown>();

  // Pre-warm React synchronously — it should already be in the module system
  // so there is no real async work here; this just populates `resolved`.
  // We use a fire-and-forget since the shim is only called after the bundle
  // is fetched (which is async), giving React time to resolve.
  for (const [key, loader] of Object.entries(bag)) {
    if (loader) {
      loader().then((mod) => resolved.set(key, mod)).catch(() => {});
    }
  }

  return (mod: string): unknown => {
    if (resolved.has(mod)) return resolved.get(mod);
    // Graceful degradation for unrecognised modules — return empty object
    // rather than throwing, so the component still attempts to render.
    console.warn(`[studio:local] require("${mod}") — module not pre-loaded; returning stub`);
    return {};
  };
}

const requireShim = buildRequireShim();

/**
 * Evaluate a CJS bundle returned by the bundle API and return its exports
 * as a ComponentModule.
 */
function evaluateCJSBundle(code: string): ComponentModule {
  const moduleExports: Record<string, unknown> = {};
  const moduleObj = { exports: moduleExports };

  try {
    // eslint-disable-next-line no-new-func
    new Function("require", "module", "exports", "__dirname", "__filename", code)(
      requireShim,
      moduleObj,
      moduleExports,
      "/",
      "/index.js",
    );
  } catch (err) {
    console.error("[studio:local] Error evaluating bundle:", err);
  }

  // The bundle may store exports on module.exports (object) or as named keys
  const result = (moduleObj.exports ?? moduleExports) as Record<string, unknown>;
  return result as ComponentModule;
}

// ---------------------------------------------------------------------------
// Module loader
// ---------------------------------------------------------------------------

async function loadModule(importPath: string): Promise<ComponentModule | null> {
  if (importPath === "antd") {
    return import("antd") as unknown as ComponentModule;
  }
  if (importPath === "@mui/material") {
    return import("@mui/material") as unknown as ComponentModule;
  }
  if (importPath === "studio:template") {
    return import("@/lib/studio/studio-template-components") as unknown as Promise<ComponentModule>;
  }
  if (importPath === "studio:shadcn") {
    // Load Studio's own shadcn reference copies from apps/web/components/ui/
    // These are standard shadcn templates installed via the shadcn CLI.
    // They render correctly for unmodified shadcn; users with customised
    // components will see the standard reference until v0.10.9 ships.
    const modules = await Promise.all([
      import("@/components/ui/accordion").catch(() => null),
      import("@/components/ui/alert").catch(() => null),
      import("@/components/ui/alert-dialog").catch(() => null),
      import("@/components/ui/aspect-ratio").catch(() => null),
      import("@/components/ui/avatar").catch(() => null),
      import("@/components/ui/badge").catch(() => null),
      import("@/components/ui/breadcrumb").catch(() => null),
      import("@/components/ui/button").catch(() => null),
      import("@/components/ui/calendar").catch(() => null),
      import("@/components/ui/card").catch(() => null),
      import("@/components/ui/carousel").catch(() => null),
      import("@/components/ui/checkbox").catch(() => null),
      import("@/components/ui/collapsible").catch(() => null),
      import("@/components/ui/command").catch(() => null),
      import("@/components/ui/context-menu").catch(() => null),
      import("@/components/ui/dialog").catch(() => null),
      import("@/components/ui/drawer").catch(() => null),
      import("@/components/ui/dropdown-menu").catch(() => null),
      import("@/components/ui/form").catch(() => null),
      import("@/components/ui/hover-card").catch(() => null),
      import("@/components/ui/input").catch(() => null),
      import("@/components/ui/input-otp").catch(() => null),
      import("@/components/ui/label").catch(() => null),
      import("@/components/ui/menubar").catch(() => null),
      import("@/components/ui/navigation-menu").catch(() => null),
      import("@/components/ui/pagination").catch(() => null),
      import("@/components/ui/popover").catch(() => null),
      import("@/components/ui/progress").catch(() => null),
      import("@/components/ui/radio-group").catch(() => null),
      import("@/components/ui/resizable").catch(() => null),
      import("@/components/ui/scroll-area").catch(() => null),
      import("@/components/ui/select").catch(() => null),
      import("@/components/ui/separator").catch(() => null),
      import("@/components/ui/sheet").catch(() => null),
      import("@/components/ui/sidebar").catch(() => null),
      import("@/components/ui/skeleton").catch(() => null),
      import("@/components/ui/slider").catch(() => null),
      import("@/components/ui/sonner").catch(() => null),
      import("@/components/ui/switch").catch(() => null),
      import("@/components/ui/table").catch(() => null),
      import("@/components/ui/tabs").catch(() => null),
      import("@/components/ui/textarea").catch(() => null),
      import("@/components/ui/toggle").catch(() => null),
      import("@/components/ui/toggle-group").catch(() => null),
      import("@/components/ui/tooltip").catch(() => null),
    ]);
    const combined: ComponentModule = {};
    for (const mod of modules) {
      if (mod) Object.assign(combined, mod);
    }
    return Object.keys(combined).length > 0 ? combined : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Asynchronously resolves a React component from a supported library.
 * Results are cached at the module level so the library is only loaded once.
 * Returns null if the importPath is unsupported or the component doesn't exist.
 *
 * For studio:local, pass filePath (the absolute path to the component's source
 * file) so the registry can load and cache it per-file.
 */
export async function getComponent(
  importPath: string,
  componentName: string,
  filePath?: string,
): Promise<React.ComponentType<Record<string, unknown>> | null> {
  // ---------------------------------------------------------------------------
  // studio:local — brownfield user-owned component files
  // ---------------------------------------------------------------------------
  if (importPath === "studio:local") {
    if (!filePath) {
      console.warn("[studio:local] getComponent called without filePath");
      return null;
    }

    // Check per-file cache first
    const cachedModule = localFileCache.get(filePath);
    if (cachedModule) {
      return (cachedModule[componentName] ?? cachedModule["default"] ?? null) as
        | React.ComponentType<Record<string, unknown>>
        | null;
    }

    // Deduplicate concurrent loads for the same file
    const pendingKey = `studio:local:${filePath}`;
    if (!pendingLoads.has(pendingKey)) {
      pendingLoads.set(
        pendingKey,
        (async (): Promise<ComponentModule | null> => {
          try {
            const res = await fetch("/api/studio/components/bundle", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ filePath, exportName: componentName }),
            });

            if (!res.ok) {
              const { error } = (await res.json().catch(() => ({}))) as { error?: string };
              console.error(`[studio:local] Bundle failed for ${filePath}: ${error ?? res.statusText}`);
              return null;
            }

            const { code } = (await res.json()) as { code: string };
            if (!code) return null;

            const mod = evaluateCJSBundle(code);
            localFileCache.set(filePath, mod);
            return mod;
          } catch (err) {
            console.error(`[studio:local] Fetch/evaluate error for ${filePath}:`, err);
            return null;
          } finally {
            pendingLoads.delete(pendingKey);
          }
        })(),
      );
    }

    const mod = await pendingLoads.get(pendingKey);
    if (!mod) return null;

    return (mod[componentName] ?? mod["default"] ?? null) as
      | React.ComponentType<Record<string, unknown>>
      | null;
  }

  // ---------------------------------------------------------------------------
  // Standard library paths
  // ---------------------------------------------------------------------------
  if (!SUPPORTED_WEB_PATHS.has(importPath)) return null;

  if (!moduleCache.has(importPath)) {
    // Deduplicate concurrent load requests for the same importPath
    if (!pendingLoads.has(importPath)) {
      pendingLoads.set(
        importPath,
        loadModule(importPath).then((mod) => {
          if (mod) moduleCache.set(importPath, mod);
          pendingLoads.delete(importPath);
          return mod;
        }),
      );
    }
    await pendingLoads.get(importPath);
  }

  const mod = moduleCache.get(importPath);
  if (!mod) return null;

  if (mod[componentName]) return mod[componentName] ?? null;

  // studio:template compositions may reference shadcn components (Accordion,
  // Badge, Card etc.) without an explicit importPath. Fall back to studio:shadcn.
  if (importPath === "studio:template") {
    return getComponent("studio:shadcn", componentName);
  }

  // Conversely, some components (Link, Combobox, DatePicker etc.) are stored as
  // studio:shadcn in older DS records but were re-homed to studio:template.
  // Fall back so the live preview and canvas both work without requiring a DB migration.
  if (importPath === "studio:shadcn") {
    return getComponent("studio:template", componentName);
  }

  return null;
}

/**
 * Invalidate the studio:local cache entry for a specific file.
 * Called by live-node.tsx when the SSE watch stream reports a file change.
 */
export function invalidateLocalFile(filePath: string): void {
  localFileCache.delete(filePath);
  pendingLoads.delete(`studio:local:${filePath}`);
}

/**
 * Build the props object to pass to a live component, merging selectedVariants
 * and componentProps while stripping Studio-internal fields.
 */
export function buildLiveProps(
  nodeProps: Record<string, unknown>,
): Record<string, unknown> {
  const INTERNAL_KEYS = new Set([
    "componentName",
    "importPath",
    "selectedVariants",
    "componentProps",
    "dsComponentName",
    "filePath",
    "exportName",
  ]);

  const selectedVariants =
    typeof nodeProps.selectedVariants === "object" && nodeProps.selectedVariants !== null
      ? (nodeProps.selectedVariants as Record<string, string>)
      : {};

  const componentProps =
    typeof nodeProps.componentProps === "object" && nodeProps.componentProps !== null
      ? (nodeProps.componentProps as Record<string, unknown>)
      : {};

  const result: Record<string, unknown> = {};

  // Start with any flat props that aren't internal
  for (const [k, v] of Object.entries(nodeProps)) {
    if (!INTERNAL_KEYS.has(k)) {
      result[k] = v;
    }
  }

  // selectedVariants override (string values — correct for library string/enum props)
  Object.assign(result, selectedVariants);

  // componentProps override (typed values — booleans, numbers, etc.)
  Object.assign(result, componentProps);

  // Slider: Radix requires defaultValue as number[], not a plain number.
  if (typeof result.defaultValue === "number" && !Array.isArray(result.defaultValue)) {
    result.defaultValue = [result.defaultValue];
  }

  // Strip boolean values for props that are NOT valid HTML boolean attributes.
  //
  // `false`: stripping has no effect — the component's own default is false.
  // `true`:  some Radix v1.x components (e.g. Accordion's `collapsible`) don't
  //   strip their boolean props before spreading to the underlying DOM element,
  //   causing React to warn "Received `true` for a non-boolean attribute".
  //   Stripping these for canvas rendering is safe — the component still renders
  //   correctly, just without that particular behaviour toggle.
  //
  // We keep a whitelist of React props that ARE safe to pass as `true`:
  //   - Standard HTML booleans (disabled, checked, hidden…)
  //   - React synthetic booleans (defaultChecked, defaultOpen)
  //   - Radix props that are known to be handled correctly without DOM leakage
  const HTML_BOOL_ATTRS = new Set([
    // Standard HTML boolean attributes
    "disabled", "checked", "required", "readOnly", "autoFocus",
    "hidden", "multiple", "selected", "open", "defaultChecked",
    // React/Radix props that do NOT leak to DOM and are needed for correct rendering
    "defaultOpen", "asChild", "modal",
  ]);
  for (const key of Object.keys(result)) {
    if (typeof result[key] === "boolean" && !HTML_BOOL_ATTRS.has(key)) {
      delete result[key];
    }
  }

  return result;
}
