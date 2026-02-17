import * as fs from "node:fs";
import * as path from "node:path";
import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { loadConfig, resolveFromRoot } from "./config";
import type { Gap, Node, ScreenSpec } from "./types";

type UnknownRecord = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isGap = (value: unknown): value is Gap =>
  value === "xs" ||
  value === "sm" ||
  value === "md" ||
  value === "lg" ||
  value === "xl";

const BUILT_IN_TYPES = new Set([
  "Stack",
  "Grid",
  "Section",
  "ScrollArea",
  "Spacer",
  "Heading",
  "Text",
  "Image",
  "Input",
  "Link",
  "Divider",
  "List",
  "Card",
  "Button",
  "Form",
  "Modal",
  "Tabs",
  "Nav",
  "DataTable",
  "Icon",
]);

const fail = (path: string, message: string): never => {
  throw new Error(`${path}: ${message}`);
};

// ---------------------------------------------------------------------------
// Schema-based validation (primary)
// ---------------------------------------------------------------------------

let cachedValidator: ValidateFunction<ScreenSpec> | null | undefined;

const getSchemaValidator = (): ValidateFunction<ScreenSpec> | null => {
  if (cachedValidator !== undefined) {
    return cachedValidator ?? null;
  }

  try {
    const config = loadConfig();
    const schemaPath = resolveFromRoot(config.schemaPath);
    const raw = fs.readFileSync(schemaPath, "utf8");
    const schema = JSON.parse(raw) as object;
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    cachedValidator = ajv.compile<ScreenSpec>(schema);
    return cachedValidator;
  } catch {
    cachedValidator = null;
    return null;
  }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function validateSpec(spec: unknown): asserts spec is ScreenSpec {
  const schemaValidator = getSchemaValidator();
  if (schemaValidator) {
    const ok = schemaValidator(spec);
    if (!ok) {
      const errors = schemaValidator.errors ?? [];
      const lines = errors.map((error) => {
        const instancePath = error.instancePath || "spec";
        const message = error.message ?? "is invalid";
        return `${instancePath} ${message}`.trim();
      });
      throw new Error(lines.join("\n"));
    }
    return;
  }

  // Fallback: manual validation
  validateSpecManual(spec);
}

// ---------------------------------------------------------------------------
// Manual validation fallback
// ---------------------------------------------------------------------------

function validateSpecManual(spec: unknown): asserts spec is ScreenSpec {
  if (!isRecord(spec)) {
    fail("spec", "must be an object");
  }
  const s = spec as UnknownRecord;

  if (s.version !== 1) {
    fail("version", "must be 1");
  }

  if (typeof s.route !== "string" || !s.route.startsWith("/")) {
    fail("route", 'must be a string starting with "/"');
  }

  if (s.meta !== undefined) {
    if (!isRecord(s.meta)) {
      fail("meta", "must be an object");
    }
  }

  if (!isRecord(s.tree)) {
    fail("tree", "must be a node object");
  }

  validateNode(s.tree as UnknownRecord, "tree");
}

function validateNode(nodeUnknown: unknown, nodePath: string): void {
  if (!isRecord(nodeUnknown)) {
    fail(nodePath, "must be an object");
  }
  const node = nodeUnknown as UnknownRecord;

  if (!isNonEmptyString(node.id)) {
    fail(`${nodePath}.id`, "must be a non-empty string");
  }

  if (!isNonEmptyString(node.type)) {
    fail(`${nodePath}.type`, "must be a non-empty string");
  }

  const type = node.type as string;

  // Props must be an object if present
  if (node.props !== undefined && !isRecord(node.props)) {
    fail(`${nodePath}.props`, "must be an object");
  }

  // Children must be an array if present
  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) {
      fail(`${nodePath}.children`, "must be an array");
    }
    (node.children as unknown[]).forEach((child, index) => {
      validateNode(child, `${nodePath}.children[${index}]`);
    });
  }

  // Interactions field (optional object)
  if (node.interactions !== undefined && !isRecord(node.interactions)) {
    fail(`${nodePath}.interactions`, "must be an object");
  }

  // DataSource field (optional object)
  if (node.dataSource !== undefined && !isRecord(node.dataSource)) {
    fail(`${nodePath}.dataSource`, "must be an object");
  }

  // Style field (optional object)
  if (node.style !== undefined && !isRecord(node.style)) {
    fail(`${nodePath}.style`, "must be an object");
  }

  // Type-specific validation
  if (BUILT_IN_TYPES.has(type)) {
    validateBuiltInNode(node, type, nodePath);
  }
  // Repo components: any type string is accepted, props are passed through
}

// ---------------------------------------------------------------------------
// Props type definitions for built-in nodes
// ---------------------------------------------------------------------------

type PropDef = {
  type: "string" | "number" | "boolean" | "array";
  required?: boolean;
  enum?: unknown[];
};

const ALLOWED_PROPS: Record<string, Record<string, PropDef>> = {
  Stack: {
    gap: { type: "string" },
    padding: { type: "string" },
    direction: { type: "string", enum: ["row", "column"] },
  },
  Grid: {
    columns: { type: "number" },
    gap: { type: "string" },
  },
  Section: {
    padding: { type: "string" },
  },
  ScrollArea: {
    height: { type: "string" },
  },
  Spacer: {
    size: { type: "string", enum: ["xs", "sm", "md", "lg", "xl"] },
  },
  Heading: {
    text: { type: "string" },
    level: { type: "number" },
    variant: { type: "string", enum: ["hero", "title", "subtitle", "section", ""] },
    fontFamily: { type: "string" },
  },
  Text: {
    text: { type: "string" },
    variant: { type: "string", enum: ["body", "muted"] },
    fontFamily: { type: "string" },
  },
  Image: {
    src: { type: "string", required: true },
    alt: { type: "string", required: true },
    width: { type: "number" },
    height: { type: "number" },
  },
  Input: {
    placeholder: { type: "string" },
    type: { type: "string", enum: ["text", "email", "password", "number", "tel", "url"] },
    label: { type: "string" },
  },
  Link: {
    href: { type: "string", required: true },
    text: { type: "string" },
  },
  Divider: {},
  List: {
    items: { type: "array" },
    ordered: { type: "boolean" },
  },
  Card: {
    padding: { type: "string" },
  },
  Button: {
    label: { type: "string" },
    intent: { type: "string", enum: ["default", "primary", "secondary", "destructive", "outline", "ghost", "link"] },
    size: { type: "string", enum: ["default", "xs", "sm", "lg", "icon"] },
  },
  Form: {
    action: { type: "string" },
    method: { type: "string" },
  },
  Modal: {
    title: { type: "string" },
    open: { type: "boolean" },
  },
  Tabs: {
    tabs: { type: "array" },
  },
  Nav: {
    orientation: { type: "string", enum: ["horizontal", "vertical"] },
    items: { type: "array" },
  },
  DataTable: {
    columns: { type: "array" },
    rows: { type: "array" },
  },
  Icon: {
    name: { type: "string", required: true },
    size: { type: "number" },
    color: { type: "string" },
  },
};

// Container types that require children
const CONTAINER_TYPES = new Set(["Stack", "Grid", "Section", "ScrollArea", "Card", "Form", "Modal", "Tabs", "Nav"]);

function validateBuiltInNode(
  node: UnknownRecord,
  type: string,
  nodePath: string
): void {
  // Check container types have children
  if (CONTAINER_TYPES.has(type) && !Array.isArray(node.children)) {
    fail(`${nodePath}.children`, `${type} requires children`);
  }

  const props = (node.props ?? {}) as UnknownRecord;
  const allowed = ALLOWED_PROPS[type];
  if (!allowed) return;

  // Check for unknown props
  for (const key of Object.keys(props)) {
    if (!(key in allowed)) {
      fail(
        `${nodePath}.props.${key}`,
        `unknown prop "${key}" for ${type}. Allowed: ${Object.keys(allowed).join(", ") || "none"}`
      );
    }
  }

  // Validate each prop against its definition
  for (const [key, def] of Object.entries(allowed)) {
    const value = props[key];

    // Required check
    if (def.required && (value === undefined || value === null)) {
      fail(`${nodePath}.props.${key}`, `is required for ${type}`);
    }

    if (value === undefined) continue;

    // Type check
    if (def.type === "string" && typeof value !== "string") {
      fail(`${nodePath}.props.${key}`, "must be a string");
    }
    if (def.type === "number" && typeof value !== "number") {
      fail(`${nodePath}.props.${key}`, "must be a number");
    }
    if (def.type === "boolean" && typeof value !== "boolean") {
      fail(`${nodePath}.props.${key}`, "must be a boolean");
    }
    if (def.type === "array" && !Array.isArray(value)) {
      fail(`${nodePath}.props.${key}`, "must be an array");
    }

    // Enum check
    if (def.enum && !def.enum.includes(value)) {
      fail(
        `${nodePath}.props.${key}`,
        `must be one of: ${def.enum.map((v) => `"${v}"`).join(", ")}`
      );
    }
  }
}

/** Clear cached schema validator (useful for tests). */
export function clearValidatorCache(): void {
  cachedValidator = undefined;
}
