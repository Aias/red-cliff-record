# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT**: This file is the single source of truth for development guidelines and architectural patterns. When making significant refactoring or architectural changes, update this file to reflect the new patterns and keep it current.

## Project Overview

Red Cliff Record is a personal knowledge repository that aggregates data from multiple external sources (GitHub, Airtable, Raindrop, Readwise, Twitter, Adobe, Feedbin, Chromium-based Browser History) into a searchable, relational database. It's built with React 19, TanStack Router, tRPC, Drizzle ORM, and PostgreSQL, deployed on Cloudflare Pages.

## Essential Commands

**Development:**

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm lint` - Format, lint, and type check (REQUIRED before commits)
- `pnpm tsc` - Type check only (REQUIRED before commits)

**Database:**

- `pnpm db:migrate` - Run database migrations
- `pnpm db:studio` - Open Drizzle Studio for database inspection
- `pnpm db:backup-local` - Backup local database
- `pnpm db:backup-remote` - Backup remote database
- `pnpm db:restore-local` - Restore to local database
- `pnpm db:restore-remote` - Restore to remote database
- `./src/server/db/db-manager.sh -c restore local` - Clean restore (drop & recreate database with extensions)

**Data Sync:**

- `pnpm sync:daily` - Run all integrations
- Individual sync: `pnpm sync:github`, `pnpm sync:airtable`, `pnpm sync:raindrop`, `pnpm sync:readwise`, `pnpm sync:feedbin`, `pnpm sync:browsing`
- **IMPORTANT**: Never run any sync scripts without checking with the user first

**Data Operations:**

- **IMPORTANT**: Never run any operations that modify data or could have destructive effects (including creating new data, schemas, or running database migrations) without first prompting the user for permission

## Architecture

**Frontend (`/src/app/`):**

- `routes/` - TanStack Router file-based routing
- `components/` - Reusable components (aliased as `@/components`)
- `lib/` - Client-side utility functions (aliased as `@/lib`)
  - `hooks/` - React hooks split into focused modules:
    - `record-queries.ts` - Read operations (useRecord, useRecordList, useRecordTree)
    - `record-mutations.ts` - CRUD operations (useUpsertRecord, useDeleteRecords, useMergeRecords)
    - `media-mutations.ts` - Media operations (useCreateMedia, useDeleteMedia)
    - `link-mutations.ts` - Link operations (useUpsertLink, useDeleteLinks)

**Backend (`/src/server/`):**

- `api/` - tRPC API routes and routers
- `db/` - Drizzle database schema and migrations (aliased as `@/db`)
- `lib/` - Server-only utilities (aliased as `@/server/lib`)
  - `media.ts` - Complete media handling (R2 uploads, metadata extraction, MIME detection)
  - `image-metadata.ts` - Pure image format parsing utility
  - `url-utils.ts` - Server-side URL validation and formatting
  - `constants.ts` - Server-specific constants (SIMILARITY_THRESHOLD, similarity function)
- `integrations/` - External API integrations and sync scripts

**Shared (`/src/shared/`):**

- `lib/` - Universal utilities (aliased as `@/shared/lib`) - work in both client and server environments
  - `formatting.ts` - Text formatting and Zod transformers (`toTitleCase`, `emptyStringToNull`)
  - `embedding.ts` - Text processing for embeddings (`getRecordTitle`, `createRecordEmbeddingText`)
  - `merge-records.ts` - Record merging logic (`mergeRecords`, `mergeTextFields`)
- `types/` - Universal types (aliased as `@/shared/types`) - shared between client and server
  - `database.ts` - Re-exports of database types that frontend needs (avoids direct database imports)
  - `api.ts` - API contract types and schemas (`ListRecordsInput`, `SearchRecordsInput`, `DbId`)
  - `domain.ts` - Core business object types (`RecordGet`, `FullRecord`, `RecordLinks`)
  - `media.ts` - Media-related types (`MediaMetadata`)
  - `index.ts` - Convenient re-export of all shared types

**Database:**

- Core entities: `records` (content), `links` (relationships), `predicates` (relationship types)
- Integration-specific tables for external data sources
- Vector embeddings for semantic search
- PostgreSQL with Drizzle ORM
- Extensions: `pg_trgm` and `vector` (installed in `extensions` schema)
- Search path must include `extensions` schema for vector operations

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

**Before Every Commit:**

- Run `pnpm lint` AND `pnpm tsc`
- Update CLAUDE.md if refactoring changes architectural patterns or introduces new conventions

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

**File Editing Guidelines:**

- This project uses **tabs for indentation** (not spaces)
- When doing exact string replacements with MultiEdit, always verify whitespace by reading the exact lines first
- Use `sed -n 'start,end p' filename` to see exact content with proper formatting
- For complex multi-line replacements, prefer smaller, targeted changes over large blocks
- When uncertain about whitespace, use the Bash tool with `grep -A/-B` to see context
- Test with TypeScript compilation (`pnpm tsc`) after file modifications

**Media & File Handling:**

- All media operations use `@/server/lib/media` (R2 uploads, metadata extraction)
- Image processing uses `@/server/lib/image-metadata` (pure binary parsing)
- URL validation uses `@/server/lib/url-utils` (server-side validation)

**React Hooks Organization:**

- Large hook files are split into focused modules
- Import from specific modules: `@/lib/hooks/record-queries`, `@/lib/hooks/record-mutations`, etc.
- Main `use-records.ts` re-exports all hooks for backward compatibility

## Integration Development Guidelines

**Creating New Integrations:**

1. **File Structure** - Each integration should have:
   - `types.ts` - Zod schemas (v4) for API responses and TypeScript types
   - `client.ts` - API client with authenticated requests
   - `sync.ts` - Main sync logic using `runIntegration` wrapper
   - `embedding.ts` - (if needed) Text generation for embeddings
   - `map.ts` - (if needed) Mapping logic from integration data to records

2. **Authentication:**
   - Use environment variables for credentials (e.g., `FEEDBIN_USERNAME`, `FEEDBIN_PASSWORD`)
   - Use `requireEnv` from `../common/env` to ensure variables exist

3. **Sync Patterns:**
   - Fetch only what's needed (use `since` parameters when available)
   - Use upsert patterns with `.onConflictDoUpdate()` for idempotent syncs
   - Track integration runs with proper status updates
   - Batch operations when possible (respect API rate limits)

4. **Embedding Generation:**
   - Use `createEmbedding` from `@/app/lib/server/create-embedding`
   - Respect OpenAI's token limits (8192 tokens ≈ 24000 characters)
   - Include relevant metadata (title, author, content, URL)
   - Strip HTML when appropriate for cleaner embeddings
   - For feeds/RSS: Generate embeddings asynchronously after initial sync

5. **Error Handling:**
   - Log errors with context using integration logger
   - Continue processing other items on individual failures
   - Return count of successfully processed items

6. **Differential Sync Patterns:**
   - For starred/bookmarked items: Fetch ID lists, diff with database, sync only changes
   - Example: Feedbin starred entries - compare API starred IDs with DB starred IDs
   - Benefits: Constant sync time regardless of total item count

7. **Multi-Step Integration Patterns:**
   - For integrations with multiple data sources, use orchestration pattern
   - Call `runIntegration` once at the top level for the entire sync
   - Example: Browser history sync-all runs both Arc and Dia under one integration run, Github sync handles sync for both starred repositories and commit history

## Database Management and Migration Guidelines

**Backup and Restore:**

1. **Database URLs:**
   - `DATABASE_URL_LOCAL` - Local PostgreSQL instance
   - `DATABASE_URL_REMOTE` - Production Neon database
   - `DATABASE_URL` - Active database connection (usually points to local or remote)

2. **Schema Divergence:**
   - Local and remote databases may have different schemas due to pending migrations
   - Use clean restore (`-c` flag) when schema conflicts occur during restore
   - Clean restore drops the entire database and recreates it with proper extensions

3. **Required PostgreSQL Extensions:**
   - `pg_trgm` - For text similarity search using trigrams
   - `vector` - For vector similarity search and embeddings
   - Both installed in `extensions` schema
   - Database search_path must include `extensions` for vector operators to work

4. **Common Issues and Solutions:**
   - **Foreign key violations during restore**: Use clean restore to drop and recreate database
   - **Vector operator not found errors**: Run `ALTER DATABASE dbname SET search_path TO public, extensions;`
   - **Migration history too complex**: Use backup/restore instead of running all migrations

5. **Best Practices:**
   - Always backup before major database operations
   - Check schema compatibility before restoring between environments
   - Use `db-manager.sh` script for consistent backup/restore operations
   - Never run destructive database operations without user permission
