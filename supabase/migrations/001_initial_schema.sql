-- Studio UI initial schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- Profiles (extends Supabase auth.users)
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  full_name   text,
  avatar_url  text,
  role        text not null default 'user' check (role in ('user', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- Projects
-- ─────────────────────────────────────────────────────────────
create table public.projects (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid references public.profiles(id) on delete cascade not null,
  name          text not null,
  slug          text not null,
  framework     text not null default 'nextjs' check (framework in ('nextjs', 'expo', 'vue')),
  config        jsonb not null default '{}',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(owner_id, slug)
);

alter table public.projects enable row level security;

create policy "Users can view their own projects"
  on public.projects for select
  using (auth.uid() = owner_id);

create policy "Users can create projects"
  on public.projects for insert
  with check (auth.uid() = owner_id);

create policy "Users can update their own projects"
  on public.projects for update
  using (auth.uid() = owner_id);

create policy "Users can delete their own projects"
  on public.projects for delete
  using (auth.uid() = owner_id);

-- ─────────────────────────────────────────────────────────────
-- Screens
-- ─────────────────────────────────────────────────────────────
create table public.screens (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid references public.projects(id) on delete cascade not null,
  name          text not null,
  spec          jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(project_id, name)
);

alter table public.screens enable row level security;

create policy "Users can view screens in their projects"
  on public.screens for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = screens.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "Users can create screens in their projects"
  on public.screens for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = screens.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "Users can update screens in their projects"
  on public.screens for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = screens.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "Users can delete screens in their projects"
  on public.screens for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = screens.project_id
        and projects.owner_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Design Tokens
-- ─────────────────────────────────────────────────────────────
create table public.design_tokens (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid references public.projects(id) on delete cascade not null unique,
  tokens        jsonb not null default '{}',
  updated_at    timestamptz not null default now()
);

alter table public.design_tokens enable row level security;

create policy "Users can view tokens in their projects"
  on public.design_tokens for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = design_tokens.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "Users can upsert tokens in their projects"
  on public.design_tokens for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = design_tokens.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "Users can update tokens in their projects"
  on public.design_tokens for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = design_tokens.project_id
        and projects.owner_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Custom Components
-- ─────────────────────────────────────────────────────────────
create table public.components (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid references public.projects(id) on delete cascade not null,
  name          text not null,
  spec          jsonb not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique(project_id, name)
);

alter table public.components enable row level security;

create policy "Users can view components in their projects"
  on public.components for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = components.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "Users can create components in their projects"
  on public.components for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = components.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "Users can update components in their projects"
  on public.components for update
  using (
    exists (
      select 1 from public.projects
      where projects.id = components.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "Users can delete components in their projects"
  on public.components for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = components.project_id
        and projects.owner_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Version History (snapshots)
-- ─────────────────────────────────────────────────────────────
create table public.versions (
  id            uuid primary key default uuid_generate_v4(),
  screen_id     uuid references public.screens(id) on delete cascade not null,
  spec          jsonb not null,
  label         text,
  created_at    timestamptz not null default now()
);

alter table public.versions enable row level security;

create policy "Users can view versions of their screens"
  on public.versions for select
  using (
    exists (
      select 1 from public.screens
      join public.projects on projects.id = screens.project_id
      where screens.id = versions.screen_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "Users can create versions of their screens"
  on public.versions for insert
  with check (
    exists (
      select 1 from public.screens
      join public.projects on projects.id = screens.project_id
      where screens.id = versions.screen_id
        and projects.owner_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Assets (metadata; files in Supabase Storage)
-- ─────────────────────────────────────────────────────────────
create table public.assets (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid references public.projects(id) on delete cascade not null,
  file_name     text not null,
  storage_path  text not null,
  mime_type     text,
  size_bytes    bigint,
  created_at    timestamptz not null default now()
);

alter table public.assets enable row level security;

create policy "Users can view assets in their projects"
  on public.assets for select
  using (
    exists (
      select 1 from public.projects
      where projects.id = assets.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "Users can create assets in their projects"
  on public.assets for insert
  with check (
    exists (
      select 1 from public.projects
      where projects.id = assets.project_id
        and projects.owner_id = auth.uid()
    )
  );

create policy "Users can delete assets in their projects"
  on public.assets for delete
  using (
    exists (
      select 1 from public.projects
      where projects.id = assets.project_id
        and projects.owner_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────
-- Helper: auto-update updated_at timestamp
-- ─────────────────────────────────────────────────────────────
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.update_updated_at();

create trigger screens_updated_at
  before update on public.screens
  for each row execute function public.update_updated_at();

create trigger design_tokens_updated_at
  before update on public.design_tokens
  for each row execute function public.update_updated_at();

create trigger components_updated_at
  before update on public.components
  for each row execute function public.update_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Storage bucket for assets
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('studio-assets', 'studio-assets', true)
on conflict do nothing;

create policy "Authenticated users can upload assets"
  on storage.objects for insert
  with check (bucket_id = 'studio-assets' and auth.role() = 'authenticated');

create policy "Anyone can view assets"
  on storage.objects for select
  using (bucket_id = 'studio-assets');

create policy "Asset owners can delete"
  on storage.objects for delete
  using (bucket_id = 'studio-assets' and auth.uid()::text = (storage.foldername(name))[1]);
