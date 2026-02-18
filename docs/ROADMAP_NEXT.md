# Studio UI -- Next Phase Roadmap (Tiers 5-8)

This continues from the completed Tiers 1-4 in `ROADMAP.md`. Each tier builds on the previous. Items within a tier can be parallelised.

---

## Tier 5: Editor Polish and Asset Management ✓

*Theme: Make the editor feel like a real design tool*

### 5.1 Layers Panel Upgrade ✓

The existing Node Tree is functional but basic. Upgrade it into a proper "Layers" panel:

- [x] **Rename nodes** -- double-click a layer name to edit it inline (updates `node.id`)
- [x] **Drag-to-reorder in the tree** -- reorder layers by dragging within the tree panel itself (reuses `moveNode`)
- [x] **Visibility toggle** -- eye icon per layer to hide nodes in the canvas preview (editor-only, not saved to spec)
- [x] **Lock toggle** -- lock icon to prevent accidental edits
- [x] Rename panel heading from "Node Tree" to "Layers"

### 5.2 Font Management ✓

Two font sources:

- [x] **Google Fonts** -- searchable picker that loads fonts via the Google Fonts CSS API. Selected fonts get added to a `fonts` array in project config. Compiler emits `next/font` imports or `<link>` tags.
- [x] **Custom font import** -- upload `.woff2`/`.ttf` files to `public/fonts/`. Compiler generates `@font-face` declarations.

Both feed into a "Font Family" dropdown in the property panel for Text/Heading nodes.

#### 5.2.1 Typography Deep Dive ✓

Follow-up pass to add granular typography controls to Text and Heading nodes:

- [x] Font weight picker (light / regular / medium / semibold / bold)
- [x] Font size control (beyond current Tailwind class presets)
- [x] Line height / letter spacing / word spacing
- [x] Text alignment (left / center / right / justify)
- [x] Text decoration (underline, strikethrough)
- [x] Text transform (uppercase, lowercase, capitalize)

### 5.3 Icon Library ✓

- [x] Bundle [Lucide React](https://lucide.dev/) (lightweight, tree-shakeable, MIT)
- [x] New **Icon** node type: props `name`, `size`, `color`
- [x] Searchable icon picker in the property panel
- [x] Compiler emits `import { IconName } from "lucide-react"`
- [x] Renderer shows the live icon on the canvas

### 5.4 Image Library / Asset Manager ✓

- [x] API route `POST /api/studio/assets/upload` -- saves images to `public/assets/`
- [x] Asset browser panel showing uploaded images as a thumbnail grid
- [x] Click to insert or set as `src` on a selected Image node
- [x] Drag from asset browser to canvas to create an Image node

### 5.5 Responsive Preview ✓

- [x] Breakpoint selector in the top bar: Mobile (375px), Tablet (768px), Desktop (1280px), Full
- [x] Canvas width constrains to the selected breakpoint
- [x] Per-breakpoint prop overrides (e.g. different Grid columns for mobile)

### 5.6 Keyboard-First Workflow ✓

- [x] `R` to rename selected node, `G` to group into a Stack, `D` to duplicate
- [x] `/` to open a command palette (search for actions, node types, screens)
- [x] `Cmd+S` to save & compile

---

## Tier 6: Design Systems and Components ✓

*Theme: Bring real design system thinking into the tool*

### 6.1 Custom Composite Components ✓

Users can create reusable "composite components":

- [x] Select nodes on canvas, right-click "Create Component"
- [x] Saves the subtree as a `.component.json` in a `components/` directory
- [x] Appears in the palette under a "Custom" category
- [x] Dragging creates an instance (deep copy with fresh IDs)

### 6.2 Starter Component Library ✓

Pre-built composite templates that ship with Studio:

- [x] Hero Section -- heading + subtext + CTA button + optional image
- [x] Feature Grid -- 3-column grid of icon + heading + text cards
- [x] Pricing Table -- 3-tier pricing cards
- [x] Contact Form -- name, email, message inputs + submit button
- [x] Navigation Header -- logo + nav links + CTA
- [x] Footer -- multi-column links + copyright
- [x] Login/Signup Form -- email/password inputs, social auth buttons, links

Stored as `.component.json` files in a `templates/` directory. Available from a "Templates" tab in the palette.

### 6.3 Design System Import ✓

- [x] **W3C Design Tokens format** -- expand the existing `tokens/design-tokens.json` support to handle the full community group spec
- [x] **Tailwind config import** -- parse `tailwind.config.js` and extract theme into Studio tokens
- [x] **shadcn theme import** -- import shadcn CSS variables as color tokens

### 6.4 Design System Scaffolding ✓

"Create a Design System" wizard:

- [x] Pick a base palette or enter brand colors
- [x] Choose typography and spacing scales
- [x] Generates `design-tokens.json` + `tailwind.config.ts` + CSS variables
- [x] Applies immediately to editor and compiler

### 6.5 Theme Editor ✓

- [x] Visual color/typography/spacing picker that updates design tokens live
- [x] Preview changes across all screens in real time
- [x] Makes DS creation tangible rather than editing JSON

### 6.6 Accessibility Checker ✓

- [x] Automated a11y audit: color contrast, missing alt text, heading order gaps, interactive element labeling
- [x] Builds on the existing `compiler/lint.ts` infrastructure
- [x] Shows issues inline on the canvas with warning indicators

### 6.7 Template Gallery ✓

- [x] Curated starting points: SaaS landing page, admin dashboard, blog, e-commerce product page
- [x] "Start from template" option on the screen list page
- [x] Dramatically reduces time-to-value for new users

---

## Tier 7: Import and Interoperability ✓

*Theme: Bring existing work in, get finished work out*

### 7.1 Spec File Import ✓

- [x] "Import Screen" button on the `/studio` screen list
- [x] Accepts `.screen.json` files (drag-and-drop or file picker)
- [x] Validates against schema, shows errors, loads into editor
- [x] Supports bulk import via zip

### 7.2 Codebase Reverse-Engineering (Experimental) ✓

Parse existing `.tsx` files into best-effort `.screen.json` specs:

- [x] AST parsing via `@babel/parser` + `@babel/traverse`
- [x] Maps HTML elements and shadcn components back to Studio node types
- [x] Extracts props, text, nesting structure
- [x] Gets ~70-80% fidelity; user refines in editor
- [x] Marked clearly as "experimental"

### 7.3 Figma Import ✓

Figma's REST API (`GET /v1/files/:key`) returns the entire design as a JSON node tree -- structurally similar to our spec format. **Feasibility confirmed.**

**Mapping logic:**

- Figma `FRAME` with auto-layout -> `Stack` (direction from `layoutMode`)
- Figma `TEXT` -> `Heading` or `Text` (font size heuristic)
- Figma `COMPONENT` -> `Card`, `Button`, etc. (name convention or user mapping)
- Figma `IMAGE` fills -> `Image` node
- Layout properties (gap, padding) -> token values

**Implementation:**

- [x] User pastes a Figma file URL + provides a Figma Personal Access Token
- [x] API route fetches the file JSON, runs the parser, returns a `ScreenSpec`
- [x] User reviews in the editor before saving
- [x] "Mapping review" step lets users adjust the import before committing

**Known limitations:**

- Complex designs with absolute positioning, masks, and effects won't map cleanly
- Best for structured, auto-layout Figma files
- Not pixel-perfect -- gets you 70-80% of the way, user refines the rest

### 7.4 Project Export ✓

- [x] **Zip download** -- bundle the Next.js app as a `.zip`
- [x] **Vercel deploy** -- one-click deploy via Vercel API
- [x] **Docker export** -- generate `Dockerfile` + `docker-compose.yml`
- [x] **GitHub push** -- extend existing `publish.ts` to create fresh repos

### 7.5 State and Interactions ✓

- [x] Define `onClick`, `onChange`, conditional visibility on nodes
- [x] Bridges the gap between static mockup and functional prototype
- [x] Compiler emits event handler stubs

### 7.6 Data Binding ✓

- [x] Connect components to API endpoints or mock data sources
- [x] List/DataTable nodes can bind to a data URL and auto-populate
- [x] Makes generated apps functional, not just visual

---

## Tier 8: Productization ✓

*Theme: Turn Studio UI into a product people use*

### 8.1 OAuth / Authentication (Supabase) ✓

- [x] **Supabase Auth** -- email/password, Google OAuth, GitHub OAuth
- [x] User sessions verified via middleware
- [x] Each user gets their own workspace
- [x] Config: `SUPABASE_URL` + `SUPABASE_ANON_KEY`

### 8.2 Multi-User and Projects ✓

- [x] **Projects** -- users have multiple projects, each with own screens/tokens/components
- [x] **Persistence** -- move from file-system to Supabase (Postgres + Storage)
- [x] **Collaboration** -- share projects with roles (viewer/editor/admin)
- [x] Real-time collab via Supabase Realtime

### 8.3 Onboarding ✓

- [x] **Welcome modal** on first visit
- [x] **Interactive tutorial** -- guided steps (drag Stack, add Heading, edit props, save, preview)
- [x] **Template picker** -- new users start from a template instead of blank canvas
- [x] **Tooltips** -- contextual hints on UI elements
- [x] Progress tracked in localStorage or user profile

### 8.4 Package as an App

Two strategies:

- [x] **SaaS (primary)** -- deploy as a hosted web app (Vercel). Users sign up, build UIs, export code.
- [ ] **Desktop (secondary)** -- wrap in Tauri for offline/enterprise use. Deferred to post-launch.

### 8.5 CLI Tool ✓

```bash
npx create-studio-app my-project
```

- [x] Scaffolds a new project with Studio pre-configured
- [x] Prompts for: framework, component library, include samples?
- [x] Optional `--with-supabase` flag for auth/database

### 8.6 Version History ✓

- [x] Visual timeline of spec changes with diff view and rollback
- [x] Critical for production use -- undo across sessions
- [x] Stored in Supabase when in SaaS mode, or filesystem-based locally

---

## Tier 9: Launch Readiness (Phase D)

*Theme: Expand capabilities, polish for public launch*

### 9.1 Expanded Node Types (20 -> 63+) ✓

- [x] Box, SVG, CustomComponent (design freedom nodes)
- [x] Forms: Textarea, Select, Checkbox, RadioGroup, Switch, Slider, Label, FileUpload
- [x] Data Display: Avatar, Badge, Chip, Tooltip, Progress, Skeleton, Stat, Rating
- [x] Feedback: Alert, Toast, Spinner, Dialog, Drawer, Sheet
- [x] Navigation: Breadcrumb, Pagination, Stepper, Sidebar, DropdownMenu, AppBar
- [x] Surfaces: Accordion, Popover, Container, AspectRatio, HoverCard
- [x] Media: Video, Embed, Blockquote, Code, Carousel, Calendar, Timeline

### 9.2 Multi-Framework Emitters ✓

- [x] Vue SFC emitter
- [x] Svelte emitter
- [x] Plain HTML/CSS emitter
- [x] Framework selector in export modal and CLI

### 9.3 Real-Time Collaboration ✓

- [x] Supabase Realtime presence tracking
- [x] Cursor sharing and node selection broadcasting
- [x] Presence indicators (avatars, cursors, node highlights)

### 9.4 Figma-Like Component System ✓

- [x] ComponentRef node type (ref/override model)
- [x] Component definitions stored separately from screen tree
- [x] Override detection and "reset to component" action
- [x] Slot content injection for component instances
- [x] Descendant overrides by node ID path
- [x] Compiler resolves refs at compile time (emitters receive flat tree)

### 9.5 Bidirectional Design-Code Sync (Level 1) ✓

- [x] Enhanced TSX parser: 50+ component mappings, Tailwind style inference
- [x] HTML parser: client-side DOMParser with inline style extraction
- [x] Re-import feature: update existing screens from changed code
- [x] HTML import tab in import modal

---

## Tier 10: AI & Automation (Future)

*Theme: Make the tool intelligent*

### 10.1 AI-Assisted Layout

- [ ] Describe a layout in natural language, AI generates the node tree
- [ ] "Make this responsive" -- auto-generates breakpoint overrides
- [ ] Smart suggestions: "This looks like a pricing table, convert to a DataTable?"

### 10.2 AI Code Review

- [ ] Analyze generated code for performance, accessibility, best practices
- [ ] Suggest optimizations (memoization, lazy loading, code splitting)
- [ ] Auto-fix common issues

### 10.3 Auto-Responsive

- [ ] Analyze desktop layout and auto-generate mobile/tablet breakpoints
- [ ] Heuristics: stack columns vertically on mobile, reduce font sizes, hide non-essential elements
- [ ] User can review and adjust before applying

---

## Tier 11: Ecosystem & Enterprise (Future)

*Theme: Build a platform, not just a tool*

### 11.1 Plugin Marketplace

- [ ] Plugin API for extending the editor (custom nodes, panel widgets, emitters)
- [ ] Community marketplace for sharing plugins
- [ ] Official plugins: analytics, i18n, CMS connectors

### 11.2 API Access

- [ ] REST API for programmatic screen creation, compilation, and export
- [ ] Webhook support for CI/CD integration
- [ ] SDK for embedding Studio UI in third-party applications

### 11.3 Enterprise Features

- [ ] SSO (SAML/OIDC) via Supabase Auth enterprise
- [ ] Billing & subscriptions (Stripe integration)
- [ ] Audit logging for compliance
- [ ] Team management: org-level permissions, seat management
- [ ] Self-hosted deployment option (Docker + Helm chart)

### 11.4 Desktop App (Tauri)

- [ ] Wrap Studio UI in Tauri for offline/enterprise use
- [ ] Local filesystem mode with no cloud dependency
- [ ] Auto-update mechanism

### 11.5 Bidirectional Sync Level 2 (Live)

- [ ] File watcher that detects changes to generated files
- [ ] AST diff to map code changes back to spec changes
- [ ] Conflict resolution UI when both sides have diverged
- [ ] WebSocket connection between IDE and Studio editor

---

## Tier 12: Advanced Design (Future)

*Theme: Close the gap with native design tools*

### 12.1 Advanced Animation System

- [ ] Keyframe-based animations on nodes
- [ ] Transition editor (enter/exit/hover/scroll triggers)
- [ ] Framer Motion integration in emitter

### 12.2 Theming & Multi-Brand

- [ ] Multiple design token sets per project (light/dark/brand-A/brand-B)
- [ ] Theme switcher in editor for side-by-side comparison
- [ ] Compiler generates theme-aware code

### 12.3 Component Variants

- [ ] Define multiple variants of a component (size, color, state)
- [ ] Variant picker in the property panel
- [ ] Auto-generates variant props in emitted code

### 12.4 Design-to-Test

- [ ] Auto-generate test files from screen specs
- [ ] Component-level snapshot tests
- [ ] Accessibility test generation (axe-core)

---

## Summary

| Tier | Theme | Status | Key Deliverables |
|------|-------|--------|-----------------|
| **5** | Editor Polish | **Complete** | Layers, Fonts, Icons, Images, Responsive, Keyboard shortcuts |
| **6** | Design Systems | **Complete** | Custom Components, DS Import/Create, Templates, Theme Editor, A11y |
| **7** | Import/Interop | **Complete** | File Import, Codebase Import, Figma Import, Export, Interactions |
| **8** | Productization | **Complete** | OAuth/Supabase, Multi-user, Onboarding, Packaging, CLI, Version History |
| **9** | Launch Readiness | **Complete** | 63+ node types, Multi-framework, Real-time collab, Component system, Bidi sync |
| **10** | AI & Automation | **Planned** | AI layout, AI code review, Auto-responsive |
| **11** | Ecosystem | **Planned** | Plugin marketplace, API access, Enterprise, Desktop app, Live sync |
| **12** | Advanced Design | **Planned** | Animations, Multi-brand theming, Variants, Design-to-test |
