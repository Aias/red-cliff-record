---
name: rcr-frontend
description: Component development rules specific to Red Cliff Record. Use when working with React components, Tailwind CSS styling, Radix/Shadcn primitives, icons, forms, or frontend code in this project. Triggers on component files, styling questions, design tokens, Tailwind v4, Shadcn, Radix, TanStack Forms, or Lucide icons.
---

# RCR Frontend

Supplements global `react-guidelines` and `frontend-html-css-guidelines` skills.

## Component Organization

- Reusable components: `src/app/components/` with kebab-case naming (includes all Shadcn-derived primitives)
- No separate `ui/` directory — everything lives directly under `src/app/components/`
- Page-specific components: `-components/` directory or `-component.tsx` suffix

## Styling

- **Tailwind CSS v4** with `c-*` design tokens from `src/app/styles/theme.css`
- Semantic color pattern: `c-main` / `c-main-contrast`, `c-destructive` / `c-destructive-contrast`. Never invent token names — check `src/app/styles/app.css` for the full list
- **Never** use legacy Shadcn theme variables (`bg-background`, `text-foreground`, etc.)
- **Detecting invalid classes**: Oxfmt sorts unknown classes to the front. If classes appear out of order after `bun check`, they're misspelled or missing from the theme

## Radix & Shadcn

- Always import Radix from the `radix-ui` package (`import { HoverCard as HoverCardPrimitive } from 'radix-ui'`), not from subpackages like `@radix-ui/react-hover-card`
- Use `asChild` to compose styling (e.g., dropdown trigger styled as Button) rather than duplicating inline styles
- Mark key DOM nodes with `data-slot` attributes for styling hooks

## Icons & Loading

- Lucide icons with `Icon` suffix: `HomeIcon`, not `Home`
- Use `<Spinner />` from `@/components/spinner` for loading states

## Forms

- TanStack Forms + Zod schemas for form management and validation
