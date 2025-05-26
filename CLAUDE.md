# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT**: This project uses both `CLAUDE.md` and `.cursor/rules/` files for development guidelines. When making significant refactoring or architectural changes, both files must be updated to stay in sync. Always check and update both locations to ensure consistency.

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
- `lib/` - Client-side utility functions (aliased as `@/lib`)
  - `hooks/` - React hooks split into focused modules (record-queries, record-mutations, media-mutations, link-mutations)

**Backend (`/src/server/`):**

- `api/` - tRPC API routes and routers
- `db/` - Drizzle database schema and migrations (aliased as `@/db`)
- `lib/` - Server-only utilities (aliased as `@/server/lib`)
  - `media.ts` - Complete media handling (R2 uploads, metadata extraction, MIME detection)
  - `image-metadata.ts` - Pure image format parsing utility
  - `url-utils.ts` - Server-side URL validation and formatting
- `integrations/` - External API integrations and sync scripts

**Shared (`/src/shared/`):**

- `lib/` - Universal utilities (aliased as `@/shared/lib`) - work in both client and server environments
  - `formatting.ts` - Text formatting and Zod transformers (`toTitleCase`, `emptyStringToNull`)
  - `embedding.ts` - Text processing for embeddings (`getRecordTitle`, `createRecordEmbeddingText`)
  - `merge-records.ts` - Record merging logic (`mergeRecords`, `mergeTextFields`)

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
- Use `<Spinner />` component from `@/components/spinner` for loading states, either in place of or in addition to text (e.g., "Loading...", "loading", etc.)

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
- `@/shared/` - universal utilities that work in both client and server environments
- `@/server/` - server code (includes `@/server/lib/` for server utilities)
- `@/components` - frontend components
- `@/lib` - client-side utility functions
- `@/db` - database schema

## Code Organization Rules

**Three-Tier Utility Organization:**

1. **Shared utilities** (`src/shared/lib/`): Universal code that works in both client and server environments
   - Text processing, data transformations, pure functions
   - Examples: `toTitleCase`, `emptyStringToNull`, `mergeRecords`
2. **Client utilities** (`src/app/lib/`): Browser-only code (React hooks, client APIs)
   - Examples: React hooks, browser storage, client-side validation
3. **Server utilities** (`src/server/lib/`): Server-only code (Node.js, databases, file systems)
   - Examples: R2 uploads, image processing, server-side validation

**Import Rules:**

- ✅ Shared code can be imported by both client and server
- ✅ Server code can import from shared and other server modules
- ✅ Client code can import from shared and other client modules
- ❌ NEVER import server code from client code
- ❌ NEVER import client code from server code

**Media & File Handling:**

- All media operations use `@/server/lib/media` (R2 uploads, metadata extraction)
- Image processing uses `@/server/lib/image-metadata` (pure binary parsing)
- URL validation uses `@/server/lib/url-utils` (server-side validation)

**React Hooks Organization:**

- Large hook files are split into focused modules
- Import from specific modules: `@/lib/hooks/record-queries`, `@/lib/hooks/record-mutations`, etc.
- Main `use-records.ts` re-exports all hooks for backward compatibility
