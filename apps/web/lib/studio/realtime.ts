"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Node } from "./types";

export type PresenceUser = {
  userId: string;
  name: string;
  color: string;
  selectedNodeId?: string | null;
  cursor?: { x: number; y: number } | null;
  lastSeen: number;
};

type RealtimeCallbacks = {
  onRemoteSpecChange?: (tree: Node) => void;
  onPresenceChange?: (users: PresenceUser[]) => void;
};

const PRESENCE_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e",
];

function pickColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

export function useRealtimeCollaboration(
  screenId: string | null,
  currentUserId: string | null,
  currentUserName: string | null,
  callbacks: RealtimeCallbacks
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!screenId || !currentUserId) return;

    const supabase = createClient();
    const channelName = `screen:${screenId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: currentUserId } },
    });

    channelRef.current = channel;

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{
        userId: string;
        name: string;
        color: string;
        selectedNodeId?: string | null;
        cursor?: { x: number; y: number } | null;
      }>();

      const users: PresenceUser[] = [];
      for (const [, presences] of Object.entries(state)) {
        for (const p of presences) {
          if (p.userId !== currentUserId) {
            users.push({
              userId: p.userId,
              name: p.name,
              color: p.color,
              selectedNodeId: p.selectedNodeId,
              cursor: p.cursor,
              lastSeen: Date.now(),
            });
          }
        }
      }
      setPresenceUsers(users);
      callbacks.onPresenceChange?.(users);
    });

    channel.on("broadcast", { event: "spec-update" }, (payload) => {
      const data = payload.payload as { tree: Node; senderId: string };
      if (data.senderId !== currentUserId && data.tree) {
        callbacks.onRemoteSpecChange?.(data.tree);
      }
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          userId: currentUserId,
          name: currentUserName || "Anonymous",
          color: pickColor(currentUserId),
          selectedNodeId: null,
          cursor: null,
        });
      }
    });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenId, currentUserId]);

  const broadcastSpecUpdate = useCallback(
    (tree: Node) => {
      if (!channelRef.current || !currentUserId) return;
      channelRef.current.send({
        type: "broadcast",
        event: "spec-update",
        payload: { tree, senderId: currentUserId },
      });
    },
    [currentUserId]
  );

  const updatePresence = useCallback(
    (updates: { selectedNodeId?: string | null; cursor?: { x: number; y: number } | null }) => {
      if (!channelRef.current || !currentUserId) return;
      channelRef.current.track({
        userId: currentUserId,
        name: currentUserName || "Anonymous",
        color: pickColor(currentUserId),
        ...updates,
      });
    },
    [currentUserId, currentUserName]
  );

  return {
    presenceUsers,
    broadcastSpecUpdate,
    updatePresence,
    isConnected: !!channelRef.current,
  };
}

export function useCurrentUser() {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        setUser({
          id: authUser.id,
          name: authUser.user_metadata?.full_name || authUser.email || "Anonymous",
        });
      }
    });
  }, []);

  return user;
}
