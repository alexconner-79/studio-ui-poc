"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useEditorStore } from "@/lib/studio/store";

type Rect = { top: number; left: number; width: number; height: number };

function getScale(el: HTMLElement): number {
  const t = el.closest("[data-canvas-transform]") as HTMLElement | null;
  if (!t) return 1;
  const m = t.style.transform.match(/scale\(([\d.]+)\)/);
  return m ? parseFloat(m[1]) : 1;
}

const TEXT_STYLE_PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textDecoration",
  "textTransform",
  "color",
  "wordSpacing",
  "whiteSpace",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
] as const;

export function InlineTextEditor() {
  const nodeId = useEditorStore((s) => s.inlineEditingNodeId);
  const setInlineEditingNodeId = useEditorStore((s) => s.setInlineEditingNodeId);
  const updateNodeProps = useEditorStore((s) => s.updateNodeProps);
  const spec = useEditorStore((s) => s.spec);

  const editorRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [styles, setStyles] = useState<React.CSSProperties>({});
  const [initialText, setInitialText] = useState("");
  const committedRef = useRef(false);

  // Find the current text from the spec
  const findNodeText = useCallback(() => {
    if (!spec || !nodeId) return "";
    const find = (node: { id: string; props?: Record<string, unknown>; children?: typeof node[] }): string | null => {
      if (node.id === nodeId) return String(node.props?.text ?? "");
      if (node.children) {
        for (const child of node.children) {
          const result = find(child as typeof node);
          if (result !== null) return result;
        }
      }
      return null;
    };
    return find(spec.tree as Parameters<typeof find>[0]) ?? "";
  }, [spec, nodeId]);

  // Measure target node and extract styles
  useEffect(() => {
    if (!nodeId) {
      setRect(null);
      return;
    }

    const el = document.querySelector(
      `[data-studio-node="${nodeId}"]`,
    ) as HTMLElement | null;
    if (!el) {
      setInlineEditingNodeId(null);
      return;
    }

    const canvas = el.closest("[data-canvas-root]") as HTMLElement | null;
    if (!canvas) {
      setInlineEditingNodeId(null);
      return;
    }

    const scale = getScale(canvas);
    const cr = canvas.getBoundingClientRect();
    const er = el.getBoundingClientRect();

    setRect({
      top: (er.top - cr.top) / scale,
      left: (er.left - cr.left) / scale,
      width: er.width / scale,
      height: er.height / scale,
    });

    // Find the text element inside (first p, h1-h6, or span)
    const textEl =
      el.querySelector("p, h1, h2, h3, h4, h5, h6, span") ?? el;
    const cs = window.getComputedStyle(textEl);
    const extracted: React.CSSProperties = {};
    for (const prop of TEXT_STYLE_PROPS) {
      const val = cs.getPropertyValue(
        prop.replace(/([A-Z])/g, "-$1").toLowerCase(),
      );
      if (val) (extracted as Record<string, string>)[prop] = val;
    }
    setStyles(extracted);

    const text = findNodeText();
    setInitialText(text);
    committedRef.current = false;
  }, [nodeId, setInlineEditingNodeId, findNodeText]);

  // Auto-focus and select all text when editor appears
  useEffect(() => {
    if (!rect || !editorRef.current) return;
    const editor = editorRef.current;
    editor.textContent = initialText;
    editor.focus();

    // Select all text
    const range = document.createRange();
    range.selectNodeContents(editor);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [rect, initialText]);

  const commit = useCallback(() => {
    if (committedRef.current || !nodeId) return;
    committedRef.current = true;
    const newText = editorRef.current?.textContent ?? "";
    if (newText !== initialText) {
      updateNodeProps(nodeId, { text: newText });
    }
    setInlineEditingNodeId(null);
  }, [nodeId, initialText, updateNodeProps, setInlineEditingNodeId]);

  const cancel = useCallback(() => {
    committedRef.current = true;
    setInlineEditingNodeId(null);
  }, [setInlineEditingNodeId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancel();
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        commit();
      }
      // Stop all key events from reaching the editor shortcuts
      e.stopPropagation();
    },
    [commit, cancel],
  );

  const handleBlur = useCallback(() => {
    // Small delay to allow click-away detection
    setTimeout(() => {
      if (!committedRef.current) commit();
    }, 50);
  }, [commit]);

  if (!nodeId || !rect) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: rect.top,
        left: rect.left,
        width: rect.width,
        minHeight: rect.height,
        zIndex: 60,
        pointerEvents: "auto",
      }}
    >
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        style={{
          ...styles,
          width: "100%",
          minHeight: "100%",
          outline: "2px solid #3b82f6",
          outlineOffset: 1,
          background: "rgba(255,255,255,0.97)",
          borderRadius: 2,
          boxSizing: "border-box",
          cursor: "text",
          margin: 0,
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
    </div>
  );
}
