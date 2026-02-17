# Studio UI -- Next Phase Roadmap (Tiers 5-8)

This continues from the completed Tiers 1-4 in `ROADMAP.md`. Each tier builds on the previous. Items within a tier can be parallelised.

---

## Tier 5: Editor Polish and Asset Management

*Theme: Make the editor feel like a real design tool*

### 5.1 Layers Panel Upgrade

The existing Node Tree is functional but basic. Upgrade it into a proper "Layers" panel:

- [ ] **Rename nodes** -- double-click a layer name to edit it inline (updates `node.id`)
- [ ] **Drag-to-reorder in the tree** -- reorder layers by dragging within the tree panel itself (reuses `moveNode`)
- [ ] **Visibility toggle** -- eye icon per layer to hide nodes in the canvas preview (editor-only, not saved to spec)
- [ ] **Lock toggle** -- lock icon to prevent accidental edits
- [ ] Rename panel heading from "Node Tree" to "Layers"

### 5.2 Font Management

Two font sources:

- [ ] **Google Fonts** -- searchable picker that loads fonts via the Google Fonts CSS API. Selected fonts get added to a `fonts` array in project config. Compiler emits `next/font` imports or `<link>` tags.
- [ ] **Custom font import** -- upload `.woff2`/`.ttf` files to `public/fonts/`. Compiler generates `@font-face` declarations.

Both feed into a "Font Family" dropdown in the property panel for Text/Heading nodes.

#### 5.2.1 Typography Deep Dive (Future)

Follow-up pass to add granular typography controls to Text and Heading nodes:

- [ ] Font weight picker (light / regular / medium / semibold / bold)
- [ ] Font size control (beyond current Tailwind class presets)
- [ ] Line height / letter spacing / word spacing
- [ ] Text alignment (left / center / right / justify)
- [ ] Text decoration (underline, strikethrough)
- [ ] Text transform (uppercase, lowercase, capitalize)

### 5.3 Icon Library

- [ ] Bundle [Lucide React](https://lucide.dev/) (lightweight, tree-shakeable, MIT)
- [ ] New **Icon** node type: props `name`, `size`, `color`
- [ ] Searchable icon picker in the property panel
- [ ] Compiler emits `import { IconName } from "lucide-react"`
- [ ] Renderer shows the live icon on the canvas

### 5.4 Image Library / Asset Manager

- [ ] API route `POST /api/studio/assets/upload` -- saves images to `public/assets/`
- [ ] Asset browser panel showing uploaded images as a thumbnail grid
- [ ] Click to insert or set as `src` on a selected Image node
- [ ] Drag from asset browser to canvas to create an Image node

### 5.5 Responsive Preview

- [ ] Breakpoint selector in the top bar: Mobile (375px), Tablet (768px), Desktop (1280px), Full
- [ ] Canvas width constrains to the selected breakpoint
- [ ] Later: per-breakpoint prop overrides (e.g. different Grid columns for mobile)

### 5.6 Keyboard-First Workflow

- [ ] `R` to rename selected node, `G` to group into a Stack, `D` to duplicate
- [ ] `/` to open a command palette (search for actions, node types, screens)
- [ ] `Cmd+S` to save & compile

---

## Tier 6: Design Systems and Components

*Theme: Bring real design system thinking into the tool*

### 6.1 Custom Composite Components

Users can create reusable "composite components":

- [ ] Select nodes on canvas, right-click "Create Component"
- [ ] Saves the subtree as a `.component.json` in a `components/` directory
- [ ] Appears in the palette under a "Custom" category
- [ ] Dragging creates an instance (deep copy with fresh IDs)

### 6.2 Starter Component Library

Pre-built composite templates that ship with Studio:

- [ ] Hero Section -- heading + subtext + CTA button + optional image
- [ ] Feature Grid -- 3-column grid of icon + heading + text cards
- [ ] Pricing Table -- 3-tier pricing cards
- [ ] Contact Form -- name, email, message inputs + submit button
- [ ] Navigation Header -- logo + nav links + CTA
- [ ] Footer -- multi-column links + copyright
- [ ] Login/Signup Form -- email/password inputs, social auth buttons, links

Stored as `.component.json` files in a `templates/` directory. Available from a "Templates" tab in the palette.

### 6.3 Design System Import

- [ ] **W3C Design Tokens format** -- expand the existing `tokens/design-tokens.json` support to handle the full community group spec
- [ ] **Tailwind config import** -- parse `tailwind.config.js` and extract theme into Studio tokens
- [ ] **shadcn theme import** -- import shadcn CSS variables as color tokens

### 6.4 Design System Scaffolding

"Create a Design System" wizard:

- [ ] Pick a base palette or enter brand colors
- [ ] Choose typography and spacing scales
- [ ] Generates `design-tokens.json` + `tailwind.config.ts` + CSS variables
- [ ] Applies immediately to editor and compiler

### 6.5 Theme Editor

- [ ] Visual color/typography/spacing picker that updates design tokens live
- [ ] Preview changes across all screens in real time
- [ ] Makes DS creation tangible rather than editing JSON

### 6.6 Accessibility Checker

- [ ] Automated a11y audit: color contrast, missing alt text, heading order gaps, interactive element labeling
- [ ] Builds on the existing `compiler/lint.ts` infrastructure
- [ ] Shows issues inline on the canvas with warning indicators

### 6.7 Template Gallery

- [ ] Curated starting points: SaaS landing page, admin dashboard, blog, e-commerce product page
- [ ] "Start from template" option on the screen list page
- [ ] Dramatically reduces time-to-value for new users

---

## Tier 7: Import and Interoperability

*Theme: Bring existing work in, get finished work out*

### 7.1 Spec File Import

- [ ] "Import Screen" button on the `/studio` screen list
- [ ] Accepts `.screen.json` files (drag-and-drop or file picker)
- [ ] Validates against schema, shows errors, loads into editor
- [ ] Supports bulk import via zip

### 7.2 Codebase Reverse-Engineering (Experimental)

Parse existing `.tsx` files into best-effort `.screen.json` specs:

- [ ] AST parsing via `@babel/parser` + `@babel/traverse`
- [ ] Maps HTML elements and shadcn components back to Studio node types
- [ ] Extracts props, text, nesting structure
- [ ] Gets ~70-80% fidelity; user refines in editor
- [ ] Marked clearly as "experimental"

### 7.3 Figma Import

Figma's REST API (`GET /v1/files/:key`) returns the entire design as a JSON node tree -- structurally similar to our spec format. **Feasibility confirmed.**

**Mapping logic:**

- Figma `FRAME` with auto-layout -> `Stack` (direction from `layoutMode`)
- Figma `TEXT` -> `Heading` or `Text` (font size heuristic)
- Figma `COMPONENT` -> `Card`, `Button`, etc. (name convention or user mapping)
- Figma `IMAGE` fills -> `Image` node
- Layout properties (gap, padding) -> token values

**Implementation:**

- [ ] User pastes a Figma file URL + provides a Figma Personal Access Token
- [ ] API route fetches the file JSON, runs the parser, returns a `ScreenSpec`
- [ ] User reviews in the editor before saving
- [ ] "Mapping review" step lets users adjust the import before committing

**Known limitations:**

- Complex designs with absolute positioning, masks, and effects won't map cleanly
- Best for structured, auto-layout Figma files
- Not pixel-perfect -- gets you 70-80% of the way, user refines the rest

### 7.4 Project Export

- [ ] **Zip download** -- bundle the Next.js app as a `.zip`
- [ ] **Vercel deploy** -- one-click deploy via Vercel API
- [ ] **Docker export** -- generate `Dockerfile` + `docker-compose.yml`
- [ ] **GitHub push** -- extend existing `publish.ts` to create fresh repos

### 7.5 State and Interactions

- [ ] Define `onClick`, `onChange`, conditional visibility on nodes
- [ ] Bridges the gap between static mockup and functional prototype
- [ ] Compiler emits event handler stubs

### 7.6 Data Binding

- [ ] Connect components to API endpoints or mock data sources
- [ ] List/DataTable nodes can bind to a data URL and auto-populate
- [ ] Makes generated apps functional, not just visual

---

## Tier 8: Productization

*Theme: Turn Studio UI into a product people use*

### 8.1 OAuth / Authentication (Supabase)

Replace the current passphrase auth in `middleware.ts`:

- [ ] **Supabase Auth** -- email/password, Google OAuth, GitHub OAuth
- [ ] User sessions verified via middleware
- [ ] Each user gets their own workspace
- [ ] Config: `SUPABASE_URL` + `SUPABASE_ANON_KEY`

### 8.2 Multi-User and Projects

- [ ] **Projects** -- users have multiple projects, each with own screens/tokens/components
- [ ] **Persistence** -- move from file-system to Supabase (Postgres + Storage)
- [ ] **Collaboration** -- share projects with roles (viewer/editor)
- [ ] Later: real-time collab via Supabase Realtime

### 8.3 Onboarding

- [ ] **Welcome modal** on first visit
- [ ] **Interactive tutorial** -- guided steps (drag Stack, add Heading, edit props, save, preview)
- [ ] **Template picker** -- new users start from a template instead of blank canvas
- [ ] **Tooltips** -- contextual hints on UI elements
- [ ] Progress tracked in localStorage or user profile

### 8.4 Package as an App

Two strategies:

- [ ] **SaaS (primary)** -- deploy as a hosted web app (Vercel/Railway). Users sign up, build UIs, export code.
- [ ] **Desktop (secondary)** -- wrap in Electron for offline/enterprise use. `electron-builder` for macOS/Windows/Linux.

### 8.5 CLI Tool

```bash
npx create-studio-app my-project
```

- [ ] Scaffolds a new project with Studio pre-configured
- [ ] Prompts for: framework, component library, include samples?
- [ ] Optional `--with-supabase` flag for auth/database

### 8.6 Version History

- [ ] Visual timeline of spec changes with diff view and rollback
- [ ] Critical for production use -- undo across sessions
- [ ] Stored in Supabase when in SaaS mode, or git-based locally

---

## Summary

| Tier | Theme | Key Deliverables |
|------|-------|-----------------|
| **5** | Editor Polish | Layers, Fonts, Icons, Images, Responsive, Keyboard shortcuts |
| **6** | Design Systems | Custom Components, DS Import/Create, Templates, Theme Editor, A11y |
| **7** | Import/Interop | File Import, Codebase Import, Figma Import, Export, Interactions |
| **8** | Productization | OAuth/Supabase, Multi-user, Onboarding, Packaging, CLI, Version History |

Each tier is roughly 1-2 sprints. Tier 5 has the most immediate impact for making Studio feel like a real tool. Tier 8 is what turns it into a product.
