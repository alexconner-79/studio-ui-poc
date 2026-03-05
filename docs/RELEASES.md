# Studio UI -- Releases

## Version Index

| Version | Name | Status | Key Deliverables |
|---------|------|--------|-----------------|
| [v0.1.0](releases/v0.1.0.md) | Foundation | **Complete** | Hardening, spec format v1, multi-screen compiler, visual editor, design tokens, plugin system |
| [v0.2.0](releases/v0.2.0.md) | Editor Polish | **Complete** | Layers panel, fonts, icons, asset manager, responsive preview, keyboard shortcuts |
| [v0.3.0](releases/v0.3.0.md) | Design Systems | **Complete** | Custom components, starter library, DS import/create, theme editor, a11y checker, template gallery |
| [v0.4.0](releases/v0.4.0.md) | Import / Export | **Complete** | Spec import, codebase import, Figma import, export (zip/Vercel/Docker/GitHub), interactions, data binding |
| [v0.5.0](releases/v0.5.0.md) | SaaS Platform | **Complete** | Supabase auth, multi-user projects, collaboration schema, onboarding, CLI tool, version history |
| [v0.6.0](releases/v0.6.0.md) | Launch Readiness | **Complete** | 63+ node types, Vue/Svelte/HTML emitters, collab hooks, component ref system, bidi sync L1 |
| [v0.7.0](releases/v0.7.0.md) | Editor UX Overhaul | **Complete** | Creation flows, canvas defaults, spacing controls, drop behaviour, breakpoints, menu organisation |
| [v0.7.5](releases/v0.7.5.md) | UI Library & Reskin | **Complete** | Token system, studio primitives, Figma-style chrome, dot-grid canvas, rulers, compact panels |
| [v0.8.0](releases/v0.8.0.md) | Dual-Mode Canvas | **Complete** | Design/Build mode toggle, compile flag, interactive resize, drag-to-move, smart guides, inline text editing, multi-select actions |
| [v0.8.5](releases/v0.8.5.md) | Shapes, Drawing & Promote | **Complete** | Rectangle/Ellipse/Line/Frame types, toolbar creation tools, promote-to-build workflow, structure linter, image handling, shape property panel |
| [v0.9.0](releases/v0.9.0.md) | Quality & Stability | **Complete** | Error handling, path centralisation, compiler scaling, Lucide lazy loading, live preview button restore, ESLint cleanup |
| [v0.9.5](releases/v0.9.5.md) | Layout Intelligence | **Complete** | Auto-layout toggle, constraints, sizing modes (fixed/fill/hug), responsive behaviour |
| [v0.9.8](releases/v0.9.8.md) | Onboarding & Editor Chrome | **Complete** | Project setup wizard, GitHub connection, left panel restructure (Screens/Insert/DS tabs), artboard tabs for multi-screen editing, right panel first pass |
| [v0.10.0](releases/v0.10.0.md) | Design System Authoring | **Complete** | Two paths: connect existing React component library (brownfield) or start from a boilerplate (greenfield); semantic tokens, multi-theme, component variants/states/props, DS export |
| [v0.10.1](releases/v0.10.1.md) | DS Workspace UX | **Complete** | Full IA and interaction quality pass: inline token/component editing, component preview, category browsing, theme diff view, export improvements |
| [v0.10.2](releases/v0.10.2.md) | Editor UX & Platform Preview | **Complete** | UX sense-check fixes, artboard mode split (web vs Expo), inline project name, DS-to-project integration, clean RN phone frame preview |
| [v0.10.4](releases/v0.10.4.md) | Component Instances | **Complete** | ComponentInstance node type, default templates, editable slot children, live canvas rendering for antd/MUI/shadcn reference, compiler support |
| [v0.10.5](releases/v0.10.5.md) | Studio Boilerplate & Starter Themes | **Complete** | Token → CSS variable bridge; 4 starter themes; extended component library; DS picker restructured; default zoom fix; preview token bridge |
| [v0.10.6](releases/v0.10.6.md) | Canvas Design Fundamentals | **Complete** | Keyboard shortcuts; grouping; align & distribute; typography controls (font, size, weight, line height); spacing controls (padding/gap per side); layers panel interactions; properties panel keyboard nav |
| [v0.10.7](releases/v0.10.7.md) | Advanced Design | **Complete** | Multiple fills/strokes, effects stack (drop shadow, blur), gradient editor, framework-aware style controls |
| [v0.10.8](releases/v0.10.8.md) | Component Editability | **Complete** | Every boilerplate component gets designer-friendly property panel: proper labels, all variants as visual controls, grouped props, variant thumbnails in palette |
| [v0.10.9](releases/v0.10.9.md) | Brownfield Canvas Rendering | **Complete** | Local module server for transpiling user-owned component files; live canvas rendering for scanned brownfield and customised shadcn components; auto-refresh on file change |
| [v0.10.10](releases/v0.10.10.md) | DS & Project Creation Flow | **Planned** | Unified project+DS creation modal, dashboard layout improvements, DS summary in project settings, empty state guidance |
| [v0.10.11](releases/v0.10.11.md) | AI-Ready Codebase | **Complete** | Spec file watching for external edits; Studio CLI; Cursor rules for AI agents; design change log |
| [v0.10.12](releases/v0.10.12.md) | Canvas Rendering Overhaul | **Complete** | Style pipeline fix, props-to-style bridge, text auto-sizing, position panel context, renderer audit |
| [v0.11.0](releases/v0.11.0.md) | Real-Time Collaboration | **Planned** | Lock-based co-editing, presence avatars, cursor tracking, node selection highlights, spec broadcasting |
| [v1.0.0](releases/v1.0.0.md) | Public Release | **Future** | Launch gate -- all v0.x stable, docs complete, CI/CD green |
| [v1.1.0](releases/v1.1.0.md) | AI & Automation | **Future** | AI-assisted layout, AI code review, auto-responsive |
| [v1.2.0](releases/v1.2.0.md) | Ecosystem & Enterprise | **Future** | Plugin marketplace, API access, SSO, billing, desktop app |
| [v1.3.0](releases/v1.3.0.md) | Advanced Vector Tools | **Future** | Boolean operations, pen tool, blend modes (deferred from v0.10.7) |
| [v1.4.0](releases/v1.4.0.md) | UX Refinement Pass | **Future** | Second pass on editor UX -- polish, edge cases, user feedback |

---

## Current Focus

**v0.10.12 — Canvas Rendering Overhaul** is the current focus. The canvas must reliably reflect every property the designer sets before workflow or platform features are added.

Completed releases:
1. ~~**v0.10.4** — Component Instances~~ ✓
2. ~~**v0.10.5** — Studio Boilerplate & Starter Themes~~ ✓
3. ~~**v0.10.6** — Canvas Design Fundamentals~~ ✓
4. ~~**v0.10.7** — Advanced Design~~ ✓
5. ~~**v0.10.8** — Component Editability~~ ✓
6. ~~**v0.10.9** — Brownfield Canvas Rendering~~ ✓
7. ~~**v0.10.11** — AI-Ready Codebase~~ ✓

Up next:
8. **v0.10.12** — Canvas Rendering Overhaul (current)
9. **v0.10.10** — DS & Project Creation Flow (needs scoping — deferred)
10. **v0.11.0** — Real-time collaboration

---

## Related Documents

- [BACKLOG.md](BACKLOG.md) -- Deferred items from Known Limitations sections; reviewed at the start of each release planning cycle
- [COLLAB_WIRING.md](COLLAB_WIRING.md) -- Detailed integration plan for real-time collaboration (v0.11.0 reference)
- [COMPONENT_LIBRARY.md](COMPONENT_LIBRARY.md) -- Component library scope and property definitions reference
- [TECH_DEBT.md](TECH_DEBT.md) -- Technical debt log (addressed in v0.9.0)
- [SAAS_ARCHITECTURE.md](SAAS_ARCHITECTURE.md) -- SaaS deployment and data architecture
- [PHASE_A_SUMMARY.md](PHASE_A_SUMMARY.md) -- Historical: Phase A completion notes
- [PHASE_B_SUMMARY.md](PHASE_B_SUMMARY.md) -- Historical: Phase B completion notes
- [PHASE_C_SUMMARY.md](PHASE_C_SUMMARY.md) -- Historical: Phase C completion notes
