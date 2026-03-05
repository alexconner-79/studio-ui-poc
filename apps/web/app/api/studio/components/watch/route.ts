/**
 * GET /api/studio/components/watch?root=/abs/path/to/project
 *
 * Server-Sent Events endpoint that watches a scanned codebase directory and
 * emits `component-changed` events whenever a source file changes. The Studio
 * canvas subscribes to this stream via EventSource and invalidates + re-renders
 * any LiveNode whose filePath matches the changed file.
 *
 * Only active in local dev mode (NODE_ENV !== 'production' and no VERCEL env).
 * Automatically closes the chokidar watcher when the client disconnects.
 *
 * Event format:
 *   event: component-changed
 *   data: {"filePath":"/abs/path/to/changed/file.tsx","event":"change"}
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  // Hosted mode guard
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Watch endpoint is only available in local dev mode" },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const root = searchParams.get("root");

  if (!root) {
    return NextResponse.json(
      { error: "root query param is required" },
      { status: 400 },
    );
  }

  // SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send an initial keep-alive comment so the browser EventSource
      // doesn't close the connection before the first real event.
      controller.enqueue(
        encoder.encode(": connected\n\n"),
      );

      let closed = false;

      // Load chokidar — it lives in the monorepo root node_modules
      let chokidar: {
        watch: (
          path: string | string[],
          opts: Record<string, unknown>,
        ) => {
          on: (event: string, cb: (p: string) => void) => unknown;
          close: () => Promise<void>;
        };
      };

      try {
        chokidar = await import("chokidar");
      } catch {
        const msg = "chokidar unavailable — install it in the monorepo root\n\n";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
        return;
      }

      const watcher = chokidar.watch(root, {
        ignored: [
          /(^|[/\\])\../, // dotfiles
          "**/node_modules/**",
          "**/dist/**",
          "**/.next/**",
        ],
        persistent: true,
        ignoreInitial: true,
        // Debounce: batch rapid successive saves
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50,
        },
      });

      function emit(eventType: string, filePath: string) {
        if (closed) return;
        try {
          const data = JSON.stringify({ filePath, event: eventType });
          controller.enqueue(
            encoder.encode(`event: component-changed\ndata: ${data}\n\n`),
          );
        } catch {
          // Stream already closed
        }
      }

      watcher.on("change", (p) => emit("change", p));
      watcher.on("add", (p) => emit("add", p));
      watcher.on("unlink", (p) => emit("unlink", p));

      // Heartbeat every 15 s so the EventSource stays alive through proxies
      const heartbeat = setInterval(() => {
        if (closed) {
          clearInterval(heartbeat);
          return;
        }
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      // Clean up when the client disconnects
      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        watcher.close().catch(() => {});
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
