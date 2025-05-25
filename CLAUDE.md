# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Red Cliff Record is a personal knowledge repository that aggregates data from multiple external sources (GitHub, Airtable, Raindrop, Readwise, Twitter, Adobe) into a searchable, relational database. It's built with React 19, TanStack Router, tRPC, Drizzle ORM, and PostgreSQL, deployed on Cloudflare Pages.

## Essential Commands

**Development:**

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm lint` - Format, lint, and type check (REQUIRED before commits)
- `pnpm tsc` - Type check only (REQUIRED before commits)

**Database:**

- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Drizzle Studio for database inspection

**Data Sync:**

- `pnpm sync:daily` - Run all integrations
- Individual sync: `pnpm sync:github`, `pnpm sync:airtable`, etc.

## Architecture

**Frontend (`/src/app/`):**

- `routes/` - TanStack Router file-based routing
- `components/` - Reusable components (aliased as `@/components`)
- `lib/` - Utility functions (aliased as `@/lib`), server-only in `@/lib/server`

**Backend (`/src/server/`):**

- `api/` - tRPC API routes and routers
- `db/` - Drizzle database schema and migrations (aliased as `@/db`)
- `integrations/` - External API integrations and sync scripts

**Database:**

- Core entities: `records` (content), `links` (relationships), `predicates` (relationship types)
- Integration-specific tables for external data sources
- Vector embeddings for semantic search
- PostgreSQL with Drizzle ORM

## Component Development Rules

**Organization:**

- Reusable components: `src/app/components/` with kebab-case naming
- Shadcn UI components: `src/app/components/ui/` (DO NOT modify without explicit instructions)
- Page-specific components: `-components/` directory or `-component.tsx` suffix

**Structure Requirements:**

- Semantic HTML elements for layout and structure
- Tailwind CSS v4 syntax for styling
- Shadcn UI for interactive elements and complex components
- Lucide icons with `Icon` suffix (e.g., `HomeIcon` not `Home`)

**TypeScript Requirements:**

- NEVER use `any` keyword or `unknown` types (rare exceptions only)
- NEVER use `as` for type casting - must be fully type safe
- Import and reuse existing types from schemas and database types
- All components must be fully typed

**Form Handling:**

- Use TanStack Forms for form management
- Implement Zod schemas for validation
- Integrate with tRPC for API communication

## Database and API Rules

**Database Operations:**

- Use Drizzle ORM exclusively
- Prefer relational queries: `db.query.<table>` over `db.select().from(<table>)`
- Use proper mutation methods: `db.insert()`, `db.update()`, `db.delete()`
- Always handle conflicts gracefully on insertions

**API Development:**

- Create tRPC routers in `src/server/api/routers/`
- Use Zod v4 for input validation (check latest v4 docs)
- Implement proper error handling and HTTP status codes
- Follow RESTful principles for endpoint design

**Data Fetching:**

- Use tRPC client and hooks from `src/app/trpc.ts`
- Implement proper loading states and error handling
- Use proper caching strategies
- Invalidate queries after mutations

## Critical Development Rules

**Type Safety:**

- End-to-end TypeScript with _no type assertions_. This is a hard rule. Never use `any`, never use `as` for type casting, never disable type checking, and never use `@ts-ignore` or `@ts-expect-error`.
- Use Zod v4 for runtime validation
- Use database types from Drizzle schema

**Performance:**

- React Compiler is enabled - avoid manual memoization
- Implement proper error boundaries
- Consider code splitting for larger components
- Use efficient query patterns and proper indexing

**Before Every Commit:**

- Run `pnpm lint` AND `pnpm tsc`
- Check .cursor/rules for any updated guidelines
- Update rules if refactoring makes them outdated

## Import Aliases

- `@/` - src directory
- `@server/` - server code
- `@/components` - frontend components
- `@/lib` - utility functions
- `@/db` - database schema
