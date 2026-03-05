/**
 * Shared utility for converting Studio DS token objects into CSS custom
 * property declarations. Used by both CanvasTokenBridge (editor canvas) and
 * the preview page token bridge (preview iframe).
 */

type FlatVars = Record<string, string>;

/**
 * Flattens the raw token object from the DS into a map of CSS variable names
 * to values.
 *
 * Input shape (from studio-minimal-web.tokens.json):
 *   { color: { accent: { value: "#7c3aed" } }, spacing: { "4": { value: "16px" } }, ... }
 *
 * Output:
 *   { "--color-accent": "#7c3aed", "--spacing-4": "16px", ... }
 */
export function rawTokensToFlatVars(raw: Record<string, unknown>): FlatVars {
  const vars: FlatVars = {};

  for (const [category, tokens] of Object.entries(raw)) {
    if (typeof tokens !== "object" || tokens === null) continue;
    if (category === "textStyles") continue;

    for (const [key, tokenDef] of Object.entries(
      tokens as Record<string, unknown>
    )) {
      if (typeof tokenDef !== "object" || tokenDef === null) continue;
      const rawValue = (tokenDef as Record<string, unknown>).value;
      if (rawValue === undefined) continue;

      const value = String(rawValue);

      switch (category) {
        case "color":
          vars[`--color-${key}`] = value;
          break;
        case "spacing":
          vars[`--spacing-${key}`] = value;
          vars[`--space-${key}`] = value;
          break;
        case "radius":
          vars[`--radius-${key}`] = value;
          break;
        case "shadow":
          vars[`--shadow-${key}`] = value;
          break;
        case "typography":
          vars[`--${key}`] = value;
          break;
        default:
          vars[`--${category}-${key}`] = value;
      }
    }
  }

  return vars;
}

/**
 * Builds shadcn-compatible CSS variable aliases from Studio-namespaced vars.
 *
 * All files in apps/web/components/ui/ use shadcn variable names
 * (--primary, --background, --radius, etc.). Emitting these aliases means
 * every shadcn component responds to DS token changes without modification.
 */
export function buildShadcnAliases(vars: FlatVars): FlatVars {
  const aliases: FlatVars = {};

  const map = (alias: string, source: string, fallback?: string) => {
    const val = vars[source] ?? fallback;
    if (val) aliases[alias] = val;
  };

  map("--background", "--color-background");
  map("--foreground", "--color-foreground");
  map("--card", "--color-surface", vars["--color-background"]);
  map("--card-foreground", "--color-foreground");
  map("--popover", "--color-surface", vars["--color-background"]);
  map("--popover-foreground", "--color-foreground");
  map("--primary", "--color-accent");
  map("--primary-foreground", "--color-accent-foreground", "#ffffff");
  map("--secondary", "--color-muted");
  map("--secondary-foreground", "--color-foreground");
  map("--muted", "--color-muted");
  map("--muted-foreground", "--color-muted-foreground");
  map("--accent", "--color-accent-muted", vars["--color-muted"]);
  map("--accent-foreground", "--color-foreground");
  map("--destructive", "--color-error");
  if (vars["--color-error"]) aliases["--destructive-foreground"] = "#ffffff";
  map("--border", "--color-border");
  map("--input", "--color-border");
  map("--ring", "--color-accent");
  map("--radius", "--radius-md");

  return aliases;
}

/**
 * Builds the full CSS rule block from raw DS tokens.
 *
 * @param raw   The raw token object from the DS record.
 * @param scope CSS selector to scope the variables to. Use `[data-canvas-root]`
 *              for the editor canvas and `:root` for the preview iframe.
 */
export function buildTokenCSS(
  raw: Record<string, unknown>,
  scope = "[data-canvas-root]"
): string {
  const vars = rawTokensToFlatVars(raw);
  if (Object.keys(vars).length === 0) return "";

  const aliases = buildShadcnAliases(vars);
  const all = { ...vars, ...aliases };
  const entries = Object.entries(all);
  if (entries.length === 0) return "";

  const declarations = entries.map(([k, v]) => `  ${k}: ${v};`).join("\n");
  return `${scope} {\n${declarations}\n}`;
}
