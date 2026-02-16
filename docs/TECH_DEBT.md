# Tech Debt Log

Minor items that work fine today but could be improved. None are urgent.

---

## Low Priority -- Hardcoded Paths

Several API routes and compiler scripts use hardcoded relative paths for the monorepo root and screen directory:

- `apps/web/app/api/studio/compile/route.ts` -- `ROOT_DIR = path.resolve(process.cwd(), "../..")` and `timeout: 30000`
- `apps/web/app/api/studio/screens/route.ts` -- hardcoded `SCREENS_DIR` path
- `apps/web/app/api/studio/screens/[name]/route.ts` -- same hardcoded `SCREENS_DIR`
- `compiler/dev.ts` -- platform-specific pnpm paths (`~/.local/share/pnpm/pnpm`, `~/Library/pnpm/pnpm`)

**Suggestion:** Centralise all path resolution through `studio.config.json` or environment variables.

---

## Low Priority -- AI Config Defaults

- `apps/web/app/api/studio/ai/generate/route.ts` -- provider defaults (`openai`, model names, `temperature: 0.7`) are inline rather than in a shared config

**Suggestion:** Pull AI defaults into `studio.config.json` or a dedicated AI config section.

---

## Low Priority -- Error Handling

- `apps/web/components/studio/editor-layout.tsx` line ~224 -- `console.error` on save failure; user never sees the error

**Suggestion:** Add a toast/notification system and surface save errors to the user.

---

## Low Priority -- Lucide Icons Initial Compile Time

- `apps/web/components/studio/renderer.tsx` and `apps/web/components/studio/icon-picker.tsx` both import `icons` from `lucide-react`, which pulls in all ~1500 icons
- First Turbopack compilation takes ~2 minutes; subsequent compiles are fast thanks to caching
- Particularly slow on iCloud-synced directories

**Suggestion:** Replace the full `icons` import with either:
- Lucide's `dynamicIconImports` for lazy loading individual icons
- A static icon name list for the picker (no full import needed for search)
- Dynamic `import()` in the renderer to load only the icon actually used

---

## Medium Priority -- Compiler Scaling

These all work fine with a handful of screens but will become bottlenecks as the project grows.

### Full recompile on every save

`compiler/compile.ts` discovers and re-emits *every* screen on every invocation, even if only one spec changed.

**Suggestion:** Track `.screen.json` mtimes and only re-emit screens that changed since the last compile. Keep a `.compile-cache.json` manifest to compare against.

### Synchronous `execSync` blocks the event loop

`apps/web/app/api/studio/compile/route.ts` uses `execSync`, which blocks the Node.js process for the entire compile duration (up to the 30s timeout). Fine for single-user local dev, problematic if ever hosted.

**Suggestion:** Switch to `exec` (async) or `spawn` and stream progress back to the client, or move compilation to a background worker.

### `ts-node` overhead at runtime

The compile API shells out to `npx ts-node compiler/compile.ts` on every save. TypeScript parsing and transpilation adds overhead each time.

**Suggestion:** Pre-compile the compiler to JS via `tsc` or `tsup` and run `node compiler/compile.js` instead. Could cut compile times noticeably.

### No per-screen error isolation

If one spec out of many fails validation, the entire compile aborts and no screens get updated. One bad spec blocks all others.

**Suggestion:** Compile all valid screens, collect failures, and report them separately. Return partial success so working screens still get their output updated.

### No output diffing (unnecessary HMR triggers)

The compiler overwrites every generated file on every run, even when the content hasn't changed. This triggers unnecessary hot module reloads for unchanged screens.

**Suggestion:** Compare new output to the existing file content before writing. Skip the write when identical to avoid spurious HMR reloads and improve dev experience.

---

## Trivial -- ESLint Suppression

- `apps/web/components/studio/renderer.tsx` -- `eslint-disable @next/next/no-img-element` to allow native `<img>` in the runtime renderer

**Suggestion:** Consider switching to Next.js `Image` component if/when image optimisation is needed.
