"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/lib/studio/store";
import { buildTokenCSS } from "@/lib/studio/token-to-css";

/**
 * Renders a <style> tag that emits the active DS tokens as CSS custom
 * properties scoped to [data-canvas-root].  Updates reactively whenever the
 * designTokens in the store change — no page reload required.
 *
 * Mount this anywhere inside the canvas tree.  The CSS selector handles scoping
 * so the Studio editor chrome is never affected.
 */
export function CanvasTokenBridge() {
  const designTokens = useEditorStore((s) => s.designTokens);

  const styleContent = useMemo(() => {
    const raw = designTokens?.raw;
    if (!raw || typeof raw !== "object") return null;
    return buildTokenCSS(raw as Record<string, unknown>);
  }, [designTokens]);

  if (!styleContent) return null;

  return (
    <style
      data-canvas-token-bridge
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: styleContent }}
    />
  );
}
