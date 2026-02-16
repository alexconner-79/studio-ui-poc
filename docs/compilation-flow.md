# Compilation Flow

What happens when you click **Save & Compile** in the editor.

## 1. The editor saves the spec JSON

The editor writes the current in-memory spec back to `spec/screens/{name}.screen.json` via `PUT /api/studio/screens/{name}`.

## 2. The compile API route is called

The editor then calls `POST /api/studio/compile`, which shells out to:

```
npx ts-node compiler/compile.ts
```

## 3. The compiler discovers all screens

`compiler/discover.ts` reads `studio.config.json` and scans `spec/screens/` for every `*.screen.json` file. It parses each one and sorts them by route.

## 4. Each spec is validated

`compiler/validate.ts` runs against each spec -- first trying an Ajv JSON Schema validation (from `spec/schema/screen.schema.json`), and falling back to manual type/prop checks. If any spec is invalid, the whole compile aborts with an error.

## 5. The emitter generates two files per screen

The Next.js emitter (`compiler/emitters/nextjs.ts`) produces two files for each screen:

- **A page file** at `apps/web/app/{route}/page.tsx` -- a thin wrapper that imports and renders the generated component.
- **A component file** at `apps/web/components/generated/{ComponentName}.generated.tsx` -- the actual JSX output built by walking the node tree.

For example, a screen with `route: "/about-page"` produces:
- `apps/web/app/about-page/page.tsx`
- `apps/web/components/generated/AboutPage.generated.tsx`

## 6. A barrel index is generated

`apps/web/components/generated/index.ts` is regenerated with `export` statements for every compiled component, so page files can import from `@/components/generated`.

## 7. Files are formatted and written to disk

Each generated file is run through Prettier, then written to the filesystem. Since this is a Next.js dev server with hot module replacement, the new/updated files are picked up immediately -- the route becomes browsable at `localhost:3000/about-page`.

---

**In short:** spec JSON in `spec/screens/` → validate → emit `.tsx` page + component files into the Next.js app directory → Prettier format → write to disk → instantly live via HMR. The generated code is real, static React code -- there's no runtime renderer or interpreter involved at serving time.
