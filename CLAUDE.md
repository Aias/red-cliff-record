# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT**: This file is the single source of truth for development guidelines and architectural patterns. When making significant refactoring or architectural changes, update this file to reflect the new patterns and keep it current.

> Contributor note: For project overview and scripts, see `README.md` and `INTEGRATIONS.md`.

## Project Overview

Red Cliff Record is a personal knowledge repository that aggregates data from multiple external sources (GitHub, Airtable, Raindrop, Readwise, Twitter, Adobe, Feedbin, Chromium-based Browser History) into a searchable, relational database. It's built with React 19, TanStack Router, tRPC, Drizzle ORM, and PostgreSQL, deployed on Bun server.

## Essential Commands

**Development:**

- `bun run lint` - Run at the end of a work session before finalizing changes
- `bun run tsc` - Run only when TypeScript/types may be affected (TS code, schemas, build config)

Never attempt to start the development server or build the application. The user will run these commands manually.

**Database:**

- `bun run db:migrate` - Run database migrations
- `bun run db:studio` - Open Drizzle Studio for database inspection
- `bun run db:backup-local` - Backup local database
- `bun run db:backup-remote` - Backup remote database
- `bun run db:restore-local` - Restore to local database
- `bun run db:restore-remote` - Restore to remote database
- `./src/server/db/db-manager.sh -c restore local` - Clean restore (drop & recreate database with extensions)

**Data Sync:**

- `bun run sync:daily` - Run all integrations
- Individual sync: `bun run sync:github`, `bun run sync:airtable`, `bun run sync:raindrop`, `bun run sync:readwise`, `bun run sync:feedbin`, `bun run sync:browsing`

**Data Operations:**

- **IMPORTANT**: Never run any operations that modify data or could have destructive effects (including creating new data, schemas, or running database migrations) without first prompting the user for permission

## Architecture (Pointers)

- High-level overview and directory map: see `README.md`.
- Frontend: `src/app/**` (routes, components, client libs). Import aliases in `eslint.config.js` and tsconfig.
- Backend: `src/server/**` (tRPC routers, libs, db, integrations). DB schema under `src/server/db/**`.
- Shared: `src/shared/**` (cross-environment libs and types).
- Keep client/server boundaries: client must not import server code; server may import shared.

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

- NEVER use `any` keyword or `unknown` types
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
- Avoid raw SQL - use Drizzle's query builder APIs instead of `sql` template literals
- Use proper mutation methods: `db.insert()`, `db.update()`, `db.delete()`
- Always handle conflicts gracefully on insertions with `.onConflictDoUpdate()`
- When defining primary keys for integration tables, use `integer('id').primaryKey()` instead of `serial('id').primaryKey()` when the ID comes from an external source

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

- Implement proper memoization where needed
- Implement proper error boundaries
- Consider code splitting for larger components
- Use efficient query patterns and proper indexing

**Before Finalizing Changes:**

- Run `bun run lint`.
- Run `bun run tsc` only if your changes can impact types (TypeScript sources, Zod schemas, DB schema/types, build/tsconfig).
- Update CLAUDE.md if refactoring changes architectural patterns or introduces new conventions.

**Git & Repository State:**

- Never run `git commit`, `git add`/`git stage`, `git push`, `git reset`, or similar commands without explicit user permission. The user will manually manage all git operations unless otherwise specified.
- Prefer proposing diffs via patch files or documented changes; avoid modifying VCS state.

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
- ❌ NEVER create backward compatibility files during refactoring - update all imports directly

**Refactoring Rules:**

- When moving or splitting files, update ALL imports immediately - no re-export files for backward compatibility
- When removing deprecated exports, find and update all consumers first
- Always prefer direct imports from the correct location over convenience re-exports
- During large refactors, complete the entire migration in one go rather than leaving transitional files

**Formatting & Indentation:**

- Governed by Prettier (`.prettierrc`): tabs for indentation (width 2). Run `bun run lint` at the end of a session.

**Media & File Handling:**

- All media operations use `@/server/lib/media` (R2 uploads, metadata extraction)
- Image processing uses `@/server/lib/image-metadata` (pure binary parsing)
- URL validation uses `@/server/lib/url-utils` (server-side validation)

**React Hooks Organization:**

- Large hook files are split into focused modules
- Import from specific modules: `@/lib/hooks/record-queries`, `@/lib/hooks/record-mutations`, etc.
- Main `use-records.ts` re-exports all hooks for backward compatibility

## Integration Development Guidelines (Pointers)

- Canonical guidance and examples live in `INTEGRATIONS.md`.
- Keep sync logic pure and wrapped by `runIntegration`; expose a small CLI entry in `src/server/cli/`.
- Use Zod v4 schemas in `types.ts`, a focused API client in `client.ts`, and `sync.ts` for orchestration.
- Respect rate limits; batch where needed; upsert with `.onConflictDoUpdate()` for idempotency.
- Ask before any destructive or data-modifying operation.

## Database Management (Pointers)

- Canonical operations live in `scripts/deploy/README.md` and `src/server/db/db-manager.sh`.
- Use `bun run db:*` scripts for migrations and studio.
- Never run destructive operations or migrations without explicit user permission.
