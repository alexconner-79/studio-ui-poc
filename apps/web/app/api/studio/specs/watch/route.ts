/**
 * GET /api/studio/specs/watch
 *
 * Server-Sent Events endpoint that watches the spec/screens/ directory and
 * emits `spec-changed` events whenever a .screen.json file is modified
 * externally (e.g. by Cursor or Claude Code editing the file directly).
 *
 * The Studio editor subscribes to this stream and hot-reloads the current
 * screen's spec when its file changes on disk.
 *
 * Local dev mode only — returns 403 on Vercel/production.
 *
 * Event format:
 *   event: spec-changed
 *   data: {"fileName":"home.screen.json","screenName":"home","event":"change"}
 */

import { NextResponse } from "next/server";
import { SCREENS_DIR } from "@/lib/studio/config-paths";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Watch endpoint is only available in local dev mode" },
      { status: 403 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));

      let closed = false;

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
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "chokidar unavailable" })}\n\n`),
        );
        controller.close();
        return;
      }

      const watcher = chokidar.watch(SCREENS_DIR, {
        ignored: [/(^|[/\\])\./],
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 200,
          pollInterval: 50,
        },
      });

      function emit(eventType: string, filePath: string) {
        if (closed) return;
        // Only care about .screen.json files
        if (!filePath.endsWith(".screen.json")) return;
        try {
          const parts = filePath.replace(/\\/g, "/").split("/");
          const fileName = parts[parts.length - 1] || "";
          const screenName = fileName.replace(".screen.json", "");
          const data = JSON.stringify({ fileName, screenName, event: eventType });
          controller.enqueue(
            encoder.encode(`event: spec-changed\ndata: ${data}\n\n`),
          );
        } catch {
          // Stream already closed
        }
      }

      watcher.on("change", (p) => emit("change", p));
      watcher.on("add", (p) => emit("add", p));
      watcher.on("unlink", (p) => emit("unlink", p));

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
