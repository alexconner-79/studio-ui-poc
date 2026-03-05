"use client";

import React, { useState, useEffect, useRef } from "react";
import { getComponent, invalidateLocalFile, NATIVE_PATHS } from "@/lib/studio/component-registry";

// -------------------------------------------------------------------------
// NativeFallbackChip
// Shown when importPath is a native-only library
// -------------------------------------------------------------------------

export function NativeFallbackChip({
  name,
  ref,
  className,
  style,
  ...restProps
}: {
  name: string;
  ref?: React.Ref<HTMLElement>;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={className}
      {...restProps}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 12px",
        border: "1.5px dashed #f59e0b",
        borderRadius: 6,
        background: "rgba(245,158,11,0.06)",
        minWidth: 80,
        ...style,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <line x1="12" y1="18" x2="12" y2="18.01" />
      </svg>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#f59e0b", lineHeight: 1.2 }}>
          {name}
        </div>
        <div style={{ fontSize: 9, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Native — web preview unavailable
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// StructuralFallback
// Shown while loading, on error, or for custom/unknown importPaths
// -------------------------------------------------------------------------

export function StructuralInstance({
  name,
  hasChildren,
  children,
  ref,
  className,
  style,
  ...restProps
}: {
  name: string;
  hasChildren: boolean;
  children?: React.ReactNode;
  ref?: React.Ref<HTMLElement>;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={className}
      {...restProps}
      style={{
        position: "relative",
        outline: "1px solid transparent",
        outlineOffset: 1,
        borderRadius: 4,
        minHeight: hasChildren ? undefined : 36,
        minWidth: hasChildren ? undefined : 80,
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -18,
          left: 0,
          fontSize: 9,
          fontWeight: 600,
          color: "var(--s-accent, #6366f1)",
          background: "var(--s-canvas-bg, #1a1a2e)",
          padding: "1px 5px",
          borderRadius: 3,
          letterSpacing: "0.03em",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {name}
      </div>
      {hasChildren ? (
        children
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            padding: "16px 12px",
            minHeight: 64,
            border: "1.5px dashed var(--s-accent, #6366f1)",
            borderRadius: 4,
            opacity: 0.5,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--s-accent, #6366f1)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {name}
          </span>
          <span style={{ fontSize: 10, color: "var(--s-text-ter, #888)" }}>
            Drop content here or restore in Design panel
          </span>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// LiveNode
// Dynamically loads the real library component and renders it with children.
// v0.10.9: accepts filePath for studio:local components and subscribes to the
// SSE file-change stream to auto-refresh on file saves.
// -------------------------------------------------------------------------

type LiveNodeProps = {
  importPath: string;
  componentName: string;
  componentProps: Record<string, unknown>;
  children?: React.ReactNode;
  previewMode?: boolean;
  /** Absolute path to the component source file (studio:local only). */
  filePath?: string;
};

type LoadState = "loading" | "ready" | "error";

// ---------------------------------------------------------------------------
// Singleton SSE connection manager for the file-change watch stream.
// One EventSource per watched root directory, shared across all LiveNode
// instances in the same root.
// ---------------------------------------------------------------------------

type WatchSubscriber = (filePath: string) => void;
const watchSubscribers = new Map<string, Set<WatchSubscriber>>();
const watchSources = new Map<string, EventSource>();

function subscribeToFileChanges(root: string, subscriber: WatchSubscriber): () => void {
  if (!watchSubscribers.has(root)) {
    watchSubscribers.set(root, new Set());
  }
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  watchSubscribers.get(root)!.add(subscriber);

  if (!watchSources.has(root)) {
    const es = new EventSource(
      `/api/studio/components/watch?root=${encodeURIComponent(root)}`,
    );
    watchSources.set(root, es);

    es.addEventListener("component-changed", (evt) => {
      try {
        const { filePath } = JSON.parse((evt as MessageEvent).data) as { filePath: string };
        const subs = watchSubscribers.get(root);
        if (subs) {
          for (const sub of subs) sub(filePath);
        }
      } catch {
        // ignore malformed events
      }
    });

    es.onerror = () => {
      es.close();
      watchSources.delete(root);
    };
  }

  return () => {
    const subs = watchSubscribers.get(root);
    if (subs) {
      subs.delete(subscriber);
      if (subs.size === 0) {
        watchSources.get(root)?.close();
        watchSources.delete(root);
        watchSubscribers.delete(root);
      }
    }
  };
}

function watchRootFromFilePath(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  parts.pop();
  return parts.join("/") || "/";
}

export function LiveNode({
  importPath,
  componentName,
  componentProps,
  children,
  previewMode = false,
  filePath,
  ref,
  className: externalClassName,
  style: externalStyle,
  ...restProps
}: LiveNodeProps & { ref?: React.Ref<HTMLElement> } & React.HTMLAttributes<HTMLElement>) {
  const [Comp, setComp] = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);

  const reqRef = useRef({ importPath, componentName });
  reqRef.current = { importPath, componentName };

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    setComp(null);

    getComponent(importPath, componentName, filePath)
      .then((comp) => {
        if (cancelled) return;
        if (comp) {
          setComp(() => comp);
          setLoadState("ready");
        } else {
          setLoadState("error");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importPath, componentName, filePath, reloadKey]);

  useEffect(() => {
    if (importPath !== "studio:local" || !filePath) return;

    const root = watchRootFromFilePath(filePath);

    const unsubscribe = subscribeToFileChanges(root, (changedPath) => {
      if (changedPath === filePath) {
        invalidateLocalFile(filePath);
        setReloadKey((k) => k + 1);
      }
    });

    return unsubscribe;
  }, [importPath, filePath]);

  if (NATIVE_PATHS.has(importPath)) {
    return <NativeFallbackChip ref={ref} className={externalClassName} style={externalStyle} {...restProps} name={componentName} />;
  }

  if (loadState === "loading") {
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={externalClassName}
        {...restProps}
        style={{
          minHeight: 48,
          minWidth: 100,
          borderRadius: 6,
          background: "rgba(99,102,241,0.08)",
          animation: "pulse 1.5s ease-in-out infinite",
          ...externalStyle,
        }}
      />
    );
  }

  if (loadState === "error" || !Comp) {
    return (
      <StructuralInstance
        ref={ref}
        className={externalClassName}
        style={externalStyle}
        {...restProps}
        name={componentName}
        hasChildren={React.Children.count(children) > 0}
      >
        {children}
      </StructuralInstance>
    );
  }

  const OVERLAY_COMPONENTS = new Set([
    "Modal", "Drawer", "Dialog", "Sheet", "Popover", "Tooltip",
    "HoverCard", "DropdownMenu", "ContextMenu", "AlertDialog",
    "Command", "Menubar",
  ]);
  const isOverlay = OVERLAY_COMPONENTS.has(componentName);

  const designModeProps = previewMode
    ? componentProps
    : {
        ...componentProps,
        ...(isOverlay ? { open: false, visible: false } : {}),
      };

  const { children: propsChildren, ...spreadProps } = designModeProps as
    { children?: unknown } & Record<string, unknown>;

  const VOID_COMPONENTS = new Set(["Input", "CommandInput", "InputOTP"]);
  const isVoid = VOID_COMPONENTS.has(componentName);

  const childContent =
    !isVoid && (children != null
      ? children
      : typeof propsChildren === "string" ? propsChildren : null);

  const mergedClassName = [spreadProps.className, externalClassName].filter(Boolean).join(" ") || undefined;
  const mergedStyle = externalStyle
    ? { ...(spreadProps.style as React.CSSProperties | undefined), ...externalStyle }
    : spreadProps.style as React.CSSProperties | undefined;

  const forwarded: Record<string, unknown> = {
    ...spreadProps,
    ...restProps,
    ref,
    ...(mergedClassName ? { className: mergedClassName } : {}),
    ...(mergedStyle ? { style: mergedStyle } : {}),
  };

  if (childContent != null && childContent !== false) {
    return <Comp {...forwarded}>{childContent}</Comp>;
  }
  return <Comp {...forwarded} />;
}
