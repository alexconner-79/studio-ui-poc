# Backlog

Items in this file are deferred from release Known Limitations sections. Every entry here was a conscious decision to defer — not an omission. Each item has a pull-in trigger: a condition that should prompt it being scheduled into a specific release.

**Rule:** When writing a Known Limitation that has no target release, add it here instead of leaving it untracked. Reference it from the release file as `See BACKLOG.md — [Short title]`.

**Review cadence:** Check this file at the start of planning each new release. Pull in any items whose trigger condition has been met.

---

## Canvas & Editor

### Inline rich text editing
- **Origin:** v0.8.0 Known Limitations
- **Description:** Text nodes only support plain text. Bold, italic, underline, and other inline formatting cannot be applied to spans within a text node.
- **Priority:** Medium
- **Pull into release when:** Typography controls (v0.10.6) are complete and user feedback confirms inline formatting is needed for real design work.

### `compile` flag per-subtree toggle
- **Origin:** v0.8.0 Known Limitations
- **Description:** The `compile` flag is per-node only. Children inherit the parent's compile-skip but cannot individually opt back in without setting the flag on each node manually.
- **Priority:** Low
- **Pull into release when:** Users report friction managing large screens with mixed compile/skip regions.

### Canvas rulers interactive snapping
- **Origin:** v0.7.5 Known Limitations
- **Description:** Canvas rulers are cosmetic — they display position but do not snap nodes to ruler guides. Designers cannot drag guides from rulers onto the canvas.
- **Priority:** Medium
- **Pull into release when:** v0.10.6 Canvas Fundamentals ships and ruler snapping is the next most-requested canvas precision feature.

### Drag-to-resize artboard minimum width
- **Origin:** v0.10.2 Known Limitations
- **Description:** No minimum width is enforced on the artboard drag handle. Dragging to 0px collapses the artboard. A minimum of ~200px should be enforced.
- **Priority:** Low
- **Pull into release when:** Reported as a bug by a user, or during a canvas polish pass.

### Token snapping threshold tuning
- **Origin:** v0.8.5 Known Limitations
- **Description:** Token snapping uses a fixed pixel threshold for snapping to the nearest token value. Different projects may need different thresholds (e.g. dense 4px grids vs sparse 8px grids).
- **Priority:** Low
- **Pull into release when:** Token type-ahead and full token picker work is scheduled; tune alongside that work.

### Color token picker reliability in Supabase mode
- **Origin:** v0.7.0 Known Limitations
- **Description:** Possible race condition on first mount of the color picker in Supabase mode that may leave the picker silently empty. Not yet confirmed as reproducible.
- **Priority:** Medium
- **Pull into release when:** Reproduced and confirmed. Include in the next canvas stability pass.

### shadcn CSS token cascade consolidation
- **Origin:** v0.7.0 Known Limitations
- **Description:** `--primary` and related shadcn variable overrides are split between `globals-studio.css` and `globals.css`. Should be consolidated into one location.
- **Priority:** Low
- **Pull into release when:** A CSS regression is traced to this split, or during a cleanup pass before v1.0.0.

### Full token picker (categorised, searchable)
- **Origin:** v0.10.6 Known Limitations
- **Description:** The token type-ahead dropdown in property panel inputs shows up to 8 matching tokens filtered as you type. For large DS token sets, a full modal token picker (categorised by type, searchable, with visual previews) would be more usable.
- **Priority:** Medium
- **Pull into release when:** Pulled into v0.10.8 Component Editability — the property panel work there is the natural home for a full token picker UI.

### Copy/paste across screens
- **Origin:** v0.10.6 Known Limitations
- **Description:** Clipboard state does not persist across screen navigation. Copying a node on Screen A, navigating to Screen B, and pasting produces nothing.
- **Priority:** Medium
- **Pull into release when:** Pulled into v0.10.6 Canvas Fundamentals — clipboard work is already in scope for that release.

---

## Typography & Text

### Dark mode tokens full testing
- **Origin:** v0.7.5 Known Limitations
- **Description:** Dark mode token values are defined in the spec but have not been fully tested across all components. Some components may not respond correctly to dark surface/foreground values.
- **Priority:** Medium
- **Pull into release when:** A "Dark mode starter theme" is promoted as a primary user-facing feature. Likely aligns with v0.10.5 starter themes work or a dedicated theme testing pass.

### Multi-frame per-breakpoint editing
- **Origin:** v0.7.0 Known Limitations
- **Description:** Edits apply globally across all breakpoints. Per-breakpoint editing (change layout at mobile without affecting desktop) is not yet supported.
- **Priority:** High
- **Pull into release when:** v1.4.0 UX Refinement Pass, or earlier if responsive design becomes a primary use case before then.

---

## Components & Properties

### Named prop slot management UI
- **Origin:** v0.10.4 Known Limitations
- **Description:** The compiler emits named slots only when a child node carries an explicit `slotName` prop. There is no UI for dragging children into named slots — designers must set `slotName` as a raw prop value.
- **Priority:** High
- **Pull into release when:** Pulled into v0.10.8 Component Editability — slot management is a core part of making compound components editable.

### Brownfield component property editor
- **Origin:** v0.10.8 Known Limitations
- **Description:** The component property audit in v0.10.8 covers the Studio boilerplate library only. Components scanned from a user's codebase (brownfield) have auto-generated prop definitions without designer-friendly labels, groupings, or descriptions. A "Component property editor" in the DS workspace would let users curate brownfield component props.
- **Priority:** Medium
- **Pull into release when:** Brownfield canvas rendering (v0.10.9) ships and users start actively editing brownfield components in the canvas.

---

## Images & Media

### Image cropping (server-side)
- **Origin:** v0.8.5 Known Limitations
- **Description:** Images can be placed on the canvas but cannot be cropped within Studio. Cropping requires exiting to an external tool. Server-side cropping via `sharp` was considered but deferred.
- **Priority:** Low
- **Pull into release when:** Image handling becomes a significant part of the design workflow, or a dedicated "Media & Assets" release is planned.

### True device preview (Expo Go / simulator)
- **Origin:** v0.10.2 Known Limitations
- **Description:** The React Native preview renders as HTML+CSS, which is a best-effort approximation. True device-accurate preview requires integration with Expo Go or a simulator/emulator toolchain.
- **Priority:** Medium
- **Pull into release when:** Expo/React Native usage grows to a point where the HTML approximation causes real design-to-production discrepancies. Likely v1.1.0 or later.

---

## Compiler & Code Generation

### Structure linter heuristic improvements
- **Origin:** v0.8.5 Known Limitations
- **Description:** The structure linter makes heuristic-based suggestions (e.g. "this looks like it should be a flex container"). These are not always correct and can produce false positives.
- **Priority:** Low
- **Pull into release when:** Linter false positive rate becomes a user complaint, or a machine-learning-based approach is viable.

### Shape rotation in Expo emitter
- **Origin:** v0.8.5 Known Limitations
- **Description:** Shape rotation (`transform: rotate()`) does not map correctly in the Expo emitter due to React Native transform limitations. Rotated shapes may render incorrectly in Expo output.
- **Priority:** Low
- **Pull into release when:** Addressed as part of v0.10.7 Framework Constraints work — `FRAMEWORK_CONSTRAINTS` should hide the rotation control for Expo projects.

---

## Brownfield & Local Components

### Inter-component dependency bundling
- **Origin:** v0.10.9 Known Limitations
- **Description:** If a scanned component imports another component from the user's project (`import { Icon } from './icon'`), the bundle endpoint must resolve and bundle the full dependency chain. Complex dependency graphs may fail; the fallback is `StructuralInstance`.
- **Priority:** Medium
- **Pull into release when:** Brownfield users report components failing to render due to unresolved local imports. A follow-on to v0.10.9.

### Context provider wrapping for brownfield components
- **Origin:** v0.10.9 Known Limitations
- **Description:** Components that rely on a React context provider (React Query, Zustand, React Router, custom context) from the user's app will fail to render in the canvas without that provider. The registry wraps known providers but cannot auto-wrap user-defined context.
- **Priority:** Medium
- **Pull into release when:** Brownfield usage grows and context-dependent components become a common failure mode. A follow-on to v0.10.9.

---

## MCP / Developer Bridge

### MCP changelog persistent storage
- **Origin:** v0.10.11 Known Limitations
- **Description:** The design change log is memory-based (last 100 entries). It resets on server restart. Persistent storage would require writing to the filesystem (local mode) or a Supabase table (cloud mode).
- **Priority:** Low
- **Pull into release when:** MCP bridge is actively used by AI agents and changelog continuity across restarts becomes important. Assign to v0.10.11 or a follow-on patch.

### MCP semantic validation on spec updates
- **Origin:** v0.10.11 Known Limitations
- **Description:** `studio_update_screen_spec` performs basic node-type validation but not full semantic checking (e.g. validating that a ComponentInstance references a known component, or that slot children are valid for the parent's schema).
- **Priority:** Low
- **Pull into release when:** AI agents produce invalid specs that pass structural validation but break the canvas. Include in a v0.10.11 follow-on.

---

## Collaboration

### CRDT/OT conflict resolution
- **Origin:** v0.11.0 Known Limitations
- **Description:** The lock-based collaboration model prevents most conflicts but race conditions on rapid lock/unlock are possible. Full CRDT or OT conflict resolution is a significant engineering investment.
- **Priority:** Low
- **Pull into release when:** Collaboration usage patterns show frequent lock conflicts or data loss reports. Post-v1.2.0 at earliest.

---

## DS & Project Creation

### Quick DS setup abbreviated wizard
- **Origin:** v0.10.10 Known Limitations
- **Description:** The full DS wizard (5 steps) nested inside the project creation modal may feel heavy for simple cases. An abbreviated "Quick DS setup" (name + pick a starter, ~2 steps) with a "Full setup →" escape hatch would reduce friction for common cases.
- **Priority:** Low
- **Pull into release when:** User research or usability testing on v0.10.10 shows measurable drop-off during the DS creation step of project creation.

---

## Advanced Vector / Drawing

### Boolean operations sub-pixel precision
- **Origin:** v1.3.0 Known Limitations
- **Description:** Boolean operations use SVG path math. Complex paths may have precision issues at sub-pixel levels, producing hairline gaps or overlaps.
- **Priority:** Low
- **Pull into release when:** Reported as a visible bug by users working with detailed vector artwork. A follow-on to v1.3.0.

### Pen tool open paths in Expo emitter
- **Origin:** v1.3.0 Known Limitations
- **Description:** The pen tool does not support open paths with stroke caps in the Expo emitter (React Native `<Path>` with `strokeLinecap` has limited support).
- **Priority:** Low
- **Pull into release when:** Expo + vector drawing becomes a meaningful use case. Post-v1.3.0.

### Blend modes cross-emitter composition
- **Origin:** v1.3.0 Known Limitations
- **Description:** Blend modes do not compose predictably across all emitter targets (CSS `mix-blend-mode` vs React Native `blendMode`). The visual result may differ between web and native outputs.
- **Priority:** Low
- **Pull into release when:** Addressed as part of the Framework Constraints work or a dedicated cross-platform parity pass.

### BooleanGroup/Path nodes in Build Mode
- **Origin:** v1.3.0 Known Limitations
- **Description:** `BooleanGroup` and `Path` nodes are Design Mode only by default. Promoting them to Build Mode emits SVG which may not fit all design system patterns.
- **Priority:** Low
- **Pull into release when:** Users request SVG-in-DS-components as a first-class workflow.

---

## Fonts

### Dynamic Google Font loading for starter themes
- **Origin:** v0.10.5 Known Limitations
- **Description:** `studio-warm.tokens.json` specifies Lora (a Google Font) in its typography tokens. The canvas does not dynamically load Google Fonts — it relies on the font stack fallback (Georgia). Designers using the Warm theme see Georgia, not Lora.
- **Priority:** Medium
- **Pull into release when:** Font loading is the most common complaint about the Warm starter theme, or a dedicated "Typography & Fonts" pass is planned. Likely aligns with v0.10.6 typography controls work.
