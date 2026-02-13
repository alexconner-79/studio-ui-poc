# UI Studio --- Spec Schema v1

## Purpose

The UI Spec is the structured, versioned representation of a screen.

It is: - Committed to the repo - Diffable - Deterministic -
Framework-agnostic - The source of truth for generated UI

The spec must be stable, minimal, and composable.

------------------------------------------------------------------------

## File Location

Each screen spec lives in:

/studio/screens/{route-name}.screen.json

Example:

/studio/screens/signup.screen.json

------------------------------------------------------------------------

## Top-Level Structure

``` json
{
  "version": 1,
  "route": "/signup",
  "meta": {
    "layout": "default",
    "auth": "public"
  },
  "tree": {}
}
```

------------------------------------------------------------------------

## Node Structure

Each UI element is a typed node.

``` json
{
  "id": "node_1",
  "type": "Stack",
  "props": {},
  "children": []
}
```

------------------------------------------------------------------------

## Allowed Node Types (v1)

### Layout Primitives

-   Stack
-   Grid
-   Section
-   ScrollArea
-   Spacer

### Repo Components

Any exported component from configured component directory.

------------------------------------------------------------------------

## Rules

-   Props must match TypeScript definitions.
-   Tokens only.
-   No inline styles.
-   No arbitrary CSS.
-   Deterministic output only.
