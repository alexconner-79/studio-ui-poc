-- Project Members (collaboration / project sharing)
-- Run this in the Supabase SQL Editor AFTER 001_initial_schema.sql

-- ─────────────────────────────────────────────────────────────
-- Project Members table
-- ─────────────────────────────────────────────────────────────
create table public.project_members (
  project_id  uuid references public.projects(id) on delete cascade not null,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  role        text not null default 'editor' check (role in ('viewer', 'editor', 'admin')),
  invited_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  primary key (project_id, user_id)
);

alter table public.project_members enable row level security;

-- Owner can manage members of their projects
create policy "Owners can view project members"
  on public.project_members for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_members.project_id
        and projects.owner_id = auth.uid()
    )
    or user_id = auth.uid()
  );

create policy "Owners can add project members"
  on public.project_members for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = project_members.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "Owners can remove project members"
  on public.project_members for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_members.project_id
        and projects.owner_id = auth.uid()
    )
    or user_id = auth.uid()
  );

create policy "Owners can update member roles"
  on public.project_members for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = project_members.project_id
        and projects.owner_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Pending invites (for users who haven't signed up yet)
-- ─────────────────────────────────────────────────────────────
create table public.pending_invites (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid references public.projects(id) on delete cascade not null,
  email       text not null,
  role        text not null default 'editor' check (role in ('viewer', 'editor', 'admin')),
  invited_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  unique(project_id, email)
);

alter table public.pending_invites enable row level security;

create policy "Owners can view pending invites"
  on public.pending_invites for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = pending_invites.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "Owners can create pending invites"
  on public.pending_invites for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = pending_invites.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "Owners can delete pending invites"
  on public.pending_invites for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = pending_invites.project_id
        and projects.owner_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Update RLS on projects: members can also view/update
-- ─────────────────────────────────────────────────────────────

-- Drop existing restrictive policies
drop policy if exists "Users can view their own projects" on public.projects;

-- Replace with policy that includes members
create policy "Users can view own or shared projects"
  on public.projects for select
  using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.project_members
      where project_members.project_id = projects.id
        and project_members.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Update RLS on screens: members can also access
-- ─────────────────────────────────────────────────────────────

drop policy if exists "Users can view screens in their projects" on public.screens;
drop policy if exists "Users can create screens in their projects" on public.screens;
drop policy if exists "Users can update screens in their projects" on public.screens;

create policy "Users can view screens in own or shared projects"
  on public.screens for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = screens.project_id
        and (
          projects.owner_id = auth.uid()
          or exists (
            select 1 from public.project_members
            where project_members.project_id = projects.id
              and project_members.user_id = auth.uid()
          )
        )
    )
  );

create policy "Editors can create screens in shared projects"
  on public.screens for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = screens.project_id
        and (
          projects.owner_id = auth.uid()
          or exists (
            select 1 from public.project_members
            where project_members.project_id = projects.id
              and project_members.user_id = auth.uid()
              and project_members.role in ('editor', 'admin')
          )
        )
    )
  );

create policy "Editors can update screens in shared projects"
  on public.screens for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = screens.project_id
        and (
          projects.owner_id = auth.uid()
          or exists (
            select 1 from public.project_members
            where project_members.project_id = projects.id
              and project_members.user_id = auth.uid()
              and project_members.role in ('editor', 'admin')
          )
        )
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Update RLS on design_tokens: members can also access
-- ─────────────────────────────────────────────────────────────

drop policy if exists "Users can view tokens in their projects" on public.design_tokens;
drop policy if exists "Users can upsert tokens in their projects" on public.design_tokens;
drop policy if exists "Users can update tokens in their projects" on public.design_tokens;

create policy "Users can view tokens in own or shared projects"
  on public.design_tokens for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = design_tokens.project_id
        and (
          projects.owner_id = auth.uid()
          or exists (
            select 1 from public.project_members
            where project_members.project_id = projects.id
              and project_members.user_id = auth.uid()
          )
        )
    )
  );

create policy "Editors can upsert tokens in shared projects"
  on public.design_tokens for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = design_tokens.project_id
        and (
          projects.owner_id = auth.uid()
          or exists (
            select 1 from public.project_members
            where project_members.project_id = projects.id
              and project_members.user_id = auth.uid()
              and project_members.role in ('editor', 'admin')
          )
        )
    )
  );

create policy "Editors can update tokens in shared projects"
  on public.design_tokens for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = design_tokens.project_id
        and (
          projects.owner_id = auth.uid()
          or exists (
            select 1 from public.project_members
            where project_members.project_id = projects.id
              and project_members.user_id = auth.uid()
              and project_members.role in ('editor', 'admin')
          )
        )
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Update RLS on components: members can also access
-- ─────────────────────────────────────────────────────────────

drop policy if exists "Users can view components in their projects" on public.components;
drop policy if exists "Users can create components in their projects" on public.components;
drop policy if exists "Users can update components in their projects" on public.components;

create policy "Users can view components in own or shared projects"
  on public.components for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = components.project_id
        and (
          projects.owner_id = auth.uid()
          or exists (
            select 1 from public.project_members
            where project_members.project_id = projects.id
              and project_members.user_id = auth.uid()
          )
        )
    )
  );

create policy "Editors can create components in shared projects"
  on public.components for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = components.project_id
        and (
          projects.owner_id = auth.uid()
          or exists (
            select 1 from public.project_members
            where project_members.project_id = projects.id
              and project_members.user_id = auth.uid()
              and project_members.role in ('editor', 'admin')
          )
        )
    )
  );

create policy "Editors can update components in shared projects"
  on public.components for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = components.project_id
        and (
          projects.owner_id = auth.uid()
          or exists (
            select 1 from public.project_members
            where project_members.project_id = projects.id
              and project_members.user_id = auth.uid()
              and project_members.role in ('editor', 'admin')
          )
        )
    )
  );

-- ─────────────────────────────────────────────────────────────
-- RPC: look up a user by email (used by invite flow)
-- ─────────────────────────────────────────────────────────────
create or replace function public.lookup_user_by_email(lookup_email text)
returns table(id uuid) as $$
begin
  return query
    select au.id from auth.users au where au.email = lookup_email limit 1;
end;
$$ language plpgsql security definer;

-- ─────────────────────────────────────────────────────────────
-- Auto-convert pending invites when a user signs up
-- ─────────────────────────────────────────────────────────────
create or replace function public.convert_pending_invites()
returns trigger as $$
begin
  insert into public.project_members (project_id, user_id, role, invited_by)
  select pi.project_id, new.id, pi.role, pi.invited_by
  from public.pending_invites pi
  where pi.email = new.email;

  delete from public.pending_invites where email = new.email;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_user_created_convert_invites
  after insert on auth.users
  for each row execute function public.convert_pending_invites();
