# Studio UI

**Repo-first design-in-dev system.**

## What It Is

Studio UI is a spec-driven UI compiler with a browser-based visual editor. UI is defined declaratively as JSON specs, and a compiler turns those specs into real, committed framework code. There is no runtime renderer in production -- the compiler emits actual source files that are deterministic, readable, and Prettier-formatted. The generated code is the product. The visual editor at `/studio` lets designers and developers compose screens via drag-and-drop, with changes saved back to spec files and compiled through the standard PR workflow.

## How It Works

1. A designer or developer edits a spec file (e.g. `spec/screens/home.screen.json`).
2. The compiler discovers all `*.screen.json` files, validates each against a strict schema, and emits framework-specific `.tsx` files into `apps/web/components/generated/` and route pages into `apps/web/app/`.
3. Generated files are never edited by hand -- the compiler owns them.
4. To get changes into the codebase, the publish adapter creates a branch, commits only the emitted files, and opens a PR -- enforcing code review before anything hits `main`.

## Architecture

The architecture is deliberately layered to be **framework-agnostic at the spec and compiler level**:

- **Spec layer** (`spec/`) -- JSON definitions with strict schema validation. This is the declarative source of truth.
- **Compiler** (`compiler/`) -- Reads specs, validates, and delegates to emitters. Knows nothing about Git or GitHub.
- **Emitters** (`compiler/emitters/`) -- Framework-specific code generators. Next.js and Vue emitters included, selectable via config.
- **Component adapters** (`compiler/adapters/`) -- Decouple from specific component libraries. shadcn adapter included by default.
- **Plugin system** (`compiler/plugins/`) -- Register custom node types with prop schemas and emitters.
- **Token pipeline** (`compiler/tokens.ts`) -- Import design tokens from Style Dictionary JSON files.
- **Visual editor** (`apps/web/app/studio/`) -- Browser-based drag-and-drop UI that reads and writes spec JSON.
- **Git adapter** (`adapters/github/`) -- The only part that knows about Git and GitHub. Could be swapped for GitLab, Bitbucket, etc.

## Core Principles

- **Repo-first**: The spec is in the repo, the output is in the repo, and the delivery mechanism is a PR. Git is the system of record.
- **Deterministic output**: Same spec always produces the same code. Stable import sorting. Clean diffs.
- **PR-only publishing**: Never write directly to `main`. All changes go through branches and pull requests.
- **No runtime renderer**: The compiler emits real source files. There is no interpreter reading JSON at runtime.
- **Framework-agnostic core**: The spec format and compiler pipeline are not tied to any specific framework. Only emitters are framework-specific.
- **Generated files are readable**: Output must remain human-readable, properly formatted, and use standard framework conventions (e.g. `@/` aliases, named imports).

## Workflow Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Visual preview -- runs compiler watcher + Next.js dev server together |
| `pnpm compile` | Compile specs to generated files and write to disk |
| `pnpm watch` | Watch spec files and recompile on change |
| `pnpm studio add screen <name>` | Scaffold a new screen spec from a template |
| `pnpm lint:specs` | Lint all spec files for common issues without compiling |
| `pnpm publish:dry` | Show what would change (colourised summary + diff), no writes |
| `pnpm publish:commit` | Create branch and commit generated files locally |
| `pnpm publish:pr` | Push branch and open PR on GitHub |
| Visit `/studio` | Open the visual editor in the browser |

## Repo Structure

```
studio-poc/
  apps/web/                  Next.js App Router application
    app/                     App Router pages (compiler owns page.tsx files)
      studio/                Visual editor pages
      api/studio/            Editor API routes (read/write specs, compile)
    components/
      ui/                    shadcn components (manual)
      generated/             Compiler output (auto-generated)
      studio/                Visual editor components (renderer, canvas, panels)
    lib/studio/              Editor state, token maps, node schemas
  spec/
    screens/                 Screen spec JSON files (*.screen.json)
    schema/                  JSON Schema for validation
  compiler/
    compile.ts               Main compile entry point (emitter-agnostic)
    config.ts                Loads studio.config.json
    dev.ts                   Visual preview (watch + Next.js dev server)
    discover.ts              Screen spec file discovery
    lint.ts                  Standalone spec linter
    publish.ts               Publish CLI entry point (colourised output)
    scaffold.ts              Spec scaffolding CLI
    tokens.ts                Design token pipeline (Style Dictionary import)
    validate.ts              Spec validation (Ajv + manual + prop type-checking)
    watch.ts                 File watcher with debounce
    types.ts                 Shared types
    emitters/                Framework-specific code generators
      types.ts               Emitter interface
      nextjs.ts              Next.js / React emitter
      vue.ts                 Vue SFC emitter
    adapters/                Component library adapters
      component-adapter.ts   Adapter interface
      shadcn.ts              shadcn/ui adapter
    plugins/                 Plugin system
      types.ts               NodePlugin interface
      registry.ts            Plugin loader and registry
  adapters/
    github/publish.ts        Git + GitHub adapter (branch, commit, PR)
  plugins/                   Project-level plugins (custom node types)
  tokens/                    Design token files (Style Dictionary format)
  studio.config.json         Compiler configuration
  docs/                      Design specs
```

## Current Status

All four tiers of the roadmap are complete.

What works today:

- **Visual editor** -- Browser-based UI at `/studio` with drag-and-drop canvas, component palette, property panel, undo/redo, and save/compile integration
- **V1 spec format** -- `version`, `route`, `meta`, typed `tree` with node IDs and a `props` object
- **Multi-screen support** -- Compiler discovers all `*.screen.json` files and emits route-based pages and components
- **14 built-in node types** -- Layout: Stack, Grid, Section, ScrollArea, Spacer. Content: Heading, Text, Image, Input, Link, Divider, List. Components: Card, Button
- **Multi-framework emitters** -- Next.js and Vue emitters, selected via `studio.config.json` `framework` field. Abstract `Emitter` interface for adding more
- **Component library abstraction** -- `ComponentAdapter` interface decouples from any specific library. shadcn adapter included by default
- **Plugin system** -- `NodePlugin` interface for registering custom node types with prop schemas and emitters
- **Design token pipeline** -- Style Dictionary JSON import for spacing, sizing, colour, typography, and border radius tokens
- **Repo component references** -- Specs can reference any exported component from the UI library
- **Configurable paths** -- `studio.config.json` defines framework, component library, directories, import aliases, plugins, and tokens
- **Props type-checking** -- Compile-time validation of prop types, enums, and required fields
- **Token-based spacing** -- All spacing values come from the token system
- **Full publish pipeline** -- Dry-run with colourised diffs, local commit, and PR to GitHub with duplicate detection
- **Visual preview** -- `pnpm dev` runs compiler watcher + Next.js dev server together
- **Spec scaffolding** -- `pnpm studio add screen <name>` creates a new spec from a template
- **Spec linter** -- Standalone lint command checking for duplicate IDs, heading hierarchy, accessibility, and cross-screen issues
- **CI validation** -- GitHub Action verifies generated output matches committed files
- **Barrel exports** -- Auto-generated index files for all generated components
- **Ajv schema validation** with manual fallback and detailed error messages

## Reference Docs

| Document | Describes |
|----------|-----------|
| [docs/SPEC_SCHEMA_V1.md](docs/SPEC_SCHEMA_V1.md) | Spec format: versioned, routed, with `meta` and a typed `tree` of nodes with IDs and props |
| [docs/COMPILER_RULES_V1.md](docs/COMPILER_RULES_V1.md) | Compiler behaviour: route-based file generation, deterministic rules, publish workflow |
| [docs/REPO_TEMPLATE_V1.md](docs/REPO_TEMPLATE_V1.md) | Target repo structure: `studio.config.json`, layout primitives, folder conventions |

See [ROADMAP.md](ROADMAP.md) for the full roadmap (all tiers complete).
