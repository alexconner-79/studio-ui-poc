# Studio UI — Component Library Specification

> **Status:** Living document. Governs `studio-minimal-web.tokens.json`, `studio-minimal-native.tokens.json`, and all Studio starter theme files. Updated when components are added, removed, or reclassified.

---

## 1. Platform Matrix

Two DS families, **strictly separate**. A user picks one at project creation. No mixing.

| Family | `platform` value | Rendering layer | Targets |
|---|---|---|---|
| **Studio Web** | `"web"` | shadcn/ui + Tailwind CSS | Desktop web, mobile-responsive web |
| **Studio Native** | `"native"` | React Native Paper | iOS, Android (app-focused) |

**Rules:**
- Website blocks (Hero, FeatureGrid, PricingCard, etc.) are **web-only** — they have no native equivalent.
- App Blocks (MetricCard, DataList, FilterSheet, etc.) exist in **both** platforms but with platform-appropriate components (web uses shadcn primitives; native uses RN Paper).
- No `"universal"` platform in Studio starters. The existing `material3-universal.tokens.json` is retained for that external library only.
- Starter themes (Warm, Enterprise, Vibrant, Dark) are **web-only** variants of `studio-minimal-web`. They inherit the same full component set; only token values differ.

---

## 2. Web Component Inventory (~85 components)

All components live in `studio-minimal-web.tokens.json` under `"components"`. Starter themes inherit this set via `"inheritsComponents": "studio-minimal-web"`.

### Category: Primitives (21 components)

The token-bound atoms. These are rendered by the 45 files in `apps/web/components/ui/`.

| Key | Name | Description |
|---|---|---|
| `Button` | Button | Trigger actions |
| `Input` | Input | Single-line text input |
| `Textarea` | Textarea | Multi-line text input |
| `Select` | Select | Dropdown selection |
| `Checkbox` | Checkbox | Boolean checkbox |
| `Radio` | RadioGroup | Exclusive radio group |
| `Switch` | Switch | Toggle on/off |
| `Slider` | Slider | Range input |
| `Label` | Label | Form field label |
| `Badge` | Badge | Status label |
| `Avatar` | Avatar | User image/initials |
| `Card` | Card | Content container |
| `Separator` | Separator | Horizontal/vertical divider |
| `Skeleton` | Skeleton | Loading placeholder |
| `Spinner` | Spinner | Loading indicator |
| `ProgressBar` | ProgressBar | Progress indicator |
| `Tooltip` | Tooltip | Hover hint |
| `Popover` | Popover | Click-triggered overlay |
| `Alert` | Alert | Contextual inline feedback |
| `Toast` | Toast | Ephemeral notification |
| `Toggle` | Toggle | Pressed/unpressed button |

### Category: Forms (10 components)

Composed form-control patterns, typically wrapping Primitives.

| Key | Name | Description |
|---|---|---|
| `Form` | Form | React Hook Form wrapper |
| `FormSection` | FormSection | Labelled group of form fields |
| `DatePicker` | DatePicker | Single date selection |
| `DateRangePicker` | DateRangePicker | Start/end date range |
| `TimePicker` | TimePicker | Time selection |
| `InputOTP` | InputOTP | One-time password input |
| `Combobox` | Combobox | Searchable select |
| `MultiSelect` | MultiSelect | Multiple selection dropdown |
| `FileUpload` | FileUpload | Drag-and-drop file input |
| `ColorPicker` | ColorPicker | Hex/HSL color input |

### Category: Overlays (9 components)

Components that appear above the page flow.

| Key | Name | Description |
|---|---|---|
| `Dialog` | Dialog | Modal dialog |
| `AlertDialog` | AlertDialog | Confirmation dialog |
| `Drawer` | Drawer | Slide-in panel |
| `Sheet` | Sheet | Bottom/side sheet |
| `DropdownMenu` | DropdownMenu | Triggered dropdown menu |
| `ContextMenu` | ContextMenu | Right-click menu |
| `Command` | Command | Command palette |
| `Menubar` | Menubar | Horizontal menu bar |
| `HoverCard` | HoverCard | Hover-triggered card |

### Category: Navigation (8 components)

Structural navigation patterns.

| Key | Name | Description |
|---|---|---|
| `Navbar` | Navbar | Top navigation bar |
| `Sidebar` | Sidebar | Vertical navigation panel |
| `Tabs` | Tabs | Tab content switcher |
| `NavigationMenu` | NavigationMenu | Mega-nav / link group |
| `Breadcrumb` | Breadcrumb | Hierarchical trail |
| `Pagination` | Pagination | Page navigation |
| `Stepper` | Stepper | Step progress indicator |
| `CommandBar` | CommandBar | Global search / quick-launch |

### Category: Layout (9 components)

Structural layout containers.

| Key | Name | Description |
|---|---|---|
| `PageHeader` | PageHeader | Top-of-page title row |
| `Section` | Section | Content section with heading |
| `Grid` | Grid | Responsive CSS grid |
| `Stack` | Stack | Flexbox stack (vertical/horizontal) |
| `Divider` | Divider | Horizontal/vertical separator |
| `ScrollArea` | ScrollArea | Scrollable container |
| `ResizablePanel` | ResizablePanel | Drag-to-resize panels |
| `AspectRatio` | AspectRatio | Fixed-ratio container |
| `Collapsible` | Collapsible | Expand/collapse container |

### Category: SaaS (11 components)

Dashboard and application-specific composed blocks. These are website-agnostic — any SaaS product uses them.

| Key | Name | Description |
|---|---|---|
| `DataGrid` | DataGrid | Filterable, sortable data table |
| `FilterBar` | FilterBar | Inline filter controls row |
| `KPICard` | KPICard | Single metric with trend |
| `ActivityFeed` | ActivityFeed | Timestamped event list |
| `StatusBadge` | StatusBadge | Semantic status indicator |
| `UserMenu` | UserMenu | Account dropdown in navbar |
| `NotificationBell` | NotificationBell | Bell icon with dropdown |
| `BoardCard` | BoardCard | Kanban card |
| `ChartCard` | ChartCard | Metric chart (line/bar/donut) |
| `EmptyState` | EmptyState | Zero-data placeholder |
| `FormWizard` | FormWizard | Multi-step form container |

### Category: Website (12 components)

Marketing and website-specific blocks. Not appropriate for SaaS dashboards.

| Key | Name | Description |
|---|---|---|
| `Hero` | Hero | Full-width hero section |
| `FeatureGrid` | FeatureGrid | Feature highlights grid |
| `CTABanner` | CTABanner | Call-to-action stripe |
| `PricingCard` | PricingCard | Pricing tier card |
| `TestimonialCard` | TestimonialCard | Customer quote card |
| `LogoCloud` | LogoCloud | "Trusted by" logo row |
| `FAQ` | FAQ | Frequently asked questions |
| `BlogCard` | BlogCard | Article preview card |
| `TeamCard` | TeamCard | Team member card |
| `Footer` | Footer | Page footer |
| `ContactForm` | ContactForm | Pre-composed contact form |
| `BentoGrid` | BentoGrid | Asymmetric feature grid |

### Category: Typography (3 components)

Standalone text primitives exposed as palette draggables.

| Key | Name | Description |
|---|---|---|
| `Heading` | Heading | Heading element (h1–h6) |
| `Text` | Text | Body text |
| `Link` | Link | Hyperlink |

**Web total: 83 components**

---

## 3. Native Component Inventory (~50 components)

All components live in `studio-minimal-native.tokens.json` under `"components"`.

### Category: Primitives (14 components)

| Key | Name | Description |
|---|---|---|
| `Button` | Button | RN Paper button |
| `TextInput` | TextInput | RN Paper text field |
| `Switch` | Switch | RN toggle |
| `Checkbox` | Checkbox | RN Paper checkbox |
| `RadioButton` | RadioButton | RN Paper radio |
| `Slider` | Slider | RN range slider |
| `Badge` | Badge | Notification badge |
| `Avatar` | Avatar | User avatar |
| `Card` | Card | Material card |
| `Chip` | Chip | Compact label |
| `Divider` | Divider | Separator |
| `Skeleton` | Skeleton | Loading placeholder |
| `ActivityIndicator` | ActivityIndicator | Spinner |
| `ProgressBar` | ProgressBar | Linear progress |

### Category: Forms (4 components)

| Key | Name | Description |
|---|---|---|
| `Picker` | Picker | iOS wheel / Android dropdown picker |
| `DateTimePicker` | DateTimePicker | Native date/time picker |
| `MultiSelect` | MultiSelect | Bottom-sheet multi-select |
| `OTPInput` | OTPInput | One-time password input |

### Category: Overlays (7 components)

| Key | Name | Description |
|---|---|---|
| `Alert` | Alert | Native system alert |
| `ActionSheet` | ActionSheet | iOS action sheet |
| `Modal` | Modal | Native modal sheet |
| `BottomSheet` | BottomSheet | Slide-up panel |
| `Snackbar` | Snackbar | Brief notification |
| `Tooltip` | Tooltip | Long-press hint |
| `Dialog` | Dialog | RN Paper dialog |

### Category: Navigation (5 components)

| Key | Name | Description |
|---|---|---|
| `Appbar` | Appbar | Top navigation bar |
| `TabBar` | TabBar | Bottom tab bar |
| `NavigationStack` | NavigationStack | Stack navigator |
| `Drawer` | Drawer | Side navigation drawer |
| `BottomNavigation` | BottomNavigation | Bottom navigation bar |

### Category: Layout (8 components)

| Key | Name | Description |
|---|---|---|
| `SafeAreaView` | SafeAreaView | Safe area container |
| `KeyboardAvoidingView` | KeyboardAvoidingView | Keyboard-aware container |
| `ScrollView` | ScrollView | Scrollable container |
| `FlatList` | FlatList | Virtualised list |
| `SectionList` | SectionList | Grouped list |
| `Surface` | Surface | Elevated container |
| `FAB` | FAB | Floating action button |
| `Icon` | Icon | SF Symbol / Material icon |

### Category: App Blocks (9 components)

App-specific composed blocks equivalent to SaaS blocks on web.

| Key | Name | Description |
|---|---|---|
| `MetricCard` | MetricCard | Single metric display |
| `DataList` | DataList | Typed item list with dividers |
| `ActivityFeed` | ActivityFeed | Timestamped event list |
| `StatusBadge` | StatusBadge | Semantic status indicator |
| `EmptyState` | EmptyState | Zero-data placeholder |
| `SearchBar` | SearchBar | Search input with cancel |
| `FilterSheet` | FilterSheet | Bottom-sheet filter panel |
| `UserRow` | UserRow | User + subtitle + action row |
| `NotificationItem` | NotificationItem | Notification list item |

**Native total: 47 components**

---

## 4. Token → CSS Variable Mapping (Web)

The `CanvasTokenBridge` component emits a `<style>` tag scoped to `[data-canvas-root]` containing two sets of CSS custom properties on every token store update.

### Studio-namespaced variables

These are the canonical Studio variable names. Used by composed/block components (SaaS, Website categories).

| Token key | CSS variable | Example value |
|---|---|---|
| `color.accent` | `--color-accent` | `#7c3aed` |
| `color.accent-hover` | `--color-accent-hover` | `#6d28d9` |
| `color.accent-muted` | `--color-accent-muted` | `#ede9fe` |
| `color.accent-foreground` | `--color-accent-foreground` | `#ffffff` |
| `color.background` | `--color-background` | `#ffffff` |
| `color.foreground` | `--color-foreground` | `#171717` |
| `color.surface` | `--color-surface` | `#fafafa` |
| `color.surface-raised` | `--color-surface-raised` | `#ffffff` |
| `color.muted` | `--color-muted` | `#f5f5f5` |
| `color.muted-foreground` | `--color-muted-foreground` | `#737373` |
| `color.border` | `--color-border` | `#e5e5e5` |
| `color.border-strong` | `--color-border-strong` | `#d4d4d4` |
| `color.success` | `--color-success` | `#16a34a` |
| `color.warning` | `--color-warning` | `#d97706` |
| `color.error` | `--color-error` | `#dc2626` |
| `spacing.1` | `--spacing-1` | `4px` |
| `spacing.2` | `--spacing-2` | `8px` |
| `spacing.3` | `--spacing-3` | `12px` |
| `spacing.4` | `--spacing-4` | `16px` |
| `spacing.5` | `--spacing-5` | `20px` |
| `spacing.6` | `--spacing-6` | `24px` |
| `spacing.8` | `--spacing-8` | `32px` |
| `spacing.10` | `--spacing-10` | `40px` |
| `spacing.12` | `--spacing-12` | `48px` |
| `spacing.16` | `--spacing-16` | `64px` |
| `spacing.20` | `--spacing-20` | `80px` |
| `radius.sm` | `--radius-sm` | `4px` |
| `radius.md` | `--radius-md` | `8px` |
| `radius.lg` | `--radius-lg` | `12px` |
| `radius.xl` | `--radius-xl` | `16px` |
| `radius.full` | `--radius-full` | `9999px` |
| `typography.font-sans` | `--font-sans` | `Inter, ui-sans-serif, system-ui, sans-serif` |
| `typography.font-mono` | `--font-mono` | `JetBrains Mono, ui-monospace, monospace` |
| `typography.text-xs` | `--text-xs` | `11px` |
| `typography.text-sm` | `--text-sm` | `13px` |
| `typography.text-base` | `--text-base` | `15px` |
| `typography.text-lg` | `--text-lg` | `17px` |
| `typography.text-xl` | `--text-xl` | `20px` |
| `typography.text-2xl` | `--text-2xl` | `24px` |
| `typography.text-3xl` | `--text-3xl` | `30px` |
| `typography.text-4xl` | `--text-4xl` | `38px` |
| `typography.leading-tight` | `--leading-tight` | `1.2` |
| `typography.leading-normal` | `--leading-normal` | `1.5` |
| `typography.leading-relaxed` | `--leading-relaxed` | `1.75` |
| `shadow.xs` | `--shadow-xs` | `0 1px 2px rgb(0 0 0 / 0.04)` |
| `shadow.sm` | `--shadow-sm` | `0 1px 3px …` |
| `shadow.md` | `--shadow-md` | `0 4px 8px …` |
| `shadow.lg` | `--shadow-lg` | `0 8px 24px …` |
| `shadow.xl` | `--shadow-xl` | `0 20px 40px …` |

### shadcn-compatible alias variables

Emitted alongside the Studio-namespaced variables so that all 45 files in `apps/web/components/ui/` respond to token changes without modification. These are also scoped to `[data-canvas-root]` so the Studio editor chrome is unaffected.

| shadcn variable | Maps from Studio token | Notes |
|---|---|---|
| `--background` | `color.background` | |
| `--foreground` | `color.foreground` | |
| `--card` | `color.surface` | |
| `--card-foreground` | `color.foreground` | |
| `--popover` | `color.surface` | |
| `--popover-foreground` | `color.foreground` | |
| `--primary` | `color.accent` | |
| `--primary-foreground` | `color.accent-foreground` | |
| `--secondary` | `color.muted` | |
| `--secondary-foreground` | `color.foreground` | |
| `--muted` | `color.muted` | |
| `--muted-foreground` | `color.muted-foreground` | |
| `--accent` | `color.accent-muted` | shadcn `accent` = subtle bg, not brand |
| `--accent-foreground` | `color.foreground` | |
| `--destructive` | `color.error` | |
| `--destructive-foreground` | `#ffffff` | Always white on red |
| `--border` | `color.border` | |
| `--input` | `color.border` | |
| `--ring` | `color.accent` | Focus ring = accent |
| `--radius` | `radius.md` | shadcn base radius |

**Naming convention:** `color.accent` → `--color-accent` (dot → hyphen, prefix `--`). Nested keys flatten: `typography.font-sans` → `--font-sans`.

---

## 5. Property Editability Tiers

Every editable property on a canvas node belongs to exactly one tier. The tier is shown as a colour-coded chip in the property panel.

### Tier 1 — Token-bound (purple chip)

Controlled by DS tokens. Propagate to all instances via CSS variables. **Cannot be overridden at instance level.**

- All `color.*` values (background, text, border, surface)
- All `typography.*` values (font family, font size, line height)
- All `spacing.*` values used in component padding/gap
- All `radius.*` values
- All `shadow.*` values

The property panel shows these fields as **read-only** with a "Edit in DS →" link that opens the DS token editor.

### Tier 2 — Variant/Prop (blue chip)

Component-level choices set per canvas instance. Stored on `NodeInstance.props`.

- `variant` — e.g. `"outline"`, `"destructive"`
- `size` — e.g. `"sm"`, `"lg"`
- `orientation`, `side`, `mode`, `type` (component-specific enum props)
- Content props: `children`, `title`, `description`, `placeholder`, `label`
- Boolean behaviour props: `disabled`, `loading`, `open`, `checked`

These are the **primary editing surface** in the property panel. Selecting a variant or setting a prop never requires touching tokens.

### Tier 3 — Raw Override (orange chip)

Explicit dimensional or style values set directly on a node, bypassing tokens. Stored on `NodeInstance.style`.

- Explicit `width`, `height`, `minWidth`, `maxWidth`
- Explicit `padding`, `margin` values (when overriding token-derived spacing)
- Explicit `color`, `backgroundColor` (when overriding token-derived colour)
- `position`, `top`, `left`, `zIndex`

These appear in a collapsible **"Overrides"** section at the bottom of the property panel. Each override field shows a warning: *"Not token-bound — this value will not update if the DS changes."* A **Reset** button restores the DS default.

### Precedence

```
Raw Override (wins) > Variant/Prop default > Token-bound value
```

The effective value and its source tier are always shown in the panel.

---

## 6. User-Authored Component Workflows

### 6a. Code-first (developer path)

Intended for developers who write components in code and want them to appear in Studio.

```
Developer writes .tsx file
        ↓
Studio codebase scanner (v0.10.0 brownfield)
reads exports, prop types, variants
        ↓
Component appears in palette under "Custom" category
        ↓
Canvas renders it via local module server (v0.10.9)
        ↓
No commit step — the file already exists in the project
```

**Behaviour:**
- Auto-scanned when the brownfield import modal is used
- Prop types extracted from TypeScript; inferred as Tier 2 (variant/prop) by default
- File path stored on the DS component definition so the registry can load it
- If the file moves or is deleted, the component falls back to a `StructuralInstance` placeholder with a "File not found" badge

### 6b. Studio-first (designer path)

Intended for designers who build components visually and want their work exported as code.

```
Designer selects nodes on canvas (any combination of primitives/blocks)
        ↓
"Promote to Component" (right-click menu or toolbar)
        ↓
Promotion wizard:
  1. Component name + category
  2. Select which child props to "expose" (they become the component's prop interface)
  3. Confirm — component added to DS definition
        ↓
Component appears in palette immediately
        ↓
On next compile/export, Studio generates a .tsx file:
  apps/[project]/components/[name].tsx
        ↓
Developer reviews generated file, commits to project
        ↓
File is now also available via the code-first path
```

**Exposed props** — when the designer marks a child's prop as "exposed", it is hoisted to the parent component's interface. Example: a Card with a `children.Heading.text` prop exposed becomes `<MyCard title="…" />` in the generated TSX.

**Both paths produce the same DS component definition schema.** The schema is the canonical representation; the rendering source (internal template vs scanned file vs generated file) is an implementation detail stored in `importPath`.

---

## 7. Override Model

Three levels of change, with explicit scope and storage.

| Level | What you change | Affects | Stored on |
|---|---|---|---|
| **Token** | `color.accent = #e11d48` | Every instance of every component, all screens, all projects using this DS | DS token record (`tokens.color.accent`) |
| **DS component** | Add `variant: "ghost"` to Button | Every Button instance across all screens in all projects using this DS | DS component definition (`components.Button.variants`) |
| **Instance** | Set `size="sm"` on one Button on Screen X | That node only | `NodeInstance.props.size` |

**Precedence:** Instance > DS component default > Token

**Resetting:** The property panel's "Reset" button on any Tier-2 or Tier-3 field removes the instance-level override and restores the DS component default (Tier 2) or token-derived value (Tier 1).

**Visual indicators in the canvas property panel:**
- Default state: no chip — value comes from DS defaults
- Modified Tier 2: blue "custom" dot next to the field
- Active Tier 3 override: orange "override" dot with a Reset link

---

## 8. Component Definition Schema Reference

Every component entry in a `*.tokens.json` file follows this shape:

```jsonc
"ComponentKey": {
  "name": "Display Name",          // shown in palette
  "description": "One-liner",      // shown in tooltip
  "category": "SaaS",             // palette group (see Section 2/3)
  "importPath": "studio:shadcn",  // rendering source
  "variants": [
    {
      "name": "variant",           // prop name
      "options": ["default", "outline", "destructive"],
      "default": "default"
    }
  ],
  "states": ["default", "hover", "focus", "disabled"],
  "props": [
    {
      "name": "children",
      "type": "string",            // string | number | boolean | node | function | icon
      "default": "Label",
      "description": "optional"
    }
  ],
  "defaultTemplate": {             // optional: node tree dropped on canvas
    "type": "Stack",
    "children": [/* ... */]
  }
}
```

**`importPath` values:**

| Value | Resolution |
|---|---|
| `"studio:shadcn"` | `apps/web/components/ui/[name].tsx` (reference copy) |
| `"studio:local"` | User's scanned file via local module server (v0.10.9) |
| `"studio:template"` | Pure template — no runtime import; renders from `defaultTemplate` |
| `"antd"` | `antd` npm package |
| `"@mui/material"` | `@mui/material` npm package |
| `"react-native-paper"` | `react-native-paper` npm package |

---

## 9. What Each Release Implements

| Release | What ships |
|---|---|
| **v0.10.5** | CSS variable bridge; 4 starter themes; full 83-component web definition in `studio-minimal-web.tokens.json`; DS picker restructure |
| **v0.10.6** | Unified project+DS creation flow; dashboard layout; empty state guidance |
| **v0.10.7** | MCP server exposing this component library to AI agents |
| **v0.10.8** | Canvas interaction quality (keyboard shortcuts, grouping, align/distribute) |
| **v0.10.9** | Brownfield rendering: `studio:local` import path for user-owned files |
| **v0.11.0** | Studio-first component authoring: "Promote to Component" wizard; generated `.tsx` export |
