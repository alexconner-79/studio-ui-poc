"use client";

import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { resolveGap, resolveSize } from "@/lib/studio/tokens";
import type { Node } from "@/lib/studio/types";
import { CONTAINER_TYPES } from "@/lib/studio/types";
import { useEditorStore } from "@/lib/studio/store";
import { resolvedStyleToCSS } from "@/lib/studio/resolve-token";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { icons } from "lucide-react";
import { DropIndicator } from "./drop-indicator";
import { useA11yIssues, type A11yIssue } from "./a11y-panel";

// -------------------------------------------------------------------------
// Font loading helper -- injects a Google Fonts <link> tag if not present
// -------------------------------------------------------------------------

const loadedFonts = new Set<string>();

function ensureFontLoaded(family: string): void {
  if (!family || loadedFonts.has(family)) return;
  loadedFonts.add(family);

  // Check if it's already loaded (either by next/font or a previous inject)
  const existing = document.querySelector(
    `link[data-studio-font="${family}"]`
  );
  if (existing) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@300;400;500;600;700&display=swap`;
  link.setAttribute("data-studio-font", family);
  document.head.appendChild(link);
}

// -------------------------------------------------------------------------
// Types
// -------------------------------------------------------------------------

type RenderNodeProps = {
  node: Node;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  showDropIndicators?: boolean;
  isRoot?: boolean;
};

// -------------------------------------------------------------------------
// Node overlay wrapper -- adds click-to-select, drag, and visual feedback
// -------------------------------------------------------------------------

function NodeWrapper({
  node,
  selectedId,
  onSelect,
  children,
  isRoot,
}: {
  node: Node;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  children: React.ReactNode;
  isRoot?: boolean;
}) {
  const isSelected = selectedId === node.id;
  const isHidden = useEditorStore((s) => s.hiddenNodeIds.has(node.id));
  const isLocked = useEditorStore((s) => s.lockedNodeIds.has(node.id));
  const a11yIssues = useA11yIssues();
  const nodeIssues = a11yIssues.filter((i: A11yIssue) => i.nodeId === node.id);
  const hasA11yError = nodeIssues.some((i: A11yIssue) => i.severity === "error");
  const hasA11yWarning = nodeIssues.length > 0;

  // Root node and locked nodes are not draggable
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `canvas-${node.id}`,
    data: { type: "canvas-node", nodeId: node.id, nodeType: node.type },
    disabled: !!isRoot || isLocked,
  });

  // Hidden nodes render as a faint dashed placeholder
  if (isHidden) {
    return (
      <div
        ref={setNodeRef}
        data-studio-node={node.id}
        data-studio-type={node.type}
        className={`relative border border-dashed border-gray-300 rounded-sm bg-muted/30 opacity-40 ${
          isSelected ? "ring-2 ring-blue-500 ring-offset-1" : ""
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(node.id);
        }}
      >
        <div className="flex items-center justify-center py-2 px-3 text-[10px] text-muted-foreground font-mono">
          {node.type} (hidden)
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      {...(isRoot || isLocked ? {} : listeners)}
      {...(isRoot || isLocked ? {} : attributes)}
      data-studio-node={node.id}
      data-studio-type={node.type}
      className={`relative ${
        isDragging
          ? "opacity-30 ring-2 ring-blue-300 ring-dashed"
          : isSelected
          ? "ring-2 ring-blue-500 ring-offset-1"
          : hasA11yError
          ? "ring-2 ring-red-400/60 ring-offset-1 hover:ring-red-500"
          : hasA11yWarning
          ? "ring-2 ring-amber-400/40 ring-offset-1 hover:ring-amber-500"
          : "hover:ring-1 hover:ring-blue-300 hover:ring-offset-1"
      } rounded-sm transition-shadow ${isRoot || isLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(node.id);
      }}
    >
      {isSelected && !isDragging && (
        <div className="absolute -top-5 left-0 bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-t-sm font-mono z-10 flex items-center gap-1">
          {node.type}
          {isLocked && (
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
        </div>
      )}
      {isLocked && !isSelected && (
        <div className="absolute top-0 right-0 bg-orange-500 text-white text-[8px] px-1 py-0.5 rounded-bl-sm z-10">
          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      )}
      {hasA11yWarning && !isDragging && (
        <div
          className={`absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold z-10 ${
            hasA11yError ? "bg-red-500" : "bg-amber-500"
          }`}
          title={nodeIssues.map((i: A11yIssue) => i.message).join("; ")}
        >
          !
        </div>
      )}
      {children}
    </div>
  );
}

// -------------------------------------------------------------------------
// Render children helper
// -------------------------------------------------------------------------

function renderChildren(
  children: Node[] | undefined,
  selectedId?: string | null,
  onSelect?: (id: string) => void,
  parentId?: string,
  showDropIndicators?: boolean
): React.ReactNode {
  if (!children || children.length === 0) {
    // Show a single drop indicator in empty containers
    if (showDropIndicators && parentId) {
      return <DropIndicator parentId={parentId} index={0} />;
    }
    return null;
  }

  if (!showDropIndicators || !parentId) {
    return children.map((child) => (
      <RenderNode
        key={child.id}
        node={child}
        selectedId={selectedId}
        onSelect={onSelect}
        showDropIndicators={showDropIndicators}
      />
    ));
  }

  // Interleave drop indicators between children
  const result: React.ReactNode[] = [];
  result.push(<DropIndicator key={`drop-${parentId}-0`} parentId={parentId} index={0} />);
  children.forEach((child, i) => {
    result.push(
      <RenderNode
        key={child.id}
        node={child}
        selectedId={selectedId}
        onSelect={onSelect}
        showDropIndicators={showDropIndicators}
      />
    );
    result.push(
      <DropIndicator key={`drop-${parentId}-${i + 1}`} parentId={parentId} index={i + 1} />
    );
  });
  return result;
}

// -------------------------------------------------------------------------
// Main render function
// -------------------------------------------------------------------------

export function RenderNode({ node, selectedId, onSelect, showDropIndicators, isRoot }: RenderNodeProps) {
  const props = node.props ?? {};
  const type = node.type;
  const designTokens = useEditorStore((s) => s.designTokens);
  const nodeStyleCSS = resolvedStyleToCSS(node.style, designTokens);
  const hasNodeStyle = Object.keys(nodeStyleCSS).length > 0;

  let content: React.ReactNode;

  switch (type) {
    // -- Layout primitives --
    case "Stack": {
      const gap = resolveGap(props.gap);
      const padding = props.padding ? ` p-${resolveSize(props.padding)}` : "";
      const direction = props.direction === "row" ? "flex-row" : "flex-col";
      content = (
        <div className={`${direction} flex gap-${gap}${padding}`}>
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators)}
        </div>
      );
      break;
    }

    case "Grid": {
      const columns = typeof props.columns === "number" ? props.columns : 2;
      const gap = resolveGap(props.gap);
      content = (
        <div className={`grid grid-cols-${columns} gap-${gap}`}>
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators)}
        </div>
      );
      break;
    }

    case "Section": {
      const padding = props.padding ? ` p-${resolveSize(props.padding)}` : "";
      content = (
        <section className={`w-full${padding}`}>
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators)}
        </section>
      );
      break;
    }

    case "ScrollArea": {
      const height =
        typeof props.height === "string" ? props.height : "auto";
      content = (
        <ScrollArea className={`h-[${height}]`}>
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators)}
        </ScrollArea>
      );
      break;
    }

    case "Spacer": {
      const size = resolveSize(props.size);
      content = <div className={`h-${size}`} />;
      break;
    }

    // -- Content nodes --
    case "Heading": {
      const text = String(props.text ?? "");
      const level = typeof props.level === "number" ? props.level : 1;
      const clampedLevel = Math.min(Math.max(level, 1), 6);
      const fontFamily = typeof props.fontFamily === "string" && props.fontFamily ? props.fontFamily : undefined;
      if (fontFamily) ensureFontLoaded(fontFamily);
      const headingStyle = fontFamily ? { fontFamily } : undefined;
      content = React.createElement(
        `h${clampedLevel}`,
        { className: "text-xl font-semibold", style: headingStyle },
        text
      );
      break;
    }

    case "Text": {
      const text = String(props.text ?? "");
      const fontFamily = typeof props.fontFamily === "string" && props.fontFamily ? props.fontFamily : undefined;
      if (fontFamily) ensureFontLoaded(fontFamily);
      const fontStyle = fontFamily ? { fontFamily } : undefined;
      if (props.variant === "muted") {
        content = (
          <p className="text-sm text-muted-foreground" style={fontStyle}>{text}</p>
        );
      } else if (props.variant === "body") {
        content = <p className="text-base" style={fontStyle}>{text}</p>;
      } else {
        content = <p style={fontStyle}>{text}</p>;
      }
      break;
    }

    case "Image": {
      const src = String(props.src ?? "");
      const alt = String(props.alt ?? "");
      if (!src) {
        content = (
          <div className="flex items-center justify-center h-24 bg-muted border border-dashed rounded text-xs text-muted-foreground">
            Image (set src in properties)
          </div>
        );
        break;
      }
      const imgProps: Record<string, unknown> = { src, alt };
      if (typeof props.width === "number") imgProps.width = props.width;
      if (typeof props.height === "number") imgProps.height = props.height;
      /* eslint-disable @next/next/no-img-element */
      content = <img {...imgProps} alt={alt} />;
      break;
    }

    case "Input": {
      const inputProps: Record<string, unknown> = {};
      if (typeof props.type === "string") inputProps.type = props.type;
      if (typeof props.placeholder === "string")
        inputProps.placeholder = props.placeholder;

      if (typeof props.label === "string" && props.label) {
        content = (
          <div>
            <label className="text-sm font-medium">{props.label}</label>
            <Input {...inputProps} />
          </div>
        );
      } else {
        content = <Input {...inputProps} />;
      }
      break;
    }

    case "Link": {
      const href = typeof props.href === "string" ? props.href : "#";
      const text = typeof props.text === "string" ? props.text : href;
      content = (
        <a href={href} className="text-blue-600 underline">
          {text}
        </a>
      );
      break;
    }

    case "Divider": {
      content = <Separator />;
      break;
    }

    case "List": {
      // Check for data source
      const dsItems = node.dataSource?.data;
      const items = Array.isArray(dsItems) && dsItems.length > 0
        ? dsItems.map((d) => typeof d === "object" && d !== null ? Object.values(d as Record<string, unknown>).join(" - ") : String(d))
        : Array.isArray(props.items) ? props.items : [];
      const ordered = props.ordered === true;
      const listClass = ordered ? "list-decimal" : "list-disc";
      const listItems = items.map((item, i) => (
        <li key={i}>{String(item)}</li>
      ));
      content = ordered ? (
        <ol className={`${listClass} pl-4`}>{listItems}</ol>
      ) : (
        <ul className={`${listClass} pl-4`}>{listItems}</ul>
      );
      break;
    }

    case "Icon": {
      const iconName = typeof props.name === "string" ? props.name : "Star";
      const iconSize = typeof props.size === "number" ? props.size : 24;
      const iconColor = typeof props.color === "string" && props.color ? props.color : undefined;
      const LucideIcon = icons[iconName as keyof typeof icons];
      if (LucideIcon) {
        content = <LucideIcon size={iconSize} color={iconColor} />;
      } else {
        content = (
          <div className="flex items-center justify-center h-8 w-8 bg-muted border border-dashed rounded text-[10px] text-muted-foreground">
            ?
          </div>
        );
      }
      break;
    }

    // -- Components --
    case "Card": {
      const padding = props.padding
        ? `p-${resolveSize(props.padding)}`
        : "p-4";
      content = (
        <Card>
          <div className={padding}>
            {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators)}
          </div>
        </Card>
      );
      break;
    }

    case "Button": {
      const label = String(props.label ?? "Button");
      const buttonProps: Record<string, unknown> = {};
      if (typeof props.intent === "string" && props.intent !== "primary") {
        buttonProps.variant = props.intent;
      }
      if (typeof props.size === "string" && props.size !== "default") {
        buttonProps.size = props.size;
      }
      content = <Button {...buttonProps}>{label}</Button>;
      break;
    }

    case "Form": {
      const action = typeof props.action === "string" ? props.action : undefined;
      const method = typeof props.method === "string" ? props.method : "post";
      content = (
        <form action={action} method={method} onSubmit={(e) => e.preventDefault()} className="space-y-4">
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators)}
        </form>
      );
      break;
    }

    case "Modal": {
      const title = String(props.title ?? "Dialog");
      const isOpen = props.open !== false;
      if (!isOpen) {
        content = (
          <div className="border border-dashed rounded p-3 text-xs text-muted-foreground">
            Modal: {title} (closed)
          </div>
        );
        break;
      }
      content = (
        <div className="border rounded-lg shadow-lg bg-background p-0 max-w-md mx-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-sm">{title}</span>
            <span className="text-muted-foreground text-xs">&times;</span>
          </div>
          <div className="p-4">
            {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators)}
          </div>
        </div>
      );
      break;
    }

    case "Tabs": {
      const tabs = Array.isArray(props.tabs) ? props.tabs.map(String) : ["Tab 1", "Tab 2"];
      const childList = node.children ?? [];
      content = (
        <div>
          <div className="flex border-b mb-3">
            {tabs.map((tab, i) => (
              <button
                key={i}
                className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                  i === 0
                    ? "border-blue-500 text-blue-600 font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div>
            {childList.length > 0 ? (
              <RenderNode
                node={childList[0]}
                selectedId={selectedId}
                onSelect={onSelect}
                showDropIndicators={showDropIndicators}
              />
            ) : (
              showDropIndicators && <DropIndicator parentId={node.id} index={0} />
            )}
          </div>
        </div>
      );
      break;
    }

    case "Nav": {
      const orientation = props.orientation === "vertical" ? "vertical" : "horizontal";
      const items = Array.isArray(props.items) ? props.items : [];
      const flexDir = orientation === "vertical" ? "flex-col" : "flex-row";
      content = (
        <nav className={`flex ${flexDir} gap-1 ${orientation === "horizontal" ? "border-b pb-2" : "border-r pr-2"}`}>
          {items.map((item, i) => {
            const str = String(item);
            const [label, href] = str.includes("|") ? str.split("|") : [str, "#"];
            return (
              <a
                key={i}
                href={href}
                className="px-3 py-1.5 text-sm rounded-md hover:bg-accent transition-colors"
              >
                {label}
              </a>
            );
          })}
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators)}
        </nav>
      );
      break;
    }

    case "DataTable": {
      const columns = Array.isArray(props.columns) ? props.columns : [];
      const rawRows = node.dataSource?.data && Array.isArray(node.dataSource.data) && node.dataSource.data.length > 0
        ? node.dataSource.data
        : Array.isArray(props.rows) ? props.rows : [];
      const parsedCols = columns.map((c) => {
        const str = String(c);
        if (str.includes("|")) {
          const [key, label] = str.split("|");
          return { key, label };
        }
        return { key: str, label: str };
      });
      const parsedRows = rawRows.map((r) => {
        if (typeof r === "object" && r !== null) return r as Record<string, unknown>;
        try { return JSON.parse(String(r)) as Record<string, unknown>; } catch { return {}; }
      });
      content = (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                {parsedCols.map((col) => (
                  <th key={col.key} className="text-left px-4 py-2 font-medium">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {parsedRows.map((row, i) => (
                <tr key={i} className="border-b last:border-b-0 hover:bg-muted/30">
                  {parsedCols.map((col) => (
                    <td key={col.key} className="px-4 py-2">
                      {String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
              {parsedRows.length === 0 && (
                <tr>
                  <td colSpan={parsedCols.length} className="px-4 py-3 text-center text-muted-foreground">
                    No data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      );
      break;
    }

    // -- Fallback (repo component / unknown) --
    default: {
      content = (
        <div className="border border-dashed border-gray-400 rounded p-2 text-xs text-gray-500">
          <span className="font-mono">&lt;{type}&gt;</span>
          {node.children && node.children.length > 0 && (
            <div className="mt-1">
              {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators)}
            </div>
          )}
        </div>
      );
    }
  }

  // Apply node.style as inline CSS (designer overrides)
  // Use cloneElement to apply styles directly on the rendered element so they
  // override Tailwind classes (inline styles beat class-based styles in specificity).
  if (hasNodeStyle) {
    if (React.isValidElement(content)) {
      const existing = (content.props as Record<string, unknown>).style as React.CSSProperties | undefined;
      content = React.cloneElement(content as React.ReactElement<Record<string, unknown>>, {
        style: { ...existing, ...nodeStyleCSS },
      });
    } else {
      content = <div style={nodeStyleCSS}>{content}</div>;
    }
  }

  // Interaction indicators for the editor
  const hasInteractions = !!(node.interactions?.onClick || node.interactions?.onChange || node.interactions?.visibleWhen);
  const hasDataSource = !!node.dataSource;

  return (
    <NodeWrapper
      node={node}
      selectedId={selectedId}
      onSelect={onSelect}
      isRoot={isRoot}
    >
      {content}
      {/* Interaction badge */}
      {hasInteractions && (
        <div
          className="absolute top-0 right-0 bg-purple-500 text-white text-[8px] px-1 py-0.5 rounded-bl-sm font-mono z-10 pointer-events-none"
          title={[
            node.interactions?.onClick ? `onClick: ${node.interactions.onClick.action}` : "",
            node.interactions?.onChange ? `onChange: ${node.interactions.onChange.action}` : "",
            node.interactions?.visibleWhen ? `visible when: ${node.interactions.visibleWhen.state}` : "",
          ].filter(Boolean).join(", ")}
        >
          ⚡
        </div>
      )}
      {/* Data source badge */}
      {hasDataSource && (
        <div
          className="absolute bottom-0 right-0 bg-green-600 text-white text-[8px] px-1 py-0.5 rounded-tl-sm font-mono z-10 pointer-events-none"
          title={`Data: ${node.dataSource?.type}${node.dataSource?.url ? ` (${node.dataSource.url})` : ""}`}
        >
          📊
        </div>
      )}
    </NodeWrapper>
  );
}

// -------------------------------------------------------------------------
// Empty canvas placeholder
// -------------------------------------------------------------------------

export function EmptyCanvas() {
  return (
    <div className="flex items-center justify-center h-64 border-2 border-dashed border-gray-300 rounded-lg text-gray-400">
      Drag components here to start building
    </div>
  );
}
