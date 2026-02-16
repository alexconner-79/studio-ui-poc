/**
 * Spec linter -- standalone command that checks specs for common issues
 * without running a full compile.
 *
 * Usage: ts-node compiler/lint.ts
 */

import * as path from "node:path";
import chalk from "chalk";
import { discoverScreens } from "./discover";
import { validateSpec } from "./validate";
import type { Node } from "./types";

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

type Severity = "error" | "warn";

type LintIssue = {
  file: string;
  severity: Severity;
  rule: string;
  message: string;
};

// -------------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------------

function collectNodeIds(
  node: Node,
  ids: Map<string, string[]>,
  nodePath: string
): void {
  const existing = ids.get(node.id);
  if (existing) {
    existing.push(nodePath);
  } else {
    ids.set(node.id, [nodePath]);
  }

  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      collectNodeIds(
        node.children[i],
        ids,
        `${nodePath}.children[${i}]`
      );
    }
  }
}

function walkNodes(
  node: Node,
  visitor: (node: Node, nodePath: string, parent?: Node) => void,
  nodePath: string = "tree",
  parent?: Node
): void {
  visitor(node, nodePath, parent);
  if (node.children) {
    for (let i = 0; i < node.children.length; i++) {
      walkNodes(
        node.children[i],
        visitor,
        `${nodePath}.children[${i}]`,
        node
      );
    }
  }
}

// -------------------------------------------------------------------------
// Per-screen lint rules
// -------------------------------------------------------------------------

function lintScreen(
  filePath: string,
  spec: unknown,
  issues: LintIssue[]
): void {
  const relPath = path.relative(process.cwd(), filePath);

  // 1. Schema validation
  try {
    validateSpec(spec);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    issues.push({
      file: relPath,
      severity: "error",
      rule: "schema",
      message,
    });
    // If schema validation fails, skip further lint rules since the
    // structure may not be safe to traverse.
    return;
  }

  // Cast is safe after validateSpec succeeds
  const validSpec = spec as { route: string; tree: Node };

  // 2. Duplicate node IDs within this screen
  const idMap = new Map<string, string[]>();
  collectNodeIds(validSpec.tree, idMap, "tree");

  idMap.forEach((locations, id) => {
    if (locations.length > 1) {
      issues.push({
        file: relPath,
        severity: "error",
        rule: "duplicate-id",
        message: `Node ID "${id}" is used ${locations.length} times: ${locations.join(", ")}`,
      });
    }
  });

  // 3. Walk the tree for node-level rules
  const headingLevelsSeen = new Set<number>();

  walkNodes(validSpec.tree, (node, nodePath) => {
    // Empty children arrays
    if (node.children && node.children.length === 0) {
      issues.push({
        file: relPath,
        severity: "warn",
        rule: "empty-children",
        message: `${nodePath}: Empty children array -- omit the key instead of using []`,
      });
    }

    const props = node.props ?? {};

    // Heading hierarchy gaps
    if (node.type === "Heading") {
      const level = (props.level as number) ?? 1;
      headingLevelsSeen.add(level);
      if (level > 1 && !headingLevelsSeen.has(level - 1)) {
        issues.push({
          file: relPath,
          severity: "warn",
          rule: "heading-hierarchy",
          message: `${nodePath}: Heading level ${level} without a preceding level ${level - 1}`,
        });
      }
    }

    // Image missing alt
    if (node.type === "Image") {
      const alt = props.alt as string | undefined;
      if (!alt || alt.trim().length === 0) {
        issues.push({
          file: relPath,
          severity: "error",
          rule: "image-alt",
          message: `${nodePath}: Image is missing an "alt" prop (required for accessibility)`,
        });
      }
    }

    // Button/Link with empty or very short label/text
    if (node.type === "Button") {
      const label = props.label as string | undefined;
      if (!label || label.trim().length === 0) {
        issues.push({
          file: relPath,
          severity: "warn",
          rule: "empty-label",
          message: `${nodePath}: Button has no "label" prop`,
        });
      }
    }
    if (node.type === "Link") {
      const text = props.text as string | undefined;
      if (!text || text.trim().length === 0) {
        issues.push({
          file: relPath,
          severity: "warn",
          rule: "empty-label",
          message: `${nodePath}: Link has no "text" prop`,
        });
      }
    }
  });
}

// -------------------------------------------------------------------------
// Cross-screen checks
// -------------------------------------------------------------------------

function lintCrossScreen(
  screens: { filePath: string; spec: unknown }[],
  issues: LintIssue[]
): void {
  const routeMap = new Map<string, string[]>();
  const globalIds = new Map<string, string[]>();

  for (const { filePath, spec } of screens) {
    const relPath = path.relative(process.cwd(), filePath);

    // We need a valid spec to check routes and IDs
    let validSpec: { route: string; tree: Node };
    try {
      validateSpec(spec);
      validSpec = spec as { route: string; tree: Node };
    } catch {
      // Skip -- schema errors are already reported per-screen
      continue;
    }

    // Duplicate routes
    const existing = routeMap.get(validSpec.route);
    if (existing) {
      existing.push(relPath);
    } else {
      routeMap.set(validSpec.route, [relPath]);
    }

    // Collect IDs for cross-screen duplicate check
    const idMap = new Map<string, string[]>();
    collectNodeIds(validSpec.tree, idMap, "tree");
    idMap.forEach((_locations, id) => {
      const global = globalIds.get(id);
      if (global) {
        global.push(relPath);
      } else {
        globalIds.set(id, [relPath]);
      }
    });
  }

  // Report duplicate routes
  routeMap.forEach((files, route) => {
    if (files.length > 1) {
      issues.push({
        file: files.join(", "),
        severity: "error",
        rule: "duplicate-route",
        message: `Route "${route}" is defined in ${files.length} files: ${files.join(", ")}`,
      });
    }
  });

  // Report cross-screen duplicate IDs (warning only)
  globalIds.forEach((files, id) => {
    if (files.length > 1) {
      // Only warn if the same ID appears across different files
      const unique = Array.from(new Set(files));
      if (unique.length > 1) {
        issues.push({
          file: unique.join(", "),
          severity: "warn",
          rule: "cross-screen-duplicate-id",
          message: `Node ID "${id}" appears in ${unique.length} screens: ${unique.join(", ")}`,
        });
      }
    }
  });
}

// -------------------------------------------------------------------------
// Output formatting
// -------------------------------------------------------------------------

function formatIssues(issues: LintIssue[]): void {
  if (issues.length === 0) {
    console.log(chalk.green("No issues found."));
    return;
  }

  // Group by file
  const byFile = new Map<string, LintIssue[]>();
  for (const issue of issues) {
    const existing = byFile.get(issue.file);
    if (existing) {
      existing.push(issue);
    } else {
      byFile.set(issue.file, [issue]);
    }
  }

  byFile.forEach((fileIssues, file) => {
    console.log(chalk.bold.underline(file));
    fileIssues.forEach((issue) => {
      const severityLabel =
        issue.severity === "error"
          ? chalk.red("error")
          : chalk.yellow("warn");
      const ruleLabel = chalk.dim(`[${issue.rule}]`);
      console.log(`  ${severityLabel} ${ruleLabel} ${issue.message}`);
    });
    console.log();
  });

  // Summary
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warnCount = issues.filter((i) => i.severity === "warn").length;
  const fileCount = byFile.size;

  const parts: string[] = [];
  if (errorCount > 0) parts.push(chalk.red(`${errorCount} error${errorCount === 1 ? "" : "s"}`));
  if (warnCount > 0) parts.push(chalk.yellow(`${warnCount} warning${warnCount === 1 ? "" : "s"}`));
  parts.push(`in ${fileCount} file${fileCount === 1 ? "" : "s"}`);

  console.log(parts.join(", "));
}

// -------------------------------------------------------------------------
// Main
// -------------------------------------------------------------------------

export function lint(): LintIssue[] {
  const screens = discoverScreens();
  const issues: LintIssue[] = [];

  // Per-screen checks
  for (const { filePath, spec } of screens) {
    lintScreen(filePath, spec, issues);
  }

  // Cross-screen checks
  lintCrossScreen(screens, issues);

  return issues;
}

if (require.main === module) {
  const issues = lint();
  formatIssues(issues);

  const hasErrors = issues.some((i) => i.severity === "error");
  process.exit(hasErrors ? 1 : 0);
}
