/**
 * Data Access Layer for Studio UI.
 *
 * Dual-mode: uses Supabase when configured, falls back to filesystem
 * for local development without Supabase.
 */

import { createClient as createServerClient } from "./server";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  framework: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Screen {
  id: string;
  project_id: string;
  name: string;
  spec: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DesignTokens {
  id: string;
  project_id: string;
  tokens: Record<string, unknown>;
  updated_at: string;
}

export interface Component {
  id: string;
  project_id: string;
  name: string;
  spec: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Version {
  id: string;
  screen_id: string;
  spec: Record<string, unknown>;
  label: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  created_at: string;
  updated_at: string;
}

// ─────────────────────────────────────────────────────────────
// Check if Supabase is configured
// ─────────────────────────────────────────────────────────────

export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// ─────────────────────────────────────────────────────────────
// Profile queries
// ─────────────────────────────────────────────────────────────

export async function getProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data as Profile | null;
}

export async function updateProfile(updates: Partial<Pick<Profile, "full_name" | "avatar_url">>): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();

  return data as Profile | null;
}

// ─────────────────────────────────────────────────────────────
// Project queries
// ─────────────────────────────────────────────────────────────

export async function listProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  // RLS handles filtering: returns owned projects + shared projects (via 002 migration)
  const { data } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  return (data ?? []) as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  return data as Project | null;
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", user.id)
    .eq("slug", slug)
    .single();
  return data as Project | null;
}

export async function createProject(input: {
  name: string;
  slug: string;
  framework?: string;
  config?: Record<string, unknown>;
}): Promise<Project | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      name: input.name,
      slug: input.slug,
      framework: input.framework ?? "nextjs",
      config: input.config ?? {},
    })
    .select()
    .single();
  return data as Project | null;
}

export async function updateProject(id: string, updates: Partial<Pick<Project, "name" | "framework" | "config">>): Promise<Project | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  return data as Project | null;
}

export async function deleteProject(id: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id);
  return !error;
}

// ─────────────────────────────────────────────────────────────
// Screen queries
// ─────────────────────────────────────────────────────────────

export async function listScreens(projectId: string): Promise<Screen[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("screens")
    .select("*")
    .eq("project_id", projectId)
    .order("name");
  return (data ?? []) as Screen[];
}

export async function getScreen(projectId: string, name: string): Promise<Screen | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("screens")
    .select("*")
    .eq("project_id", projectId)
    .eq("name", name)
    .single();
  return data as Screen | null;
}

export async function getScreenById(id: string): Promise<Screen | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("screens")
    .select("*")
    .eq("id", id)
    .single();
  return data as Screen | null;
}

export async function upsertScreen(projectId: string, name: string, spec: Record<string, unknown>): Promise<Screen | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("screens")
    .upsert(
      { project_id: projectId, name, spec },
      { onConflict: "project_id,name" }
    )
    .select()
    .single();
  return data as Screen | null;
}

export async function deleteScreen(projectId: string, name: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("screens")
    .delete()
    .eq("project_id", projectId)
    .eq("name", name);
  return !error;
}

// ─────────────────────────────────────────────────────────────
// Design Token queries
// ─────────────────────────────────────────────────────────────

export async function getTokens(projectId: string): Promise<Record<string, unknown> | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("design_tokens")
    .select("tokens")
    .eq("project_id", projectId)
    .single();
  return data?.tokens ?? null;
}

export async function upsertTokens(projectId: string, tokens: Record<string, unknown>): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("design_tokens")
    .upsert(
      { project_id: projectId, tokens },
      { onConflict: "project_id" }
    );
  return !error;
}

// ─────────────────────────────────────────────────────────────
// Component queries
// ─────────────────────────────────────────────────────────────

export async function listComponents(projectId: string): Promise<Component[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("components")
    .select("*")
    .eq("project_id", projectId)
    .order("name");
  return (data ?? []) as Component[];
}

export async function upsertComponent(projectId: string, name: string, spec: Record<string, unknown>): Promise<Component | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("components")
    .upsert(
      { project_id: projectId, name, spec },
      { onConflict: "project_id,name" }
    )
    .select()
    .single();
  return data as Component | null;
}

export async function deleteComponent(projectId: string, name: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("components")
    .delete()
    .eq("project_id", projectId)
    .eq("name", name);
  return !error;
}

// ─────────────────────────────────────────────────────────────
// Version queries
// ─────────────────────────────────────────────────────────────

export async function listVersions(screenId: string, limit = 50): Promise<Version[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("versions")
    .select("*")
    .eq("screen_id", screenId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Version[];
}

export async function createVersion(screenId: string, spec: Record<string, unknown>, label?: string): Promise<Version | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("versions")
    .insert({ screen_id: screenId, spec, label: label ?? null })
    .select()
    .single();
  return data as Version | null;
}

export async function getVersion(id: string): Promise<Version | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("versions")
    .select("*")
    .eq("id", id)
    .single();
  return data as Version | null;
}

// ─────────────────────────────────────────────────────────────
// Project Member queries (collaboration)
// ─────────────────────────────────────────────────────────────

export interface ProjectMember {
  project_id: string;
  user_id: string;
  role: "viewer" | "editor" | "admin";
  invited_by: string | null;
  created_at: string;
  profile?: Pick<Profile, "full_name" | "avatar_url"> & { email?: string };
}

export interface PendingInvite {
  id: string;
  project_id: string;
  email: string;
  role: "viewer" | "editor" | "admin";
  invited_by: string | null;
  created_at: string;
}

export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("project_members")
    .select("*, profiles:user_id(full_name, avatar_url)")
    .eq("project_id", projectId);
  return (data ?? []) as ProjectMember[];
}

export async function addProjectMember(
  projectId: string,
  email: string,
  role: "viewer" | "editor" | "admin" = "editor"
): Promise<{ member?: ProjectMember; pendingInvite?: PendingInvite; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" };
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Look up user by email in profiles via auth admin or a lookup
  const { data: targetUsers } = await supabase
    .from("profiles")
    .select("id")
    .limit(1);

  // Try to find user by email in auth.users (via RPC or direct lookup)
  // Since we can't query auth.users directly with anon key, we check
  // if there's a matching profile. If not, create a pending invite.
  const { data: authLookup } = await supabase.rpc("lookup_user_by_email", { lookup_email: email }).single();
  const lookupResult = authLookup as Record<string, unknown> | null;

  if (lookupResult?.id) {
    const { data, error } = await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id: lookupResult.id as string, role, invited_by: user.id })
      .select()
      .single();
    if (error) return { error: error.message };
    return { member: data as ProjectMember };
  }

  // User doesn't exist, create pending invite
  const { data: invite, error: invErr } = await supabase
    .from("pending_invites")
    .upsert(
      { project_id: projectId, email, role, invited_by: user.id },
      { onConflict: "project_id,email" }
    )
    .select()
    .single();
  if (invErr) return { error: invErr.message };
  return { pendingInvite: invite as PendingInvite };
}

export async function removeProjectMember(projectId: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  return !error;
}

export async function updateProjectMemberRole(
  projectId: string,
  userId: string,
  role: "viewer" | "editor" | "admin"
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("project_members")
    .update({ role })
    .eq("project_id", projectId)
    .eq("user_id", userId);
  return !error;
}

export async function listPendingInvites(projectId: string): Promise<PendingInvite[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("pending_invites")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return (data ?? []) as PendingInvite[];
}

export async function removePendingInvite(projectId: string, email: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("pending_invites")
    .delete()
    .eq("project_id", projectId)
    .eq("email", email);
  return !error;
}

// ─────────────────────────────────────────────────────────────
// Admin queries (requires admin role)
// ─────────────────────────────────────────────────────────────

export async function isAdmin(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.role === "admin";
}

export async function adminListAllProjects(): Promise<Project[]> {
  if (!isSupabaseConfigured()) return [];
  if (!(await isAdmin())) return [];
  const supabase = await createServerClient();
  // Admin bypass: use service role or a view. For now, RLS limits this.
  const { data } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as Project[];
}

export async function adminListAllProfiles(): Promise<Profile[]> {
  if (!isSupabaseConfigured()) return [];
  if (!(await isAdmin())) return [];
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  return (data ?? []) as Profile[];
}
