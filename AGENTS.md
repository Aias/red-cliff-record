# AGENTS.md

This file provides project-specific guidance for AI coding assistants working in this repository. It supplements the global `~/Code/dotfiles/agents/AGENTS.md` (universal coding standards, type safety, communication style, permission guardrails, git workflows) and referenced skills (`typescript-guidelines`, `react-guidelines`, `frontend-html-css-guidelines`, `git-workflows`). Content here is unique to Red Cliff Record.

**IMPORTANT**: When making significant refactoring or architectural changes, update this file to reflect the new patterns and keep it current.

> For project overview and scripts, see `README.md` and `INTEGRATIONS.md`.

## Project Overview

Red Cliff Record is a personal knowledge repository that aggregates data from multiple external sources (GitHub, Airtable, Raindrop, Readwise, Twitter, Adobe, Feedbin, Chromium-based Browser History) into a searchable, relational database. It's built with React 19, TanStack Router, tRPC, Drizzle ORM, and PostgreSQL, deployed on Bun server.

## Essential Commands

**Development:**

- `bun check` - **Run this early and often during development.** Runs linting (oxlint), type-checking (tsgo), and formatting (oxfmt) in one command. Extremely fast (~1s total). Run after any non-trivial change.
- Never attempt to start the development server or build the application. The user will run these commands manually.

**CLI (`rcr`):**

The `rcr` CLI is the primary tool for agents to interact with the knowledge base. **Always use `rcr` instead of direct database queries or psql.**

- Install: `bun link` (from repo root) - makes `rcr` available globally
- Run `rcr --help` for the full command reference (always check this for available commands)
- JSON output to stdout, errors to stderr with non-zero exit codes
- Use `--raw` for unwrapped output (just data, no `{data, meta}` wrapper)
- Use `jq` to extract specific fields from JSON output

Key command groups:

- `rcr record <cmd>` - CRUD operations on records (get, list, create, update, delete, merge)
- `rcr record tree <id>` - Get record with parent/children hierarchy
- `rcr record children <id>` - Get just the children of a record
- `rcr record parent <id>` - Get just the parent of a record
- `rcr search <query>` - Semantic search across records
- `rcr links list <id> [--predicate=X] [--direction=incoming|outgoing]` - List/filter links
- `rcr links create/delete` - Manage links between records
- `rcr media <cmd>` - Manage media attachments
- `rcr sync <integration>` - Run integration syncs
- `rcr db <cmd>` - Database operations (backup, restore, status)

**Database:**

- `bun run db:migrate` - Run database migrations
- `bun run db:studio` - Open Drizzle Studio for database inspection
- `./src/server/db/db-manager.sh backup <dev|prod>` - Backup database
- `./src/server/db/db-manager.sh restore <dev|prod>` - Restore database
- `./src/server/db/db-manager.sh -c restore dev` - Clean restore (drop & recreate database with extensions)
- `./src/server/db/db-manager.sh --dry-run restore dev` - Print restore commands without executing
- `./src/server/db/db-manager.sh seed dev` - Seed database with initial data (predicates and core records)
- `./src/server/db/db-manager.sh clone-prod-to-dev` - Clone production to development
- **Direct queries**: `source .env && psql "$DATABASE_URL_DEV" -c "SELECT ..."` (never echo/log the connection string)
- **Database Reset / Migration Squash**: To reset migration history while preserving data:
  1. `./src/server/db/db-manager.sh -D backup dev` (Backup data only)
  2. `./src/server/db/db-manager.sh reset dev` (Drop & recreate DB with extensions)
  3. Delete old migrations: `rm -rf migrations/main/*`
  4. `bun run db:generate` (Create fresh migration)
  5. `bun run db:migrate` (Apply fresh schema)
  6. `./src/server/db/db-manager.sh seed dev` (Seed initial data)
  7. `./src/server/db/db-manager.sh -D restore dev` (Restore data into new schema)

**Data Operations:**

- **IMPORTANT**: Never run any operations that modify data or could have destructive effects (including creating new data, schemas, or running database migrations) without first prompting the user for permission
- Always use the corresponding package manager command for executing packages: `bunx` for Bun, `pnpm dlx` for pnpm, `yarn dlx` for Yarn, `npx` only for npm

## Architecture (Pointers)

- High-level overview and directory map: see `README.md`.
- Frontend: `src/app/**` (routes, components, client libs). Import aliases defined in `tsconfig.json`.
- Backend: `src/server/**` (tRPC routers, libs, db, integrations).
- Shared: `src/shared/**` (cross-environment libs and types).
- Packages: `packages/hozo` contains the database schema, relations, and validation logic (imported as `@hozo`).
- Keep client/server boundaries: client must not import server code; server may import shared.
- Theme tokens: `src/app/styles/theme.css` holds the `c-*` color variables used across components.

## Component Development Rules

**Organization:**

- Reusable components: `src/app/components/` with kebab-case naming (includes all Shadcn-derived primitives)
- Do not create a separate `ui` directory—every reusable component lives directly under `src/app/components`
- Page-specific components: `-components/` directory or `-component.tsx` suffix

**Structure & Styling (project-specific):**

- Tailwind CSS v4 syntax using `c-*` design tokens from `src/app/styles/theme.css`
- Build interactive elements with Radix primitives and existing Shadcn-based components
- Always import Radix primitives from the `radix-ui` package (e.g., `import { HoverCard as HoverCardPrimitive } from 'radix-ui'`), not from individual subpackages like `@radix-ui/react-hover-card`
- **Component composition with `asChild`**: When an element needs styling from an existing component (e.g., a dropdown trigger that should look like a Button), use the `asChild` prop to compose rather than duplicating inline styles
- Never use legacy Shadcn theme variables (`bg-background`, `text-foreground`, etc.)
- Mark key DOM nodes with `data-slot` attributes for styling hooks
- Lucide icons with `Icon` suffix (e.g., `HomeIcon` not `Home`)
- Use `<Spinner />` component from `@/components/spinner` for loading states
- Theme colors follow a semantic naming pattern: `c-main` for primary actions, `c-main-contrast` for text on `c-main` backgrounds. Similar patterns exist for `c-destructive`/`c-destructive-contrast`. Never invent color token names—check `src/app/styles/app.css` for available tokens
- **Detecting invalid Tailwind classes**: Oxfmt sorts invalid/unknown classes to the front of the class list. If classes appear out of order after running `bun check`, they're likely misspelled or don't exist in the theme

**TypeScript (project-specific):**

- NEVER use `unknown` types
- Import and reuse existing types from schemas and database types
- All components must be fully typed

**React-Specific Rules:**

- Avoid `useEffect`; read (via `curl`) [You Might Not Need an Effect](https://raw.githubusercontent.com/reactjs/react.dev/main/src/content/learn/you-might-not-need-an-effect.md) before adding one. Attempt to remove existing `useEffect`s where possible.
- We use React 19 and therefore don't need to use `forwardRef` – refs are automatically forwarded
- Avoid `setTimeout` for timing operations in React components. Prefer `useLayoutEffect` for synchronous DOM updates that must happen before paint, and `requestAnimationFrame` for coordinating with the browser's rendering cycle
- Use TanStack Forms + Zod schemas for form management and validation

## Database and API Rules

**Database Operations:**

- Use Drizzle ORM exclusively
- **Always use Drizzle v2 query syntax** (`db.query.<table>.findMany/findFirst`) for reads instead of `db.select().from(<table>)`. The query API provides cleaner object-style `where` clauses, built-in relation loading via `with`, and `columns` selection
- Avoid raw SQL - use Drizzle's query builder APIs instead of `sql` template literals
- Use proper mutation methods: `db.insert()`, `db.update()`, `db.delete()`
- Always handle conflicts gracefully on insertions with `.onConflictDoUpdate()`
- When defining primary keys for integration tables, use `integer('id').primaryKey()` instead of `serial('id').primaryKey()` when the ID comes from an external source

**API Development:**

- Create tRPC routers in `src/server/api/routers/`
- Use Zod v4 for input validation (check latest v4 docs)
- Use tRPC client and hooks from `src/app/trpc.ts` for data fetching
- Invalidate queries after mutations

## Import Aliases

- `@/` - src directory
- `@/shared/` - universal utilities that work in both client and server environments
- `@/server/` - server code (includes `@/server/lib/` for server utilities)
- `@/components` - frontend components
- `@/lib` - client-side utility functions
- `@hozo` - database schema, relations, and validation (workspace package)

**Import Rules:**

- Import order specified by the project's oxlint config takes precedence; within that: language/platform, framework, external, internal, aliased, relative, local
- When importing types, add the `type` keyword to the import statement

**Boundary enforcement:**

- ✅ Shared code can be imported by both client and server
- ✅ Server code can import from shared and other server modules
- ✅ Client code can import from shared and other client modules
- ❌ NEVER import server code from client code
- ❌ NEVER import client code from server code

## Code Organization Rules

**Three-Tier Utility Organization:**

1. **Shared utilities** (`src/shared/lib/`): Universal code that works in both client and server environments
   - Text processing, data transformations, pure functions
   - Examples: `toTitleCase`, `emptyStringToNull`, `mergeRecords`
2. **Client utilities** (`src/app/lib/`): Browser-only code (React hooks, client APIs)
   - Examples: React hooks, browser storage, client-side validation
3. **Server utilities** (`src/server/lib/`): Server-only code (Node.js, databases, file systems)
   - Examples: R2 uploads, image processing, server-side validation

**Formatting & Indentation:**

- Governed by Oxfmt (`.oxfmtrc.json`): spaces for indentation (width 2). Formatting is included in `bun check`.

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
- Keep sync logic pure and wrapped by `runIntegration`; the `rcr sync <name>` CLI exposes these to the command line.
- Use Zod v4 schemas in `types.ts`, a focused API client in `client.ts`, and `sync.ts` for orchestration.
- Respect rate limits; batch where needed; upsert with `.onConflictDoUpdate()` for idempotency.
- Ask before any destructive or data-modifying operation.

## Database Management (Pointers)

- Canonical operations live in `scripts/deploy/README.md` and `src/server/db/db-manager.sh`.
- Use `bun run db:*` scripts for migrations and studio.
- Never run destructive operations or migrations without explicit user permission.
- Never edit Drizzle meta files (`snapshot.json`, `_journal.json`) directly—they are generated by `drizzle-kit`.

## Agent Workflows

### Media Alt Text Updates

The `rcr media` commands support CLI-based alt text updates for images. Workflow for looped agents:

1. **List images needing alt text** (ordered by most recent):

   ```bash
   rcr media list --type=image --alt-text=false --limit=100 --order=recordCreatedAt
   ```

2. **Get media item with parent record context**:

   ```bash
   rcr media get <id> --with-record
   ```

   Returns media item plus `record: { id, title, type, mediaCaption, url }` for context.

3. **Update alt text**:

   ```bash
   rcr media update <id> '{"altText": "Description of the image"}'
   ```

**Parallel processing**: To avoid overlap when running multiple agents, pre-assign media IDs to each agent. Parent agent fetches a batch (e.g., 100 IDs), splits into chunks, and each subagent processes only its assigned IDs.

**Schema**: The `media` table includes `altText` (nullable text), `url`, `type`, `width`, `height`, and `recordId` (FK to parent record).

**Stats**: ~4,090 images total, accessible via `rcr media list --type=image`.
