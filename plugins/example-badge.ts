/**
 * Example plugin: Badge component.
 *
 * This demonstrates how third-party or project-specific node types
 * can be registered via the plugin system.
 */

import type { NodePlugin } from "../compiler/plugins/types";

const badgePlugin: NodePlugin = {
  type: "Badge",
  label: "Badge",
  category: "Custom",
  description: "A small label badge",
  acceptsChildren: false,
  propSchema: {
    text: { type: "string", label: "Text", required: true },
    variant: {
      type: "string",
      label: "Variant",
      enum: ["default", "success", "warning", "error"],
    },
  },
  emit(node) {
    const props = node.props ?? {};
    const text = typeof props.text === "string" ? props.text : "Badge";
    const variant = typeof props.variant === "string" ? props.variant : "default";

    const colorMap: Record<string, string> = {
      default: "bg-gray-100 text-gray-800",
      success: "bg-green-100 text-green-800",
      warning: "bg-yellow-100 text-yellow-800",
      error: "bg-red-100 text-red-800",
    };
    const classes = colorMap[variant] ?? colorMap.default;

    return `<span className="${classes} inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">${text}</span>`;
  },
};

export default badgePlugin;
