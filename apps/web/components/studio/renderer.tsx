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
import { resolveAllRefs } from "@/lib/studio/component-system";

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
  previewMode?: boolean;
  /** Current frame width for responsive style resolution */
  frameWidth?: number;
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
  previewMode,
}: {
  node: Node;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  children: React.ReactNode;
  isRoot?: boolean;
  previewMode?: boolean;
}) {
  const isSelected = !previewMode && selectedId === node.id;
  const isMultiSelected = useEditorStore((s) => !previewMode && s.selectedNodeIds.has(node.id));
  const toggleSelectNode = useEditorStore((s) => s.toggleSelectNode);
  const isHidden = useEditorStore((s) => s.hiddenNodeIds.has(node.id));
  const isLocked = useEditorStore((s) => s.lockedNodeIds.has(node.id));
  const interactionState = useEditorStore((s) => s.interactionState);
  const setInteractionStateValue = useEditorStore((s) => s.setInteractionStateValue);
  const a11yIssues = useA11yIssues();
  const nodeIssues = previewMode ? [] : a11yIssues.filter((i: A11yIssue) => i.nodeId === node.id);
  const hasA11yError = nodeIssues.some((i: A11yIssue) => i.severity === "error");
  const hasA11yWarning = nodeIssues.length > 0;

  // Check visibleWhen condition
  const visibleWhen = node.interactions?.visibleWhen;
  if (visibleWhen) {
    const stateVal = interactionState[`state_${visibleWhen.state}`];
    let visible = true;
    if (visibleWhen.operator === "eq") {
      visible = String(stateVal) === String(visibleWhen.value ?? "");
    } else if (visibleWhen.operator === "neq") {
      visible = String(stateVal) !== String(visibleWhen.value ?? "");
    } else if (visibleWhen.operator === "truthy") {
      visible = !!stateVal;
    }
    if (!visible) return null;
  }

  // Check interaction-based visibility toggle
  const visToggleKey = `visibility_${node.id}`;
  if (interactionState[visToggleKey] === false) return null;

  // Draggable only in edit mode
  const disableDrag = !!previewMode || !!isRoot || isLocked;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `canvas-${node.id}`,
    data: { type: "canvas-node", nodeId: node.id, nodeType: node.type },
    disabled: disableDrag,
  });

  // Hidden nodes render as a faint dashed placeholder (edit mode only)
  if (isHidden && !previewMode) {
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

  // Handle onClick interactions
  const handleInteractionClick = (e: React.MouseEvent) => {
    const onClick = node.interactions?.onClick;
    if (!onClick) return;

    if (onClick.action === "toggleVisibility" && onClick.target) {
      e.stopPropagation();
      const key = `visibility_${onClick.target}`;
      const current = interactionState[key];
      setInteractionStateValue(key, current === false ? true : false);
    } else if (onClick.action === "navigate" && onClick.target) {
      if (previewMode) {
        window.location.href = `/studio/${onClick.target}`;
      }
      // In edit mode, navigation is indicated by the badge -- no action needed
    }
  };

  // In preview mode, render without any editor chrome
  if (previewMode) {
    return (
      <div
        data-studio-node={node.id}
        data-studio-type={node.type}
        onClick={(e) => {
          handleInteractionClick(e);
        }}
        className={node.interactions?.onClick ? "cursor-pointer" : ""}
      >
        {children}
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
          : isMultiSelected
          ? "ring-2 ring-blue-400 ring-offset-1 ring-dashed"
          : hasA11yError
          ? "ring-2 ring-red-400/60 ring-offset-1 hover:ring-red-500"
          : hasA11yWarning
          ? "ring-2 ring-amber-400/40 ring-offset-1 hover:ring-amber-500"
          : "hover:ring-1 hover:ring-blue-300 hover:ring-offset-1"
      } rounded-sm transition-shadow ${isRoot || isLocked ? "cursor-default" : "cursor-grab active:cursor-grabbing"}`}
      onClick={(e) => {
        e.stopPropagation();
        if (e.shiftKey) {
          toggleSelectNode(node.id);
        } else {
          onSelect?.(node.id);
        }
        handleInteractionClick(e);
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
  showDropIndicators?: boolean,
  previewMode?: boolean,
  frameWidth?: number
): React.ReactNode {
  if (!children || children.length === 0) {
    if (showDropIndicators && parentId && !previewMode) {
      return <DropIndicator parentId={parentId} index={0} />;
    }
    return null;
  }

  if (!showDropIndicators || !parentId || previewMode) {
    return children.map((child) => (
      <RenderNode
        key={child.id}
        node={child}
        selectedId={selectedId}
        onSelect={onSelect}
        showDropIndicators={showDropIndicators}
        previewMode={previewMode}
        frameWidth={frameWidth}
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
        previewMode={previewMode}
        frameWidth={frameWidth}
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

export function RenderNode({ node, selectedId, onSelect, showDropIndicators, isRoot, previewMode, frameWidth }: RenderNodeProps) {
  const props = node.props ?? {};
  const type = node.type;
  const designTokens = useEditorStore((s) => s.designTokens);
  const interactionState = useEditorStore((s) => s.interactionState);
  const setInteractionStateValue = useEditorStore((s) => s.setInteractionStateValue);

  // Resolve responsive styles: merge base + breakpoint override
  const resolvedStyle = React.useMemo(() => {
    const base = node.style ?? {};
    if (!node.responsive || !frameWidth) return base;
    // Mobile-first: if width <= 767 use mobile overrides, else if <= 1023 use tablet
    if (frameWidth <= 767 && node.responsive.mobile) {
      return { ...base, ...node.responsive.mobile };
    }
    if (frameWidth <= 1023 && node.responsive.tablet) {
      return { ...base, ...node.responsive.tablet };
    }
    return base;
  }, [node.style, node.responsive, frameWidth]);

  const nodeStyleCSS = resolvedStyleToCSS(resolvedStyle, designTokens);
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
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
        </div>
      );
      break;
    }

    case "Grid": {
      const columns = typeof props.columns === "number" ? props.columns : 2;
      const gap = resolveGap(props.gap);
      content = (
        <div className={`grid grid-cols-${columns} gap-${gap}`}>
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
        </div>
      );
      break;
    }

    case "Section": {
      const padding = props.padding ? ` p-${resolveSize(props.padding)}` : "";
      content = (
        <section className={`w-full${padding}`}>
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
        </section>
      );
      break;
    }

    case "ScrollArea": {
      const height =
        typeof props.height === "string" ? props.height : "auto";
      content = (
        <ScrollArea className={`h-[${height}]`}>
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
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
            {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
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
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
        </form>
      );
      break;
    }

    case "Modal": {
      const title = String(props.title ?? "Dialog");
      const modalStateKey = `modal_${node.id}_open`;
      const isOpenFromState = interactionState[modalStateKey];
      const isOpen = isOpenFromState !== undefined ? !!isOpenFromState : props.open !== false;
      if (!isOpen) {
        content = previewMode ? null : (
          <div
            className="border border-dashed rounded p-3 text-xs text-muted-foreground cursor-pointer hover:bg-muted/50"
            onClick={(e) => {
              e.stopPropagation();
              setInteractionStateValue(modalStateKey, true);
            }}
          >
            Modal: {title} (click to open)
          </div>
        );
        break;
      }
      content = (
        <div className="border rounded-lg shadow-lg bg-background p-0 max-w-md mx-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-sm">{title}</span>
            <button
              className="text-muted-foreground hover:text-foreground text-lg leading-none"
              onClick={(e) => {
                e.stopPropagation();
                setInteractionStateValue(modalStateKey, false);
              }}
            >
              &times;
            </button>
          </div>
          <div className="p-4">
            {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
          </div>
        </div>
      );
      break;
    }

    case "Tabs": {
      const tabs = Array.isArray(props.tabs) ? props.tabs.map(String) : ["Tab 1", "Tab 2"];
      const childList = node.children ?? [];
      const tabStateKey = `tabs_${node.id}_active`;
      const activeTabIdx = typeof interactionState[tabStateKey] === "number"
        ? (interactionState[tabStateKey] as number)
        : 0;
      const clampedIdx = Math.min(activeTabIdx, Math.max(childList.length - 1, 0));
      content = (
        <div>
          <div className="flex border-b mb-3">
            {tabs.map((tab, i) => (
              <button
                key={i}
                className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                  i === clampedIdx
                    ? "border-blue-500 text-blue-600 font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setInteractionStateValue(tabStateKey, i);
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <div>
            {childList.length > 0 && childList[clampedIdx] ? (
              <RenderNode
                node={childList[clampedIdx]}
                selectedId={selectedId}
                onSelect={onSelect}
                showDropIndicators={showDropIndicators}
                previewMode={previewMode}
                frameWidth={frameWidth}
              />
            ) : (
              !previewMode && showDropIndicators && <DropIndicator parentId={node.id} index={0} />
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
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
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

    // ── D2a: Design Freedom Nodes ──────────────────────────────────

    case "Box": {
      content = (
        <div>
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
        </div>
      );
      break;
    }

    case "SVG": {
      const svgCode = typeof props.code === "string" ? props.code : "";
      const svgW = typeof props.width === "number" ? props.width : 24;
      const svgH = typeof props.height === "number" ? props.height : 24;
      content = (
        <div
          style={{ width: svgW, height: svgH }}
          dangerouslySetInnerHTML={{ __html: svgCode }}
        />
      );
      break;
    }

    case "CustomComponent": {
      const compName = typeof props.componentName === "string" ? props.componentName : "Component";
      const importPath = typeof props.importPath === "string" ? props.importPath : "";
      content = (
        <div className="border-2 border-dashed border-purple-400 rounded-lg p-3 bg-purple-50 dark:bg-purple-950/20">
          <div className="text-xs font-mono text-purple-600 dark:text-purple-400 mb-1">
            &lt;{compName} /&gt;
          </div>
          <div className="text-[10px] text-purple-400 dark:text-purple-500 truncate">
            from {importPath}
          </div>
          {node.children && node.children.length > 0 && (
            <div className="mt-2 border-t border-purple-200 dark:border-purple-800 pt-2">
              {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
            </div>
          )}
        </div>
      );
      break;
    }

    // ── D2b: Forms & Input ────────────────────────────────────────

    case "Textarea": {
      const taLabel = typeof props.label === "string" ? props.label : undefined;
      const taPlaceholder = typeof props.placeholder === "string" ? props.placeholder : "";
      const taRows = typeof props.rows === "number" ? props.rows : 4;
      const textarea = (
        <textarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={taPlaceholder}
          rows={taRows}
          readOnly
        />
      );
      content = taLabel ? (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{taLabel}</label>
          {textarea}
        </div>
      ) : textarea;
      break;
    }

    case "Select": {
      const selLabel = typeof props.label === "string" ? props.label : undefined;
      const selPlaceholder = typeof props.placeholder === "string" ? props.placeholder : "Choose...";
      const selOptions = Array.isArray(props.options) ? props.options : [];
      const select = (
        <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring">
          <option value="" disabled>{selPlaceholder}</option>
          {selOptions.map((opt, i) => {
            const s = String(opt);
            const [val, lab] = s.includes("|") ? s.split("|") : [s, s];
            return <option key={i} value={val}>{lab}</option>;
          })}
        </select>
      );
      content = selLabel ? (
        <div className="space-y-1.5">
          <label className="text-sm font-medium">{selLabel}</label>
          {select}
        </div>
      ) : select;
      break;
    }

    case "Checkbox": {
      const cbLabel = typeof props.label === "string" ? props.label : "Checkbox";
      content = (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" defaultChecked={props.checked === true} className="h-4 w-4 rounded border-gray-300" readOnly />
          {cbLabel}
        </label>
      );
      break;
    }

    case "RadioGroup": {
      const rgLabel = typeof props.label === "string" ? props.label : undefined;
      const rgOptions = Array.isArray(props.options) ? props.options : [];
      const rgDefault = typeof props.defaultValue === "string" ? props.defaultValue : "";
      content = (
        <fieldset className="space-y-2">
          {rgLabel && <legend className="text-sm font-medium mb-1">{rgLabel}</legend>}
          {rgOptions.map((opt, i) => {
            const s = String(opt);
            const [val, lab] = s.includes("|") ? s.split("|") : [s, s];
            return (
              <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name={`rg-${node.id}`} value={val} defaultChecked={val === rgDefault} className="h-4 w-4" readOnly />
                {lab}
              </label>
            );
          })}
        </fieldset>
      );
      break;
    }

    case "Switch": {
      const swLabel = typeof props.label === "string" ? props.label : "Toggle";
      const swChecked = props.checked === true;
      content = (
        <label className="flex items-center gap-3 text-sm cursor-pointer">
          <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${swChecked ? "bg-blue-600" : "bg-gray-300"}`}>
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${swChecked ? "translate-x-4" : "translate-x-0.5"}`} />
          </div>
          {swLabel}
        </label>
      );
      break;
    }

    case "Slider": {
      const slMin = typeof props.min === "number" ? props.min : 0;
      const slMax = typeof props.max === "number" ? props.max : 100;
      const slStep = typeof props.step === "number" ? props.step : 1;
      const slDefault = typeof props.defaultValue === "number" ? props.defaultValue : 50;
      const slLabel = typeof props.label === "string" ? props.label : undefined;
      const slider = (
        <input type="range" min={slMin} max={slMax} step={slStep} defaultValue={slDefault} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" readOnly />
      );
      content = slLabel ? (
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <label className="font-medium">{slLabel}</label>
            <span className="text-muted-foreground">{slDefault}</span>
          </div>
          {slider}
        </div>
      ) : slider;
      break;
    }

    case "Label": {
      const lbText = typeof props.text === "string" ? props.text : "Label";
      content = <label className="text-sm font-medium leading-none">{lbText}</label>;
      break;
    }

    case "FileUpload": {
      const fuLabel = typeof props.label === "string" ? props.label : "Drop files here or click to upload";
      content = (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
          </svg>
          <span className="text-sm text-muted-foreground">{fuLabel}</span>
        </div>
      );
      break;
    }

    // ── D2c: Data Display ──────────────────────────────────────────

    case "Avatar": {
      const avSrc = typeof props.src === "string" ? props.src : "";
      const avFallback = typeof props.fallback === "string" ? props.fallback : "AB";
      const avSize = typeof props.size === "number" ? props.size : 40;
      content = avSrc ? (
        <img src={avSrc} alt={avFallback} style={{ width: avSize, height: avSize }} className="rounded-full object-cover" />
      ) : (
        <div style={{ width: avSize, height: avSize }} className="rounded-full bg-muted flex items-center justify-center text-xs font-medium">
          {avFallback}
        </div>
      );
      break;
    }

    case "Badge": {
      const bdText = typeof props.text === "string" ? props.text : "Badge";
      const bdVariant = typeof props.variant === "string" ? props.variant : "default";
      const bdColors: Record<string, string> = {
        default: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
        secondary: "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
        destructive: "bg-red-500 text-white",
        outline: "border border-zinc-200 text-zinc-900 dark:border-zinc-700 dark:text-zinc-100",
      };
      content = (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${bdColors[bdVariant] || bdColors.default}`}>
          {bdText}
        </span>
      );
      break;
    }

    case "Chip": {
      const chText = typeof props.text === "string" ? props.text : "Chip";
      const chRemovable = props.removable !== false;
      content = (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-medium">
          {chText}
          {chRemovable && (
            <button className="ml-0.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300" type="button">&times;</button>
          )}
        </span>
      );
      break;
    }

    case "Tooltip": {
      const ttContent = typeof props.content === "string" ? props.content : "Tooltip";
      content = (
        <div className="group relative inline-block">
          {node.children && node.children.length > 0
            ? renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)
            : <span className="underline decoration-dotted cursor-help text-sm">Hover target</span>}
          {!previewMode && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-zinc-900 text-white text-xs whitespace-nowrap opacity-80 pointer-events-none">
              {ttContent}
            </div>
          )}
        </div>
      );
      break;
    }

    case "Progress": {
      const prValue = typeof props.value === "number" ? props.value : 60;
      const prMax = typeof props.max === "number" ? props.max : 100;
      const prLabel = typeof props.label === "string" ? props.label : undefined;
      const prPercent = Math.min(100, Math.max(0, (prValue / prMax) * 100));
      content = (
        <div className="space-y-1">
          {prLabel && <div className="flex justify-between text-sm"><span className="font-medium">{prLabel}</span><span className="text-muted-foreground">{Math.round(prPercent)}%</span></div>}
          <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700 overflow-hidden">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${prPercent}%` }} />
          </div>
        </div>
      );
      break;
    }

    case "Skeleton": {
      const skW = typeof props.width === "string" ? props.width : "100%";
      const skH = typeof props.height === "string" ? props.height : "20px";
      const skVariant = typeof props.variant === "string" ? props.variant : "text";
      const skRadius = skVariant === "circular" ? "rounded-full" : skVariant === "text" ? "rounded" : "rounded-md";
      content = (
        <div className={`animate-pulse bg-zinc-200 dark:bg-zinc-700 ${skRadius}`} style={{ width: skW, height: skH }} />
      );
      break;
    }

    case "Stat": {
      const stLabel = typeof props.label === "string" ? props.label : "Stat";
      const stValue = typeof props.value === "string" ? props.value : "0";
      const stChange = typeof props.change === "string" ? props.change : "";
      const stTrend = typeof props.trend === "string" ? props.trend : "neutral";
      const trendColor = stTrend === "up" ? "text-green-600" : stTrend === "down" ? "text-red-600" : "text-zinc-500";
      content = (
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{stLabel}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold">{stValue}</p>
            {stChange && <span className={`text-xs font-medium ${trendColor}`}>{stChange}</span>}
          </div>
        </div>
      );
      break;
    }

    case "Rating": {
      const rtValue = typeof props.value === "number" ? props.value : 3;
      const rtMax = typeof props.max === "number" ? props.max : 5;
      content = (
        <div className="flex gap-0.5">
          {Array.from({ length: rtMax }).map((_, i) => (
            <svg key={i} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill={i < rtValue ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className={i < rtValue ? "text-yellow-500" : "text-zinc-300"}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          ))}
        </div>
      );
      break;
    }

    // ── D2d: Feedback ──────────────────────────────────────────────

    case "Alert": {
      const alTitle = typeof props.title === "string" ? props.title : "Alert";
      const alDesc = typeof props.description === "string" ? props.description : "";
      const alVariant = typeof props.variant === "string" ? props.variant : "default";
      const alColors: Record<string, string> = {
        default: "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900",
        info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100",
        success: "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-100",
        warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
        error: "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100",
      };
      content = (
        <div className={`rounded-lg border p-4 ${alColors[alVariant] || alColors.default}`} role="alert">
          <div className="font-semibold text-sm">{alTitle}</div>
          {alDesc && <p className="text-sm mt-1 opacity-80">{alDesc}</p>}
          {node.children && node.children.length > 0 && (
            <div className="mt-2">{renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}</div>
          )}
        </div>
      );
      break;
    }

    case "Toast": {
      const toTitle = typeof props.title === "string" ? props.title : "Toast";
      const toDesc = typeof props.description === "string" ? props.description : "";
      const toVariant = typeof props.variant === "string" ? props.variant : "default";
      const toBorder = toVariant === "error" ? "border-red-300" : toVariant === "success" ? "border-green-300" : "border-zinc-200";
      content = (
        <div className={`rounded-lg border ${toBorder} bg-white dark:bg-zinc-900 p-4 shadow-lg max-w-sm`}>
          <div className="font-semibold text-sm">{toTitle}</div>
          {toDesc && <p className="text-sm text-muted-foreground mt-0.5">{toDesc}</p>}
        </div>
      );
      break;
    }

    case "Spinner": {
      const spSize = typeof props.size === "number" ? props.size : 24;
      const spLabel = typeof props.label === "string" ? props.label : "Loading...";
      content = (
        <div className="flex items-center gap-2" role="status">
          <svg className="animate-spin" style={{ width: spSize, height: spSize }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="sr-only">{spLabel}</span>
        </div>
      );
      break;
    }

    case "Dialog": {
      const dlTitle = typeof props.title === "string" ? props.title : "Dialog";
      const dlDesc = typeof props.description === "string" ? props.description : "";
      const dlOpen = props.open !== false;
      if (!dlOpen) {
        content = !previewMode ? (
          <div className="border border-dashed rounded p-3 text-xs text-muted-foreground cursor-pointer hover:bg-muted/50">
            Dialog: {dlTitle} (closed)
          </div>
        ) : null;
        break;
      }
      content = (
        <div className="border rounded-lg shadow-lg bg-background max-w-md mx-auto">
          <div className="p-6 space-y-2">
            <h3 className="text-lg font-semibold">{dlTitle}</h3>
            {dlDesc && <p className="text-sm text-muted-foreground">{dlDesc}</p>}
          </div>
          <div className="px-6 pb-4">
            {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
          </div>
        </div>
      );
      break;
    }

    case "Drawer": {
      const drTitle = typeof props.title === "string" ? props.title : "Drawer";
      const drSide = typeof props.side === "string" ? props.side : "right";
      const drOpen = props.open !== false;
      if (!drOpen) {
        content = !previewMode ? (
          <div className="border border-dashed rounded p-3 text-xs text-muted-foreground">
            Drawer: {drTitle} (closed)
          </div>
        ) : null;
        break;
      }
      content = (
        <div className={`border rounded-lg shadow-lg bg-background w-80 ${drSide === "left" ? "mr-auto" : "ml-auto"}`}>
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-sm">{drTitle}</span>
          </div>
          <div className="p-4">
            {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
          </div>
        </div>
      );
      break;
    }

    case "Sheet": {
      const shTitle = typeof props.title === "string" ? props.title : "Sheet";
      const shOpen = props.open !== false;
      if (!shOpen) {
        content = !previewMode ? (
          <div className="border border-dashed rounded p-3 text-xs text-muted-foreground">
            Sheet: {shTitle} (closed)
          </div>
        ) : null;
        break;
      }
      content = (
        <div className="border-t rounded-t-xl shadow-lg bg-background mx-auto max-w-lg w-full">
          <div className="flex justify-center pt-2 pb-1"><div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" /></div>
          <div className="px-4 py-3 border-b"><span className="font-semibold text-sm">{shTitle}</span></div>
          <div className="p-4">
            {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
          </div>
        </div>
      );
      break;
    }

    // ── D2e: Navigation ─────────────────────────────────────────────

    case "Breadcrumb": {
      const bcItems = Array.isArray(props.items) ? props.items : [];
      const bcSep = typeof props.separator === "string" ? props.separator : "/";
      content = (
        <nav className="flex items-center gap-1 text-sm">
          {bcItems.map((item, i) => {
            const s = String(item);
            const [label, href] = s.includes("|") ? s.split("|") : [s, ""];
            const isLast = i === bcItems.length - 1;
            return (
              <React.Fragment key={i}>
                {i > 0 && <span className="text-muted-foreground mx-1">{bcSep}</span>}
                {isLast || !href ? (
                  <span className={isLast ? "font-medium" : "text-muted-foreground"}>{label}</span>
                ) : (
                  <a href={href} className="text-muted-foreground hover:text-foreground transition-colors">{label}</a>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      );
      break;
    }

    case "Pagination": {
      const pgTotal = typeof props.totalPages === "number" ? props.totalPages : 10;
      const pgCurrent = typeof props.currentPage === "number" ? props.currentPage : 1;
      const pgMax = Math.min(pgTotal, 7);
      content = (
        <nav className="flex items-center gap-1">
          <button className="h-8 w-8 rounded border text-sm disabled:opacity-50" disabled={pgCurrent <= 1}>&lsaquo;</button>
          {Array.from({ length: pgMax }).map((_, i) => {
            const page = i + 1;
            return (
              <button key={page} className={`h-8 w-8 rounded text-sm ${page === pgCurrent ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border hover:bg-muted"}`}>
                {page}
              </button>
            );
          })}
          {pgTotal > 7 && <span className="px-1 text-muted-foreground">...</span>}
          <button className="h-8 w-8 rounded border text-sm disabled:opacity-50" disabled={pgCurrent >= pgTotal}>&rsaquo;</button>
        </nav>
      );
      break;
    }

    case "Stepper": {
      const stSteps = Array.isArray(props.steps) ? props.steps.map(String) : ["Step 1", "Step 2"];
      const stCurrent = typeof props.currentStep === "number" ? props.currentStep : 1;
      content = (
        <div>
          <div className="flex items-center gap-2 mb-4">
            {stSteps.map((step, i) => (
              <React.Fragment key={i}>
                {i > 0 && <div className={`flex-1 h-0.5 ${i < stCurrent ? "bg-blue-600" : "bg-zinc-200 dark:bg-zinc-700"}`} />}
                <div className="flex items-center gap-2">
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    i < stCurrent ? "bg-blue-600 text-white" : i === stCurrent ? "border-2 border-blue-600 text-blue-600" : "border border-zinc-300 text-zinc-400"
                  }`}>{i + 1}</div>
                  <span className="text-sm hidden sm:inline">{step}</span>
                </div>
              </React.Fragment>
            ))}
          </div>
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
        </div>
      );
      break;
    }

    case "Sidebar": {
      const sbItems = Array.isArray(props.items) ? props.items : [];
      const sbCollapsed = props.collapsed === true;
      content = (
        <aside className={`border-r bg-muted/30 ${sbCollapsed ? "w-14" : "w-56"} py-2 flex flex-col gap-0.5 min-h-[200px]`}>
          {sbItems.map((item, i) => {
            const s = String(item);
            const [label, href] = s.includes("|") ? s.split("|") : [s, "#"];
            return (
              <a key={i} href={href} className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md mx-1 hover:bg-accent transition-colors ${i === 0 ? "bg-accent font-medium" : "text-muted-foreground"}`}>
                {!sbCollapsed && label}
              </a>
            );
          })}
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
        </aside>
      );
      break;
    }

    case "DropdownMenu": {
      const dmTrigger = typeof props.trigger === "string" ? props.trigger : "Actions";
      const dmItems = Array.isArray(props.items) ? props.items : [];
      content = (
        <div className="relative inline-block">
          <button className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
            {dmTrigger}
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </button>
          {!previewMode && (
            <div className="mt-1 w-40 rounded-md border bg-background shadow-lg py-1">
              {dmItems.map((item, i) => {
                const s = String(item);
                const [label] = s.includes("|") ? s.split("|") : [s];
                return <div key={i} className="px-3 py-1.5 text-sm hover:bg-muted cursor-pointer">{label}</div>;
              })}
            </div>
          )}
        </div>
      );
      break;
    }

    case "AppBar": {
      const abTitle = typeof props.title === "string" ? props.title : "App";
      const abSticky = props.sticky !== false;
      content = (
        <header className={`flex items-center justify-between px-4 h-14 border-b bg-background ${abSticky ? "sticky top-0 z-40" : ""}`}>
          <span className="font-semibold">{abTitle}</span>
          <div className="flex items-center gap-2">
            {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
          </div>
        </header>
      );
      break;
    }

    // ── D2f: Surfaces & Containers ──────────────────────────────────

    case "Container": {
      const ctMaxWidth = typeof props.maxWidth === "string" ? props.maxWidth : "lg";
      const ctPadding = props.padding ? ` p-${resolveSize(props.padding)}` : " px-4";
      const MW: Record<string, string> = { sm: "max-w-screen-sm", md: "max-w-screen-md", lg: "max-w-screen-lg", xl: "max-w-screen-xl", "2xl": "max-w-screen-2xl", full: "max-w-full" };
      content = (
        <div className={`mx-auto ${MW[ctMaxWidth] || "max-w-screen-lg"}${ctPadding}`}>
          {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
        </div>
      );
      break;
    }

    case "AspectRatio": {
      const arRatio = typeof props.ratio === "string" ? props.ratio : "16/9";
      const [w, h] = arRatio.split("/").map(Number);
      const paddingPercent = w && h ? (h / w) * 100 : 56.25;
      content = (
        <div className="relative w-full overflow-hidden" style={{ paddingTop: `${paddingPercent}%` }}>
          <div className="absolute inset-0">
            {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
          </div>
        </div>
      );
      break;
    }

    case "Accordion": {
      const acItems = Array.isArray(props.items) ? props.items : [];
      content = (
        <div className="divide-y border rounded-lg">
          {acItems.map((item, i) => {
            const s = String(item);
            const [title, body] = s.includes("|") ? s.split("|") : [s, ""];
            return (
              <details key={i} className="group" open={i === 0}>
                <summary className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm font-medium hover:bg-muted/50">
                  {title}
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="transition-transform group-open:rotate-180"><path d="m6 9 6 6 6-6"/></svg>
                </summary>
                <div className="px-4 pb-3 text-sm text-muted-foreground">{body}</div>
              </details>
            );
          })}
          {node.children && node.children.length > 0 && (
            <div className="p-4">{renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}</div>
          )}
        </div>
      );
      break;
    }

    case "Popover": {
      const poTrigger = typeof props.trigger === "string" ? props.trigger : "Open";
      content = (
        <div className="relative inline-block">
          <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">{poTrigger}</button>
          {!previewMode && (
            <div className="mt-1 rounded-md border bg-background shadow-lg p-4 w-64">
              {node.children && node.children.length > 0
                ? renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)
                : <p className="text-sm text-muted-foreground">Popover content</p>}
            </div>
          )}
        </div>
      );
      break;
    }

    case "HoverCard": {
      const hcTrigger = typeof props.trigger === "string" ? props.trigger : "Hover me";
      content = (
        <div className="relative inline-block group">
          <span className="underline decoration-dotted cursor-help text-sm">{hcTrigger}</span>
          <div className="hidden group-hover:block absolute top-full left-0 mt-1 rounded-md border bg-background shadow-lg p-4 w-64 z-50">
            {node.children && node.children.length > 0
              ? renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)
              : <p className="text-sm text-muted-foreground">Hover card content</p>}
          </div>
        </div>
      );
      break;
    }

    // ── D2g: Media & Typography ─────────────────────────────────────

    case "Video": {
      const viSrc = typeof props.src === "string" ? props.src : "";
      const viPoster = typeof props.poster === "string" ? props.poster : undefined;
      const viControls = props.controls !== false;
      if (!viSrc) {
        content = (
          <div className="flex items-center justify-center h-48 bg-muted border border-dashed rounded-lg text-sm text-muted-foreground">
            Video (set src in properties)
          </div>
        );
        break;
      }
      content = <video src={viSrc} poster={viPoster} controls={viControls} className="w-full rounded-lg" />;
      break;
    }

    case "Embed": {
      const emSrc = typeof props.src === "string" ? props.src : "";
      const emTitle = typeof props.title === "string" ? props.title : "Embedded content";
      const emHeight = typeof props.height === "string" ? props.height : "400px";
      if (!emSrc) {
        content = (
          <div className="flex items-center justify-center bg-muted border border-dashed rounded-lg text-sm text-muted-foreground" style={{ height: emHeight }}>
            Embed (set URL in properties)
          </div>
        );
        break;
      }
      content = (
        <iframe src={emSrc} title={emTitle} style={{ height: emHeight }} className="w-full border rounded-lg" />
      );
      break;
    }

    case "Blockquote": {
      const bqText = typeof props.text === "string" ? props.text : "";
      const bqCite = typeof props.cite === "string" ? props.cite : "";
      content = (
        <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 py-2 italic text-zinc-600 dark:text-zinc-400">
          <p>{bqText}</p>
          {bqCite && <footer className="mt-1 text-sm not-italic text-muted-foreground">&mdash; {bqCite}</footer>}
        </blockquote>
      );
      break;
    }

    case "Code": {
      const cdCode = typeof props.code === "string" ? props.code : "";
      const cdLang = typeof props.language === "string" ? props.language : "";
      content = (
        <div className="rounded-lg bg-zinc-950 text-zinc-100 overflow-hidden">
          {cdLang && <div className="px-4 py-1.5 text-[10px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">{cdLang}</div>}
          <pre className="p-4 text-sm overflow-x-auto"><code>{cdCode}</code></pre>
        </div>
      );
      break;
    }

    case "Carousel": {
      const crChildren = node.children ?? [];
      content = (
        <div className="relative overflow-hidden rounded-lg">
          <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-2">
            {crChildren.length > 0
              ? crChildren.map((child) => (
                  <div key={child.id} className="flex-shrink-0 snap-center">
                    <RenderNode node={child} selectedId={selectedId} onSelect={onSelect} showDropIndicators={showDropIndicators} previewMode={previewMode} frameWidth={frameWidth} />
                  </div>
                ))
              : (
                <div className="flex gap-2">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="flex-shrink-0 w-64 h-40 rounded-lg bg-muted border border-dashed flex items-center justify-center text-sm text-muted-foreground">
                      Slide {n}
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      );
      break;
    }

    case "Calendar": {
      const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
      content = (
        <div className="border rounded-lg p-3 w-64">
          <div className="flex items-center justify-between mb-2">
            <button className="h-7 w-7 rounded hover:bg-muted text-sm">&lsaquo;</button>
            <span className="text-sm font-medium">February 2026</span>
            <button className="h-7 w-7 rounded hover:bg-muted text-sm">&rsaquo;</button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-muted-foreground mb-1">
            {days.map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 text-center text-sm">
            {Array.from({ length: 28 }).map((_, i) => (
              <button key={i} className={`h-8 w-8 rounded-full text-xs hover:bg-muted ${i + 1 === 18 ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : ""}`}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      );
      break;
    }

    case "Timeline": {
      const tlItems = Array.isArray(props.items) ? props.items : [];
      content = (
        <div className="relative pl-6">
          <div className="absolute left-2.5 top-0 bottom-0 w-px bg-zinc-200 dark:bg-zinc-700" />
          {tlItems.map((item, i) => {
            const s = String(item);
            const [title, desc] = s.includes("|") ? s.split("|") : [s, ""];
            return (
              <div key={i} className="relative pb-4 last:pb-0">
                <div className="absolute -left-3.5 top-1 h-3 w-3 rounded-full border-2 border-blue-600 bg-background" />
                <div className="text-sm font-medium">{title}</div>
                {desc && <div className="text-sm text-muted-foreground mt-0.5">{desc}</div>}
              </div>
            );
          })}
          {node.children && node.children.length > 0 && (
            <div className="mt-2">{renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}</div>
          )}
        </div>
      );
      break;
    }

    case "ComponentRef": {
      const componentDefs = useEditorStore.getState().componentDefs;
      const refId = props.ref as string | undefined;
      const def = refId ? componentDefs.get(refId) : undefined;
      if (!def) {
        content = (
          <div className="border-2 border-dashed border-red-300 rounded p-2 text-xs text-red-500 flex items-center gap-1">
            <span className="font-mono">Missing component: {refId ?? "?"}</span>
          </div>
        );
        break;
      }
      const resolvedNode: Node = resolveAllRefs(node, componentDefs);
      const hasOverrides = props.overrides || props.styleOverrides || props.descendants;
      content = (
        <div
          className="relative"
          style={{
            outline: previewMode ? undefined : `2px solid ${hasOverrides ? "#a855f7" : "#8b5cf6"}`,
            outlineOffset: "1px",
          }}
        >
          {!previewMode && (
            <div className="absolute -top-4 left-0 text-[9px] font-mono text-purple-500 bg-purple-50 dark:bg-purple-950 px-1 rounded-t z-10">
              {def.name}{hasOverrides ? " (modified)" : ""}
            </div>
          )}
          <RenderNode
            node={resolvedNode}
            selectedId={selectedId}
            onSelect={onSelect}
            showDropIndicators={showDropIndicators}
            previewMode={previewMode}
            frameWidth={frameWidth}
          />
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
              {renderChildren(node.children, selectedId, onSelect, node.id, showDropIndicators, previewMode, frameWidth)}
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

  // Interaction indicators for the editor (hidden in preview mode)
  const hasInteractions = !previewMode && !!(node.interactions?.onClick || node.interactions?.onChange || node.interactions?.visibleWhen);
  const hasDataSource = !previewMode && !!node.dataSource;

  return (
    <NodeWrapper
      node={node}
      selectedId={selectedId}
      onSelect={onSelect}
      isRoot={isRoot}
      previewMode={previewMode}
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
