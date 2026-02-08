import * as fs from "node:fs";
import * as path from "node:path";
import Ajv, { type ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import type { Gap, ScreenSpec } from "./types";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isGap = (value: unknown): value is Gap =>
  value === "xs" ||
  value === "sm" ||
  value === "md" ||
  value === "lg" ||
  value === "xl";

const fail = (path: string, message: string): never => {
  throw new Error(`${path}: ${message}`);
};

export function validateSpec(spec: unknown): asserts spec is ScreenSpec {
  const schemaValidator: ValidateFunction<ScreenSpec> | null =
    getSchemaValidator();
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

  validateSpecManual(spec);
}

let cachedValidator: ValidateFunction<ScreenSpec> | null | undefined;

const getSchemaValidator = (): ValidateFunction<ScreenSpec> | null => {
  if (cachedValidator !== undefined) {
    return cachedValidator ?? null;
  }

  try {
    const schemaPath = path.resolve(
      process.cwd(),
      "spec",
      "schema",
      "screen.schema.json"
    );
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

const validateSpecManual: (spec: unknown) => asserts spec is ScreenSpec = (
  spec
) => {
  if (!isRecord(spec)) {
    fail("spec", "must be an object");
  }
  const specRecord = spec as UnknownRecord;

  if (!isNonEmptyString(specRecord.id)) {
    fail("id", "must be a non-empty string");
  }

  if (specRecord.layout !== "stack") {
    fail("layout", 'must be "stack"');
  }

  if (specRecord.gap !== undefined && !isGap(specRecord.gap)) {
    fail("gap", 'must be one of "xs", "sm", "md", "lg", "xl"');
  }

  if (!Array.isArray(specRecord.children)) {
    fail("children", "must be an array");
  }

  (specRecord.children as unknown[]).forEach((child, index) => {
    validateNode(child, `children[${index}]`);
  });
};

const validateNode = (node: unknown, path: string): void => {
  if (!isRecord(node)) {
    fail(path, "must be an object");
  }
  const nodeRecord = node as UnknownRecord;

  if (!isNonEmptyString(nodeRecord.type)) {
    fail(`${path}.type`, "must be a non-empty string");
  }

  switch (nodeRecord.type) {
    case "heading":
      validateHeadingNode(nodeRecord, path);
      return;
    case "text":
      validateTextNode(nodeRecord, path);
      return;
    case "card":
      validateCardNode(nodeRecord, path);
      return;
    case "button":
      validateButtonNode(nodeRecord, path);
      return;
    case "stack":
      validateStackNode(nodeRecord, path);
      return;
    default:
      fail(`${path}.type`, `unsupported type "${String(nodeRecord.type)}"`);
  }
};

const validateHeadingNode = (node: UnknownRecord, path: string): void => {
  if (!isNonEmptyString(node.text)) {
    fail(`${path}.text`, "must be a non-empty string");
  }
  if (node.variant !== undefined && node.variant !== "heading") {
    fail(`${path}.variant`, 'must be "heading"');
  }
};

const validateTextNode = (node: UnknownRecord, path: string): void => {
  if (!isNonEmptyString(node.text)) {
    fail(`${path}.text`, "must be a non-empty string");
  }
  if (
    node.variant !== undefined &&
    node.variant !== "body" &&
    node.variant !== "muted"
  ) {
    fail(`${path}.variant`, 'must be "body" or "muted"');
  }
};

const validateCardNode = (node: UnknownRecord, path: string): void => {
  if (!Array.isArray(node.children)) {
    fail(`${path}.children`, "must be an array");
  }
  (node.children as unknown[]).forEach((child, index) => {
    validateNode(child, `${path}.children[${index}]`);
  });
};

const validateButtonNode = (node: UnknownRecord, path: string): void => {
  if (!isNonEmptyString(node.label)) {
    fail(`${path}.label`, "must be a non-empty string");
  }
  if (node.intent !== undefined && node.intent !== "primary") {
    fail(`${path}.intent`, 'must be "primary"');
  }
};

const validateStackNode = (node: UnknownRecord, path: string): void => {
  if (node.gap !== undefined && !isGap(node.gap)) {
    fail(`${path}.gap`, 'must be one of "xs", "sm", "md", "lg", "xl"');
  }
  if (!Array.isArray(node.children)) {
    fail(`${path}.children`, "must be an array");
  }
  (node.children as unknown[]).forEach((child, index) => {
    validateNode(child, `${path}.children[${index}]`);
  });
};
