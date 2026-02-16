# Studio UI -- Roadmap

This roadmap bridges the current POC to the V1 target defined in the design specs (`docs/`). Tiers are roughly sequential -- each builds on the previous -- but individual items within a tier can be parallelised.

## Tier 1 -- Hardening

Stabilise the existing system before expanding scope.

- [x] **E2E PR flow test** -- Run `pnpm publish:pr` against a real GitHub repo. Verify token auth, push, PR creation, and duplicate PR detection.
- [x] **Error handling polish** -- Handle push failures (permissions, branch protection), GitHub API rate limits, and network errors with clear user-facing messages.
- [x] **CI validation** -- GitHub Action that runs `pnpm compile` on PR and verifies generated output matches what's committed. Prevents hand-editing of generated files.

## Tier 2 -- Spec & Compiler toward V1

Evolve the spec format and compiler to match the V1 design specs.

### Spec format migration

- [x] **V1 top-level structure** -- Add `version`, `route`, `meta` (layout, auth) to spec. Move children under a `tree` key. Update schema and validation.
- [x] **Node IDs** -- Every node gains an explicit `id` field. Update schema, validation, and emitters.
- [x] **Props object** -- Replace flat inline props (`text`, `label`, `gap`) with a structured `props` object. Update emitters to read from `props`.

### Multi-screen support

- [x] **Screen discovery** -- Compiler discovers all `*.screen.json` files in the screens directory instead of hardcoding `home.json`.
- [x] **Route-based emission** -- Each screen emits to its route path: `/signup` -> `app/signup/page.tsx`. Emitter generates both page and component per screen.
- [x] **Index generation** -- Auto-generate barrel exports for all generated components.

### Configuration

- [x] **`studio.config.json`** -- Introduce a config file that defines `framework`, `appDir`, `componentsDir`, `generatedDir`, `screensDir`, `schemaPath`, and `importAlias`. Compiler reads paths from config instead of hardcoding them.

### New node types

- [x] **Layout primitives** -- Grid, Section, ScrollArea, Spacer (as defined in `docs/REPO_TEMPLATE_V1.md`).
- [x] **Content nodes** -- `Image`, `Input`, `Link`, `Divider`, `List`.
- [x] **Repo component references** -- Allow specs to reference any exported component from the configured component directory.

### Compiler rules

- [x] **Token-based spacing only** -- Enforce that all spacing values come from the token system, no arbitrary numbers.
- [x] **Self-closing elements** -- Emit self-closing JSX where possible (e.g. `<Spacer />`).
- [x] **Props type-checking** -- Validate that spec props match the TypeScript definitions of target components.

## Tier 3 -- Developer Experience

Make the day-to-day workflow faster and more pleasant.

- [x] **Visual preview** -- A single command that watches spec files and runs the Next.js dev server together, so edits show up live in the browser.
- [x] **Spec scaffolding CLI** -- `pnpm studio add screen checkout` creates a new spec file with the correct structure pre-filled.
- [x] **Colourised diff output** -- Improve `publish:dry` terminal output with syntax-highlighted diffs.
- [x] **Spec linter** -- Standalone lint command that checks specs for common issues (missing IDs, invalid prop values) without running a full compile.

## Tier 4 -- Long-term Vision

Larger efforts that extend Studio UI beyond its current scope.

- [x] **Visual editor** -- A browser-based UI that reads and writes spec JSON. The "studio" in Studio UI. Full canvas with drag-and-drop, property editing, undo/redo, and save/compile integration.
- [x] **Multi-framework emitters** -- Vue emitter alongside the existing Next.js one, selected via `studio.config.json` `framework` field. Abstract `Emitter` interface for adding more.
- [x] **Component library abstraction** -- `ComponentAdapter` interface decouples from shadcn. Default shadcn adapter included, others pluggable via config.
- [x] **Plugin / extension system** -- `NodePlugin` interface allows registering custom node types with prop schemas and emit functions. Loaded from paths in `studio.config.json`.
- [x] **Design token pipeline** -- Style Dictionary JSON import. Token-driven compiler maps for spacing, sizing, colour, typography, and border radius.
