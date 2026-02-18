import { NextResponse } from "next/server";
import {
  isSupabaseConfigured,
  listProjectMembers,
  addProjectMember,
  removeProjectMember,
  updateProjectMemberRole,
  listPendingInvites,
  removePendingInvite,
} from "@/lib/supabase/queries";

/** GET /api/studio/projects/[id]/members -- list members + pending invites */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ members: [], pendingInvites: [] });
    }

    const [members, pendingInvites] = await Promise.all([
      listProjectMembers(projectId),
      listPendingInvites(projectId),
    ]);

    return NextResponse.json({ members, pendingInvites });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/studio/projects/[id]/members -- invite a user by email */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const { email, role } = body as { email: string; role?: "viewer" | "editor" | "admin" };

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Collaboration requires Supabase" }, { status: 400 });
    }

    const result = await addProjectMember(projectId, email, role ?? "editor");
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/studio/projects/[id]/members -- remove a member or pending invite */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const email = searchParams.get("email");

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Collaboration requires Supabase" }, { status: 400 });
    }

    if (userId) {
      const ok = await removeProjectMember(projectId, userId);
      return ok
        ? NextResponse.json({ success: true })
        : NextResponse.json({ error: "Failed to remove member" }, { status: 400 });
    }

    if (email) {
      const ok = await removePendingInvite(projectId, email);
      return ok
        ? NextResponse.json({ success: true })
        : NextResponse.json({ error: "Failed to remove invite" }, { status: 400 });
    }

    return NextResponse.json({ error: "userId or email required" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH /api/studio/projects/[id]/members -- update a member's role */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const { userId, role } = body as { userId: string; role: "viewer" | "editor" | "admin" };

    if (!userId || !role) {
      return NextResponse.json({ error: "userId and role are required" }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Collaboration requires Supabase" }, { status: 400 });
    }

    const ok = await updateProjectMemberRole(projectId, userId, role);
    return ok
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: "Failed to update role" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
