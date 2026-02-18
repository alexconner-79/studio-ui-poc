# SaaS Architecture & Deployment Strategy

This document captures the rationale and technical decisions for evolving Studio UI from a local dev tool into a hosted SaaS product that designers can use without any local setup.

---

## Core Principle

**Designers never touch a terminal.** They open a browser, sign in, and start designing. Everything else (compilation, package management, deployment) happens behind the scenes.

---

## Deployment Model

### Web-first SaaS

Studio UI will be deployed as a hosted web application. Users access it at a URL (e.g., `studio.xertilox.com`), sign up with OAuth, and start working immediately.

**Why web-first instead of desktop:**

- No download, no install, no app store approval -- designers get a URL and start working
- Updates deploy instantly (no "please update your app" friction)
- Works on any OS (Mac, Windows, Linux, Chromebooks)
- Collaboration is easier (share a project by sharing a URL)
- One codebase to maintain

**Desktop app later (when needed):**

- Wrap the web app in Tauri (modern, lightweight Electron alternative)
- Tauri uses the system's WebView instead of bundling Chromium (~10MB vs ~200MB)
- Adds: offline support, native file access, dedicated process, OS integration (dock icon, menu bar, notifications)
- This is exactly what Figma, Framer, Linear, Notion, and Slack do -- the desktop "app" is the web app in a native shell
- Estimated effort: ~1-2 weeks when ready
- Optional: App Store (Mac) and Microsoft Store distribution

---

## Infrastructure Stack

### Starting stack (~$45/month)

This scales to hundreds of users before needing upgrades.

| Component | Service | Cost | Purpose |
|---|---|---|---|
| Web app hosting | Vercel (Pro) | ~$20/mo | Hosts the Next.js app. Serverless functions handle compilation. Auto-scales. |
| Auth + Database + Storage | Supabase (Pro) | ~$25/mo | OAuth, Postgres (projects/specs/tokens), Storage (assets/exports). Realtime for future collaboration. |
| Domain | Custom domain | ~$12/yr | `studio.xertilox.com` |

### Scaling path (when you outgrow the starter stack)

| Trigger | Action | Service |
|---|---|---|
| Concurrent compilation bottleneck | Dedicated build server | Railway or Fly.io (~$10-20/mo) |
| Session/rate-limiting needs | Caching layer | Redis via Upstash (~$10/mo) |
| Revenue / billing | Payment processing | Stripe (% per transaction) |
| Real-time collaboration | Already included | Supabase Realtime (included in Pro) |
| Heavy asset storage | S3-compatible | Supabase Storage or AWS S3 |

---

## Data Architecture

### Moving from filesystem to database

| Currently (filesystem) | SaaS (Supabase) |
|---|---|
| `spec/screens/*.screen.json` | `screens` table (per project) |
| `tokens/design-tokens.json` | `design_tokens` table (per project) |
| `components/*.component.json` | `components` table (per project) |
| `public/assets/*` | Supabase Storage bucket (per project) |
| `studio.config.json` | `project_settings` column on `projects` table |

### Database schema

```sql
-- Users (managed by Supabase Auth, extended with profile)
users (
  id uuid PRIMARY KEY,      -- from Supabase Auth
  email text NOT NULL,
  name text,
  avatar text,
  role text DEFAULT 'user', -- 'user' | 'admin'
  created_at timestamptz
)

-- Projects
projects (
  id uuid PRIMARY KEY,
  owner_id uuid REFERENCES users(id),
  name text NOT NULL,
  framework text NOT NULL,  -- 'nextjs' | 'expo'
  settings_json jsonb,      -- equivalent of studio.config.json
  created_at timestamptz,
  updated_at timestamptz
)

-- Team access
project_members (
  project_id uuid REFERENCES projects(id),
  user_id uuid REFERENCES users(id),
  role text NOT NULL,        -- 'viewer' | 'editor' | 'admin'
  PRIMARY KEY (project_id, user_id)
)

-- Screens (specs + compiled output)
screens (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects(id),
  name text NOT NULL,
  spec_json jsonb NOT NULL,
  compiled_tsx text,         -- cached compiled output
  updated_at timestamptz
)

-- Design tokens (per project)
design_tokens (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects(id) UNIQUE,
  tokens_json jsonb NOT NULL
)

-- Reusable components
components (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects(id),
  name text NOT NULL,
  spec_json jsonb NOT NULL
)

-- Uploaded assets
assets (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES projects(id),
  filename text NOT NULL,
  storage_path text NOT NULL, -- path in Supabase Storage
  mime_type text,
  size_bytes bigint
)

-- Version history (per screen)
versions (
  id uuid PRIMARY KEY,
  screen_id uuid REFERENCES screens(id),
  spec_json jsonb NOT NULL,
  compiled_tsx text,
  created_at timestamptz
)
```

---

## Compilation in a Hosted Environment

### The problem

Currently, the compiler shells out to `node dist/compiler/compile.js` on the local filesystem. This won't work in a serverless environment (no persistent filesystem, execution time limits).

### The solution

The compiler is fundamentally just **JSON in, string out**. It reads spec JSON and token JSON, and produces TSX strings. No filesystem I/O is inherently required.

**Refactor to a pure function:**

```typescript
// Current: filesystem-dependent
compile()
  → reads *.screen.json from disk
  → reads design-tokens.json from disk
  → writes *.generated.tsx to disk

// SaaS: pure function
compile(specs: ScreenSpec[], tokens: DesignTokens, config: StudioConfig)
  → returns { files: [{ path: string, content: string }], errors: CompileError[] }
```

This means:
- Compilation runs in Vercel serverless functions (no dedicated build server needed)
- API routes handle reading from Supabase and writing back
- No `exec()`, no shell commands, no filesystem in the hot path
- Scales automatically with Vercel's infrastructure

### When a dedicated build server is needed

Only when concurrent compilations become a bottleneck (hundreds of users compiling simultaneously). At that point, add a job queue (BullMQ + Redis) and a dedicated server (Railway/Fly.io, ~$10-20/month).

---

## User Flows

### Designer signs up and creates a project

```
1. Go to studio.xertilox.com
2. Sign up (Google OAuth / GitHub OAuth / email+password)
3. Dashboard shows "My Projects"
4. Click "New Project"
5. Choose: "Web App (Next.js)" or "Mobile App (Expo)"
6. Name the project
7. Optionally pick a template (Landing Page, Dashboard, etc.)
8. Start designing immediately
```

### Designer previews their work

**Web project:**
- "Preview" button opens compiled output in an iframe (inline preview mode)
- Or opens in a new tab

**Mobile project (Expo):**
- Canvas renders inside phone-frame chrome (status bar, notch, home indicator)
- "Preview" button opens Expo Web rendering in an embedded iframe
- "Preview on Device" shows a QR code for Expo Go (real native rendering on their phone)

### Designer exports / ships their work

**No GitHub required:**
- "Export" → Download ZIP → contains a complete, self-contained Next.js or Expo project
- The ZIP includes `package.json` with all dependencies listed
- A developer runs `npm install && npm run dev` to start working

**With GitHub (optional):**
- "Connect GitHub" → OAuth flow → pick or create a repo
- "Push to GitHub" → one click → Studio creates the repo, commits all files, pushes
- Developer picks it up from there

**With Vercel (optional):**
- "Deploy to Vercel" → OAuth flow → one click
- Vercel creates repo, builds, and deploys automatically
- Designer gets a live URL (e.g., `my-project.vercel.app`)

### Package installation

**Designers never install packages.** At every stage:
- While designing: no packages needed -- the editor IS the app, running in the browser
- Preview: rendered by the server or Expo Go -- no local build
- ZIP export: includes `package.json`; the developer runs `npm install` once
- Vercel deploy: Vercel runs `npm install` automatically as part of its build pipeline

---

## Admin Panel

### Platform admin (product owner)

- **User management**: list users, invite by email, deactivate accounts, impersonate for debugging
- **Usage analytics**: projects created, compilations run, exports generated, active users
- **Feature flags**: enable/disable features per user or globally (useful for beta testing)
- **System health**: Vercel function metrics, Supabase usage, error rates

### Project admin (project owner)

- **Team management**: invite members with roles (viewer: can view screens, editor: can edit, admin: can manage members)
- **Project settings**: change framework, update design tokens globally, manage component library
- **Export settings**: connected GitHub repo, Vercel project, deployment configuration

---

## Security Considerations

| Concern | Mitigation |
|---|---|
| Compiler executes arbitrary code | Refactor to pure function (no `exec()`, no shell). Input validation on all specs before compiling. |
| Multi-tenant data isolation | Row-level security (RLS) in Supabase. Every query scoped to user's projects. |
| Rate limiting | Per-user rate limits on compilation and export (prevents abuse). |
| Asset uploads | File type validation, size limits, virus scanning (Supabase Storage policies). |
| Authentication | Supabase Auth handles token management, session refresh, CSRF protection. |
| Secrets | Environment variables in Vercel (never in client bundle). Supabase service role key server-side only. |

---

## React Native / Expo: Target-Aware Architecture

### One tool, two experiences

The editor is a single codebase. The project's target (`"nextjs"` or `"expo"`) is stored in project settings. The editor adapts:

| Aspect | Web (Next.js) | Mobile (Expo) |
|---|---|---|
| Node palette | All 21 node types | RN-compatible subset (no `Grid`, adds `SafeAreaView`) |
| Style panel | Full CSS properties | RN-compatible subset (no `grid-template-columns`, different shadows) |
| Compiler | `nextjs.ts` emitter → Tailwind + JSX | `expo.ts` emitter → StyleSheet + RN components |
| Preview | Browser tab / iframe | Phone-frame chrome + Expo Web iframe + Expo Go QR |
| Export | Next.js project (ZIP / GitHub / Vercel) | Expo project (ZIP / GitHub) |
| Canvas chrome | Generic device frames | Phone-shaped frames (status bar, notch, home indicator) |

From the designer's perspective, it feels like a purpose-built tool for their target. Under the hood, it's one codebase with a config flag.

### Why not two separate tools?

- ~80% of the code is identical (canvas, layers, DnD, property panel, save/load, auth, projects)
- Every feature and bug fix would need to be done twice
- They'd diverge over time, creating a maintenance nightmare
- The target-aware approach gives the same "feels purpose-built" result with none of the duplication cost

---

## Web vs Desktop: Decision Rationale

### Why web-first

| Factor | Web | Desktop |
|---|---|---|
| Time to market | Immediate (deploy to Vercel) | Weeks (build pipeline, signing, distribution) |
| User friction | Zero (just a URL) | Download + install |
| Updates | Instant (deploy and done) | Requires user to update (or auto-update infrastructure) |
| OS support | All (Mac, Windows, Linux, Chromebooks) | Per-platform builds |
| Collaboration | Native (share a URL) | Requires server sync anyway |
| Offline support | Limited (PWA possible) | Full |
| Native feel | Good (modern browsers are fast) | Better (dedicated process, OS integration) |

### Desktop when ready

Use **Tauri** (not Electron):
- Tauri uses the system's native WebView → ~10MB app vs Electron's ~200MB
- Rust-based, much more secure than Electron
- Same web codebase, no rewrite needed
- Adds: offline mode, native file system, OS-level notifications, dock/taskbar integration
- ~1-2 weeks of effort to wrap the existing web app

### Precedent

This is exactly the model used by: Figma, Framer, Linear, Notion, Slack, VSCode (Electron), Zed (native but web-inspired). All started web-first, added desktop wrappers later.
