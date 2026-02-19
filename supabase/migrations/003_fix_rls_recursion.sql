-- Fix infinite recursion in RLS policies between projects <-> project_members
-- Run this in the Supabase SQL Editor AFTER 002_project_members.sql

-- ─────────────────────────────────────────────────────────────
-- Helper function: check project ownership without triggering RLS
-- security definer runs as the function owner, bypassing RLS
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_project_owner(p_project_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.projects
    where id = p_project_id and owner_id = auth.uid()
  );
$$ language sql security definer;

-- Helper: check if user is a member of a project (bypasses RLS)
create or replace function public.is_project_member(p_project_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id and user_id = auth.uid()
  );
$$ language sql security definer;

-- Helper: check if user is an editor/admin member (bypasses RLS)
create or replace function public.is_project_editor(p_project_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id
      and user_id = auth.uid()
      and role in ('editor', 'admin')
  );
$$ language sql security definer;

-- ─────────────────────────────────────────────────────────────
-- Fix projects policies: use helper functions
-- ─────────────────────────────────────────────────────────────
drop policy if exists "Users can view own or shared projects" on public.projects;

create policy "Users can view own or shared projects"
  on public.projects for select
  using (
    auth.uid() = owner_id
    or public.is_project_member(id)
  );

-- ─────────────────────────────────────────────────────────────
-- Fix project_members policies: use helper functions
-- ─────────────────────────────────────────────────────────────
drop policy if exists "Owners can view project members" on public.project_members;
drop policy if exists "Owners can add project members" on public.project_members;
drop policy if exists "Owners can remove project members" on public.project_members;
drop policy if exists "Owners can update member roles" on public.project_members;

create policy "Owners and members can view project members"
  on public.project_members for select
  using (
    public.is_project_owner(project_id)
    or user_id = auth.uid()
  );

create policy "Owners can add project members"
  on public.project_members for insert
  with check (
    public.is_project_owner(project_id)
  );

create policy "Owners or self can remove project members"
  on public.project_members for delete
  using (
    public.is_project_owner(project_id)
    or user_id = auth.uid()
  );

create policy "Owners can update member roles"
  on public.project_members for update
  using (
    public.is_project_owner(project_id)
  );

-- ─────────────────────────────────────────────────────────────
-- Fix screens policies: use helper functions
-- ─────────────────────────────────────────────────────────────
drop policy if exists "Users can view screens in own or shared projects" on public.screens;
drop policy if exists "Editors can create screens in shared projects" on public.screens;
drop policy if exists "Editors can update screens in shared projects" on public.screens;
drop policy if exists "Users can delete screens in their projects" on public.screens;

create policy "Users can view screens in own or shared projects"
  on public.screens for select
  using (
    public.is_project_owner(project_id)
    or public.is_project_member(project_id)
  );

create policy "Owners and editors can create screens"
  on public.screens for insert
  with check (
    public.is_project_owner(project_id)
    or public.is_project_editor(project_id)
  );

create policy "Owners and editors can update screens"
  on public.screens for update
  using (
    public.is_project_owner(project_id)
    or public.is_project_editor(project_id)
  );

create policy "Owners can delete screens"
  on public.screens for delete
  using (
    public.is_project_owner(project_id)
  );

-- ─────────────────────────────────────────────────────────────
-- Fix design_tokens policies: use helper functions
-- ─────────────────────────────────────────────────────────────
drop policy if exists "Users can view tokens in own or shared projects" on public.design_tokens;
drop policy if exists "Editors can upsert tokens in shared projects" on public.design_tokens;
drop policy if exists "Editors can update tokens in shared projects" on public.design_tokens;

create policy "Users can view tokens in own or shared projects"
  on public.design_tokens for select
  using (
    public.is_project_owner(project_id)
    or public.is_project_member(project_id)
  );

create policy "Owners and editors can insert tokens"
  on public.design_tokens for insert
  with check (
    public.is_project_owner(project_id)
    or public.is_project_editor(project_id)
  );

create policy "Owners and editors can update tokens"
  on public.design_tokens for update
  using (
    public.is_project_owner(project_id)
    or public.is_project_editor(project_id)
  );

-- ─────────────────────────────────────────────────────────────
-- Fix components policies: use helper functions
-- ─────────────────────────────────────────────────────────────
drop policy if exists "Users can view components in own or shared projects" on public.components;
drop policy if exists "Editors can create components in shared projects" on public.components;
drop policy if exists "Editors can update components in shared projects" on public.components;
drop policy if exists "Users can delete components in their projects" on public.components;

create policy "Users can view components in own or shared projects"
  on public.components for select
  using (
    public.is_project_owner(project_id)
    or public.is_project_member(project_id)
  );

create policy "Owners and editors can create components"
  on public.components for insert
  with check (
    public.is_project_owner(project_id)
    or public.is_project_editor(project_id)
  );

create policy "Owners and editors can update components"
  on public.components for update
  using (
    public.is_project_owner(project_id)
    or public.is_project_editor(project_id)
  );

create policy "Owners can delete components"
  on public.components for delete
  using (
    public.is_project_owner(project_id)
  );

-- ─────────────────────────────────────────────────────────────
-- Fix pending_invites policies: use helper functions
-- ─────────────────────────────────────────────────────────────
drop policy if exists "Owners can view pending invites" on public.pending_invites;
drop policy if exists "Owners can create pending invites" on public.pending_invites;
drop policy if exists "Owners can delete pending invites" on public.pending_invites;

create policy "Owners can view pending invites"
  on public.pending_invites for select
  using (
    public.is_project_owner(project_id)
  );

create policy "Owners can create pending invites"
  on public.pending_invites for insert
  with check (
    public.is_project_owner(project_id)
  );

create policy "Owners can delete pending invites"
  on public.pending_invites for delete
  using (
    public.is_project_owner(project_id)
  );

-- ─────────────────────────────────────────────────────────────
-- Fix assets policies: use helper functions
-- ─────────────────────────────────────────────────────────────
drop policy if exists "Users can view assets in their projects" on public.assets;
drop policy if exists "Users can create assets in their projects" on public.assets;
drop policy if exists "Users can delete assets in their projects" on public.assets;

create policy "Users can view assets in own or shared projects"
  on public.assets for select
  using (
    public.is_project_owner(project_id)
    or public.is_project_member(project_id)
  );

create policy "Owners and editors can create assets"
  on public.assets for insert
  with check (
    public.is_project_owner(project_id)
    or public.is_project_editor(project_id)
  );

create policy "Owners can delete assets"
  on public.assets for delete
  using (
    public.is_project_owner(project_id)
  );
