"use client";

import React from "react";
import type { PresenceUser } from "@/lib/studio/realtime";

export function PresenceAvatars({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2">
      {users.slice(0, 5).map((user) => (
        <div
          key={user.userId}
          className="relative"
          title={user.name}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white border-2 border-background"
            style={{ backgroundColor: user.color }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border border-background" />
        </div>
      ))}
      {users.length > 5 && (
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-medium bg-zinc-200 dark:bg-zinc-700 border-2 border-background">
          +{users.length - 5}
        </div>
      )}
    </div>
  );
}

export function PresenceCursors({ users, canvasRef }: { users: PresenceUser[]; canvasRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <>
      {users.map((user) => {
        if (!user.cursor) return null;
        return (
          <div
            key={user.userId}
            className="absolute pointer-events-none z-50 transition-all duration-100"
            style={{ left: user.cursor.x, top: user.cursor.y }}
          >
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              <path
                d="M0 0L16 12H6L3 20L0 0Z"
                fill={user.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            <span
              className="ml-3 -mt-1 text-[10px] font-medium text-white px-1.5 py-0.5 rounded whitespace-nowrap"
              style={{ backgroundColor: user.color }}
            >
              {user.name}
            </span>
          </div>
        );
      })}
    </>
  );
}

export function PresenceNodeHighlights({ users }: { users: PresenceUser[] }) {
  return (
    <style>{`
      ${users
        .filter((u) => u.selectedNodeId)
        .map(
          (u) => `
            [data-studio-node="${u.selectedNodeId}"] {
              outline: 2px solid ${u.color} !important;
              outline-offset: 2px;
            }
            [data-studio-node="${u.selectedNodeId}"]::after {
              content: '${u.name}';
              position: absolute;
              top: -18px;
              right: 0;
              background: ${u.color};
              color: white;
              font-size: 10px;
              padding: 1px 6px;
              border-radius: 2px;
              font-family: monospace;
              pointer-events: none;
              z-index: 50;
            }
          `
        )
        .join("\n")}
    `}</style>
  );
}
