/**
 * Alias-aware token resolver for the DS workspace.
 *
 * Token values starting with "$" are alias references using dot-path notation:
 *   "$color.blue-500"  ->  resolves to the value of tokens.color["blue-500"].value
 *
 * Chains are followed up to MAX_DEPTH levels deep to prevent infinite loops.
 */

type TokenEntry = { value: unknown; description?: string };
type TokenGroup = Record<string, TokenEntry>;
type TokenStore = Record<string, TokenGroup>;

const MAX_DEPTH = 8;

/**
 * Resolve a token value, following alias chains.
 * Returns { resolved, chain } where chain is the sequence of references traversed.
 */
export function resolveTokenValue(
  value: unknown,
  tokens: TokenStore,
  depth = 0
): { resolved: string | number | null; chain: string[] } {
  if (depth > MAX_DEPTH) return { resolved: null, chain: [] };

  // Dual-value: pick web side for display
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const dual = value as { web?: string; native?: number };
    if (dual.web !== undefined) {
      return resolveTokenValue(dual.web, tokens, depth);
    }
  }

  if (typeof value === "number") return { resolved: value, chain: [] };
  if (typeof value !== "string") return { resolved: null, chain: [] };

  if (!value.startsWith("$")) return { resolved: value, chain: [] };

  const path = value.slice(1); // strip "$"
  const segments = path.split(".");
  if (segments.length < 2) return { resolved: null, chain: [value] };

  const [group, ...rest] = segments;
  const key = rest.join(".");
  const entry = tokens[group]?.[key];
  if (!entry) return { resolved: null, chain: [value] };

  const next = resolveTokenValue(entry.value, tokens, depth + 1);
  return { resolved: next.resolved, chain: [value, ...next.chain] };
}

/**
 * Resolve all alias values in a token store, returning a flat map of
 * "group.key" -> final resolved value (string or number).
 */
export function buildResolvedMap(tokens: TokenStore): Record<string, string | number> {
  const map: Record<string, string | number> = {};
  for (const [group, entries] of Object.entries(tokens)) {
    for (const [key, entry] of Object.entries(entries)) {
      const { resolved } = resolveTokenValue(entry.value, tokens);
      if (resolved !== null) {
        map[`${group}.${key}`] = resolved;
      }
    }
  }
  return map;
}

/**
 * Get all token path options for the alias dropdown,
 * formatted as "$group.key".
 */
export function getAliasOptions(tokens: TokenStore): string[] {
  const options: string[] = [];
  for (const [group, entries] of Object.entries(tokens)) {
    for (const key of Object.keys(entries)) {
      options.push(`$${group}.${key}`);
    }
  }
  return options;
}
