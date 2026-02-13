# Studio UI

**Repo-first design-in-dev system.**

## What It Is

Studio UI is a system where UI is defined declaratively as JSON specs, and a compiler turns those specs into real, committed framework code (currently Next.js App Router). There is no runtime renderer -- the compiler emits actual `.tsx` source files that are deterministic, readable, and Prettier-formatted. The generated code is the product.

## How It Works

1. A designer or developer edits a spec file (e.g. `spec/screens/home.json`).
2. The compiler reads that spec, validates it against a strict schema, and emits framework-specific `.tsx` files into `apps/web/components/generated/`.
3. Generated files are never edited by hand -- the compiler owns them.
4. To get changes into the codebase, the publish adapter creates a branch, commits only the emitted files, and opens a PR -- enforcing code review before anything hits `main`.

## Architecture

The architecture is deliberately layered to be **framework-agnostic at the spec and compiler level**:

- **Spec layer** (`spec/`) -- JSON definitions with strict schema validation. This is the declarative source of truth.
- **Compiler** (`compiler/`) -- Reads specs, validates, and delegates to emitters. Knows nothing about Git or GitHub.
- **Emitters** (`compiler/emitters/`) -- The only part that knows about the target framework (Next.js/React). Could be swapped for Vue, Svelte, etc.
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
| `pnpm compile` | Compile specs to generated files and write to disk |
| `pnpm watch` | Watch spec files and recompile on change |
| `pnpm publish:dry` | Show what would change (summary + diff), no writes |
| `pnpm publish:commit` | Create branch and commit generated files locally |
| `pnpm publish:pr` | Push branch and open PR on GitHub |

## Repo Structure

```
studio-poc/
  apps/web/              Next.js App Router application
    app/                 App Router pages (compiler owns page.tsx)
    components/
      ui/                shadcn components (manual)
      generated/         Compiler output (auto-generated)
  spec/
    screens/             Screen spec JSON files
    schema/              JSON Schema for validation
  compiler/
    compile.ts           Main compile entry point
    watch.ts             File watcher
    publish.ts           Publish CLI entry point
    validate.ts          Spec validation (Ajv + manual)
    types.ts             Shared types
    emitters/            Framework-specific code generators
  adapters/
    github/publish.ts    Git + GitHub adapter (branch, commit, PR)
  docs/                  V1 design specs (see below)
```

## Current Status (POC)

The proof-of-concept validates the core loop: spec in, code out, publish via PR.

What works today:

- Single-screen compile (`home.json` only)
- Flat node types: `stack`, `heading`, `text`, `card`, `button`
- Spec uses a simple flat structure: `id`, `layout`, `gap`, `children`
- Spec lives in `spec/screens/`
- Output to `apps/web/components/generated/`
- Full publish pipeline: dry-run, local commit, and PR to GitHub
- Watch mode with debounced recompile
- Ajv schema validation with manual fallback

What the POC does **not** yet cover:

- Multi-screen / route-based generation
- Configurable repo structure (`studio.config.json`)
- V1 spec format (`version`, `route`, `meta`, `tree`)
- Node IDs or typed props
- Layout primitives beyond Stack (Grid, Section, ScrollArea, Spacer)
- Repo component references

## V1 Target

The V1 design defines the full system. Three reference specs describe the target:

| Document | Describes |
|----------|-----------|
| [docs/SPEC_SCHEMA_V1.md](docs/SPEC_SCHEMA_V1.md) | Spec format: versioned, routed, with `meta` and a typed `tree` of nodes with IDs and props |
| [docs/COMPILER_RULES_V1.md](docs/COMPILER_RULES_V1.md) | Compiler behaviour: route-based file generation, deterministic rules, publish workflow |
| [docs/REPO_TEMPLATE_V1.md](docs/REPO_TEMPLATE_V1.md) | Target repo structure: `studio.config.json`, layout primitives, folder conventions |

Key changes from POC to V1:

- **Spec format** -- Top-level gains `version`, `route`, `meta` (layout, auth). The component tree moves under a `tree` key. Nodes gain explicit `id` fields and a `props` object instead of flat inline properties.
- **Multi-screen** -- The compiler discovers all `*.screen.json` files in `/studio/screens/` and emits a route + component per screen.
- **Configurable paths** -- `studio.config.json` tells the compiler where the app dir, components, layout primitives, tokens, and import alias live.
- **Layout primitives** -- Grid, Section, ScrollArea, and Spacer join Stack as first-class layout nodes.
- **Repo components** -- Any exported component from the configured component directory can be referenced in specs.

See [ROADMAP.md](ROADMAP.md) for the plan to bridge from POC to V1.
