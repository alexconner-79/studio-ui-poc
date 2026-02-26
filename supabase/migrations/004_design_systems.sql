-- Studio UI v0.10.0 -- Design Systems
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ─────────────────────────────────────────────────────────────
-- Design Systems
-- A top-level entity independent of any single project.
-- One DS can be linked to many projects.
-- ─────────────────────────────────────────────────────────────

create table public.design_systems (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid references public.profiles(id) on delete cascade not null,
  name        text not null,
  description text,
  platform    text not null default 'web' check (platform in ('web', 'native', 'universal')),
  tokens      jsonb not null default '{}',
  themes      jsonb not null default '{}',
  components  jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.design_systems enable row level security;

create policy "Owners can manage their design systems"
  on public.design_systems for all
  using (auth.uid() = owner_id);

-- ─────────────────────────────────────────────────────────────
-- Link projects to a design system (optional)
-- ─────────────────────────────────────────────────────────────

alter table public.projects
  add column if not exists design_system_id uuid references public.design_systems(id) on delete set null;

-- ─────────────────────────────────────────────────────────────
-- Auto-update updated_at on design_systems
-- ─────────────────────────────────────────────────────────────

create or replace function public.handle_design_system_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_design_system_updated
  before update on public.design_systems
  for each row execute function public.handle_design_system_updated_at();
