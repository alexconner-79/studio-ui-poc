/**
 * shadcn/ui component adapter.
 *
 * Maps Studio node types to shadcn/ui component imports and props.
 */

import type {
  ComponentAdapter,
  ImportSpec,
} from "./component-adapter";

// ---------------------------------------------------------------------------
// Import map
// ---------------------------------------------------------------------------

const IMPORTS: Record<string, ImportSpec> = {
  Button: { specifier: "Button", source: "components/ui/button" },
  Card: { specifier: "Card", source: "components/ui/card" },
  Input: { specifier: "Input", source: "components/ui/input" },
  ScrollArea: { specifier: "ScrollArea", source: "components/ui/scroll-area" },
  Separator: { specifier: "Separator", source: "components/ui/separator" },
};

// Tag name overrides (e.g. Divider -> Separator in shadcn)
const TAG_NAMES: Record<string, string> = {
  Divider: "Separator",
};

// Prop renames (spec prop name -> shadcn prop name)
const PROP_RENAMES: Record<string, Record<string, string>> = {
  Button: { intent: "variant" },
};

// Prop value transforms
const VALUE_MAPS: Record<string, Record<string, Record<string, string>>> = {
  Button: {
    intent: {
      primary: "default",
    },
  },
};

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

export const shadcnAdapter: ComponentAdapter = {
  name: "shadcn",

  resolveImport(nodeType: string, importAlias: string): ImportSpec | null {
    // Divider maps to Separator
    const lookupType = TAG_NAMES[nodeType] ?? nodeType;
    const entry = IMPORTS[lookupType];
    if (!entry) return null;

    return {
      specifier: entry.specifier,
      source: `${importAlias}${entry.source}`,
      isDefault: entry.isDefault,
    };
  },

  transformProps(
    nodeType: string,
    props: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = { ...props };
    const renames = PROP_RENAMES[nodeType];
    const valueMaps = VALUE_MAPS[nodeType];

    if (renames) {
      for (const [from, to] of Object.entries(renames)) {
        if (from in result) {
          result[to] = result[from];
          delete result[from];
        }
      }
    }

    if (valueMaps) {
      for (const [propName, mapping] of Object.entries(valueMaps)) {
        const val = result[propName];
        if (typeof val === "string" && val in mapping) {
          result[propName] = mapping[val];
        }
      }
    }

    return result;
  },

  getTagName(nodeType: string): string | null {
    return TAG_NAMES[nodeType] ?? null;
  },
};
