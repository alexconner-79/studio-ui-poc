"use client";

import React, { useState, useEffect, useCallback } from "react";

type MemberRole = "viewer" | "editor" | "admin";

interface MemberEntry {
  user_id: string;
  role: MemberRole;
  profile?: { full_name?: string | null; avatar_url?: string | null; email?: string };
}

interface PendingEntry {
  email: string;
  role: MemberRole;
  created_at: string;
}

interface ShareModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

export function ShareModal({ projectId, projectName, onClose }: ShareModalProps) {
  const [members, setMembers] = useState<MemberEntry[]>([]);
  const [pending, setPending] = useState<PendingEntry[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/studio/projects/${projectId}/members`);
      const data = await res.json();
      setMembers(data.members ?? []);
      setPending(data.pendingInvites ?? []);
    } catch {
      // silently fail on load
    }
  }, [projectId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      setError("Enter a valid email address");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/studio/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to invite");
      } else if (data.pendingInvite) {
        setSuccess(`Invite sent to ${email} (will join when they sign up)`);
      } else {
        setSuccess(`${email} added as ${role}`);
      }

      setEmail("");
      await fetchMembers();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    await fetch(`/api/studio/projects/${projectId}/members?userId=${userId}`, { method: "DELETE" });
    await fetchMembers();
  };

  const handleRemovePending = async (pendingEmail: string) => {
    await fetch(`/api/studio/projects/${projectId}/members?email=${encodeURIComponent(pendingEmail)}`, { method: "DELETE" });
    await fetchMembers();
  };

  const handleRoleChange = async (userId: string, newRole: MemberRole) => {
    await fetch(`/api/studio/projects/${projectId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: newRole }),
    });
    await fetchMembers();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-background rounded-xl shadow-2xl w-full max-w-lg border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">Share Project</h2>
            <p className="text-sm text-muted-foreground">{projectName}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
          >
            &times;
          </button>
        </div>

        {/* Invite form */}
        <form onSubmit={handleInvite} className="px-6 py-4 border-b">
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 h-9 px-3 text-sm border rounded-md bg-background"
              disabled={loading}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              className="h-9 px-2 text-sm border rounded-md bg-background"
              disabled={loading}
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit"
              disabled={loading || !email}
              className="h-9 px-4 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "..." : "Invite"}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
          {success && <p className="text-xs text-green-600 mt-2">{success}</p>}
        </form>

        {/* Members list */}
        <div className="px-6 py-4 max-h-64 overflow-y-auto">
          {members.length === 0 && pending.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No collaborators yet. Invite someone above.
            </p>
          )}

          {members.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-600 dark:text-blue-300">
                  {(m.profile?.full_name?.[0] ?? m.profile?.email?.[0] ?? "?").toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{m.profile?.full_name || "Unknown"}</p>
                  <p className="text-xs text-muted-foreground">{m.profile?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={m.role}
                  onChange={(e) => handleRoleChange(m.user_id, e.target.value as MemberRole)}
                  className="h-7 px-2 text-xs border rounded bg-background"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
                <button
                  onClick={() => handleRemoveMember(m.user_id)}
                  className="w-7 h-7 rounded hover:bg-red-100 dark:hover:bg-red-900 flex items-center justify-center text-red-500 text-xs"
                  title="Remove"
                >
                  &times;
                </button>
              </div>
            </div>
          ))}

          {pending.map((p) => (
            <div key={p.email} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center text-xs font-semibold text-amber-600 dark:text-amber-300">
                  ?
                </div>
                <div>
                  <p className="text-sm font-medium">{p.email}</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Pending invite ({p.role})</p>
                </div>
              </div>
              <button
                onClick={() => handleRemovePending(p.email)}
                className="w-7 h-7 rounded hover:bg-red-100 dark:hover:bg-red-900 flex items-center justify-center text-red-500 text-xs"
                title="Cancel invite"
              >
                &times;
              </button>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t bg-muted/30 rounded-b-xl">
          <p className="text-xs text-muted-foreground">
            Viewers can view screens. Editors can create and modify. Admins can manage members.
          </p>
        </div>
      </div>
    </div>
  );
}
