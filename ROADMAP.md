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

- [ ] **V1 top-level structure** -- Add `version`, `route`, `meta` (layout, auth) to spec. Move children under a `tree` key. Update schema and validation.
- [ ] **Node IDs** -- Every node gains an explicit `id` field. Update schema, validation, and emitters.
- [ ] **Props object** -- Replace flat inline props (`text`, `label`, `gap`) with a structured `props` object. Update emitters to read from `props`.

### Multi-screen support

- [ ] **Screen discovery** -- Compiler discovers all `*.screen.json` files in the screens directory instead of hardcoding `home.json`.
- [ ] **Route-based emission** -- Each screen emits to its route path: `/signup` -> `app/signup/page.tsx`. Emitter generates both page and component per screen.
- [ ] **Index generation** -- Auto-generate barrel exports for all generated components.

### Configuration

- [ ] **`studio.config.json`** -- Introduce a config file that defines `framework`, `appDir`, `componentsDir`, `layoutDir`, `tokensPath`, and `importAlias`. Compiler reads paths from config instead of hardcoding them.

### New node types

- [ ] **Layout primitives** -- Grid, Section, ScrollArea, Spacer (as defined in `docs/REPO_TEMPLATE_V1.md`).
- [ ] **Content nodes** -- `image`, `input`, `link`, `divider`, `list`.
- [ ] **Repo component references** -- Allow specs to reference any exported component from the configured component directory.

### Compiler rules

- [ ] **Token-based spacing only** -- Enforce that all spacing values come from the token system, no arbitrary numbers.
- [ ] **Self-closing elements** -- Emit self-closing JSX where possible (e.g. `<Spacer />`).
- [ ] **Props type-checking** -- Validate that spec props match the TypeScript definitions of target components.

## Tier 3 -- Developer Experience

Make the day-to-day workflow faster and more pleasant.

- [ ] **Visual preview** -- A single command that watches spec files and runs the Next.js dev server together, so edits show up live in the browser.
- [ ] **Spec scaffolding CLI** -- `pnpm studio add screen checkout` creates a new spec file with the correct structure pre-filled.
- [ ] **Colourised diff output** -- Improve `publish:dry` terminal output with syntax-highlighted diffs.
- [ ] **Spec linter** -- Standalone lint command that checks specs for common issues (missing IDs, invalid prop values) without running a full compile.

## Tier 4 -- Long-term Vision

Larger efforts that extend Studio UI beyond its current scope.

- [ ] **Visual editor** -- A browser-based UI that reads and writes spec JSON. The "studio" in Studio UI.
- [ ] **Multi-framework emitters** -- Vue, Svelte, or Astro emitters alongside the existing Next.js one.
- [ ] **Component library abstraction** -- Decouple from shadcn specifically. Let specs target different design systems via a component adapter layer.
- [ ] **Plugin / extension system** -- Allow consuming projects to register custom node types with their own emitters.
- [ ] **Design token pipeline** -- Import tokens from Figma or Style Dictionary and use them as the source of truth for spacing, colour, and typography in both specs and generated code.
