# UI Studio --- Compiler Rules v1

## Purpose

Define strict deterministic rules for generating React code from UI
Spec.

------------------------------------------------------------------------

## File Generation

Route: /signup Output: /app/signup/page.tsx

------------------------------------------------------------------------

## Rules

-   No unnecessary wrappers
-   Tokens only
-   No inline styles
-   Self-close where possible
-   Deterministic output

------------------------------------------------------------------------

## Publish Behaviour

-   Create branch
-   Commit spec + generated files
-   Open PR

No direct main branch commits.
