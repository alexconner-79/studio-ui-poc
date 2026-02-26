/**
 * Structure linter -- scans Build Mode tree for common issues before compilation.
 * Returns a list of warnings with one-click fix descriptions.
 */

import type { Node } from "./types";

export type LintSeverity = "warning" | "info";

export type LintWarning = {
  nodeId: string;
  nodeName: string;
  severity: LintSeverity;
  message: string;
  fixLabel: string;
  fixAction: "wrap-in-frame" | "flatten" | "convert-type";
  fixPayload?: Record<string, unknown>;
};

function collectBuildNodes(node: Node, acc: { node: Node; depth: number }[], depth = 0) {
  if (node.compile === false) return;
  acc.push({ node, depth });
  node.children?.forEach((c) => collectBuildNodes(c, acc, depth + 1));
}

export function lintTree(root: Node): LintWarning[] {
  const warnings: LintWarning[] = [];
  const buildNodes: { node: Node; depth: number }[] = [];
  collectBuildNodes(root, buildNodes);

  for (const { node, depth } of buildNodes) {
    if (node.id === root.id) continue;

    // Hardcoded absolute position in build tree
    if (node.style?.position === "absolute" && (node.style?.top || node.style?.left)) {
      warnings.push({
        nodeId: node.id,
        nodeName: node.id,
        severity: "warning",
        message: "Uses absolute positioning with hardcoded pixels — consider auto-layout",
        fixLabel: "Wrap in auto-layout Frame",
        fixAction: "wrap-in-frame",
      });
    }

    // Deep nesting (> 5 levels)
    if (depth > 5 && node.children && node.children.length > 0) {
      warnings.push({
        nodeId: node.id,
        nodeName: node.id,
        severity: "info",
        message: `Nested ${depth} levels deep — consider flattening`,
        fixLabel: "Flatten children",
        fixAction: "flatten",
      });
    }

    // Raw Rectangle/Ellipse in build tree (shape used as structural element)
    const shapeTypes = ["Rectangle", "Ellipse"];
    if (shapeTypes.includes(node.type) && node.compile !== false) {
      const hasChildren = node.children && node.children.length > 0;
      if (hasChildren) {
        warnings.push({
          nodeId: node.id,
          nodeName: node.id,
          severity: "info",
          message: `${node.type} with children in Build tree — consider using a semantic type`,
          fixLabel: "Convert to Box",
          fixAction: "convert-type",
          fixPayload: { targetType: "Box" },
        });
      }
    }
  }

  return warnings;
}
