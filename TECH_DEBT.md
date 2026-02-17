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

## Trivial -- ESLint Suppression

- `apps/web/components/studio/renderer.tsx` -- `eslint-disable @next/next/no-img-element` to allow native `<img>` in the runtime renderer

**Suggestion:** Consider switching to Next.js `Image` component if/when image optimisation is needed.
