# UI Studio --- Repo Template v1

## Framework

Next.js (App Router) + Tailwind + shadcn baseline

------------------------------------------------------------------------

## Folder Structure

    /app
    /ui
    /studio

------------------------------------------------------------------------

## Required Files

### studio.config.json

``` json
{
  "framework": "nextjs",
  "appDir": "app",
  "componentsDir": "ui/components",
  "layoutDir": "ui/layout",
  "tokensPath": "ui/tokens/tokens.json",
  "importAlias": "@/ui"
}
```

------------------------------------------------------------------------

## Required Layout Primitives

-   Stack
-   Grid
-   Section
-   ScrollArea
-   Spacer

------------------------------------------------------------------------

## Non-Negotiables

-   No inline styles
-   Token-based spacing only
-   Clean imports
-   Lint-safe output
