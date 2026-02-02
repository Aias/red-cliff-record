# AGENTS.md

This file provides guidance to AI coding assistants when working with code in this repository.

**IMPORTANT**: This file is the single source of truth for development guidelines and architectural patterns. When making significant refactoring or architectural changes, update this file to reflect the new patterns and keep it current.

> Contributor note: For project overview and scripts, see `README.md` and `INTEGRATIONS.md`.

> Agent file conventions: `AGENTS.md` is the source of truth for agent instructions. Other agent instruction files (e.g., `CLAUDE.md`) should be symlinked to this file rather than maintained separately. Create symlinks with `ln -s AGENTS.md CLAUDE.md` and commit the symlink to the repository.

## Project Overview

Red Cliff Record is a personal knowledge repository that aggregates data from multiple external sources (GitHub, Airtable, Raindrop, Readwise, Twitter, Adobe, Feedbin, Chromium-based Browser History) into a searchable, relational database. It's built with React 19, TanStack Router, tRPC, Drizzle ORM, and PostgreSQL, deployed on Bun server.

## Working Principles

Our primary goal, above all else, is to write higher quality code, more efficiently, and to continually improve the working relationship between the user and the agent. This means that if we run into a situation where the user's expectations or assumptions conflict with the agent's, we should pause and clarify the situation before proceeding with the task.

At any point during a working session, the agent can pause and ask the user for clarification if needed.

This document is a living document. We should be continually updating it to reflect a current shared understanding of working patterns and standards. The user or the agent may propose changes to this document at any time.

**If the user asks a question, never respond by writing code.** A question should be answered by researching the answer and providing analysis with examples and references where appropriate. This applies to any sentence that ends with a question mark, or when the sentence is clearly framed as a question.

Use all tools at your disposal to diagnose and resolve issues. This includes but is not limited to:

- Reading official documentation
- Reading the source code, either on github or locally inside `node_modules`
- Searching the web for information
- Running local tests and commands that are non-destructive and do not modify data or the database
- Adding temporary logging and debugging statements to the codebase

## Essential Commands

**Development:**

- `bun check` - **Run this early and often during development.** Runs linting (oxlint), type-checking (tsgo), and formatting (oxfmt) in one command. Extremely fast (~1s total).

**IMPORTANT: Run `bun check` frequently throughout development, not just at the end.** Since all checks complete in ~1 second, you should run `bun check` after making any non-trivial changes. This catches issues immediately rather than accumulating technical debt. The checks are so fast and easy that there's no excuse not to run them every time.

Never attempt to start the development server or build the application. The user will run these commands manually.

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

**CLI (`rcr`):**

- Install: `bun link` (from repo root) - this makes `rcr` available globally
- Always use `rcr` directly (not `bun ./src/server/cli/rcr/index.ts`)
- Run `rcr --help` for full command reference
- JSON output to stdout, errors to stderr with non-zero exit codes
- Use `--raw` for unwrapped output, `--debug` to preview without writing

**Data Operations:**

- **IMPORTANT**: Never run any operations that modify data or could have destructive effects (including creating new data, schemas, or running database migrations) without first prompting the user for permission
- Always use the corresponding package manager command for executing packages: `bunx` for Bun, `pnpm dlx` for pnpm, `yarn dlx` for Yarn, `npx` only for npm. Never use `npx` unless the package manager is npm.

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

**Structure Requirements:**

- Semantic HTML elements for layout and structure
- Always use appropriate semantic HTML elements where relevant (e.g., `<em>` for emphasis/italics, `<strong>` for bold/importance, `<cite>` for citations, `<time>` for dates, etc.) instead of generic elements like `<span>` with styling classes
- Prefer semantic HTML over non-semantic `<div>`, `<span>`, etc. Prefer built-in HTML elements over aria attributes for accessibility
- Tailwind CSS v4 syntax using `c-*` design tokens from `src/app/styles/theme.css`
- Build interactive elements with Radix primitives and existing Shadcn-based components
- Always import Radix primitives from the `radix-ui` package (e.g., `import { HoverCard as HoverCardPrimitive } from 'radix-ui'`), not from individual subpackages like `@radix-ui/react-hover-card`
- **Component composition with `asChild`**: When an element needs styling from an existing component (e.g., a dropdown trigger that should look like a Button), use the `asChild` prop to compose rather than duplicating inline styles. Example: `<Button variant="outline" asChild><DropdownMenuTrigger>...</DropdownMenuTrigger></Button>`
- Never use legacy Shadcn theme variables (`bg-background`, `text-foreground`, etc.)
- Mark key DOM nodes with `data-slot` attributes for styling hooks
- Lucide icons with `Icon` suffix (e.g., `HomeIcon` not `Home`)
- Use `<Spinner />` component from `@/components/spinner` for loading states, either in place of or in addition to text (e.g., "Loading...", "loading", etc.)

**CSS & Styling:**

- Use flexbox and grid for layout that reflects the natural flow of the content
- Prefer gap properties for spacing between elements, and padding on container elements
- Avoid margin unless there's a specific reason to use it, as it makes components less composable/portable
- Prefer logical properties `block`/`inline`, `start`/`end` over `left`, `right`, `top`, and `bottom`
- When writing transforms, use `translate`, `rotate`, `scale`, and other transform sub-properties directly rather than putting them all in a `transform` property
- Across all code, prefer semantic HTML first, then a CSS-only implementation for behavior HTML cannot express, then TypeScript for behavior CSS cannot express, and only add or rely on external dependencies when absolutely necessary or when they are already in the project
- Theme colors follow a semantic naming pattern: `c-main` for primary actions, `c-main-contrast` for text on `c-main` backgrounds. Similar patterns exist for `c-destructive`/`c-destructive-contrast`. Never invent color token names—check `src/app/styles/app.css` for available tokens
- **Detecting invalid Tailwind classes**: Oxfmt sorts invalid/unknown classes to the front of the class list. If classes appear out of order after running `bun check`, they're likely misspelled or don't exist in the theme

**TypeScript Requirements:**

- NEVER use `any` keyword or `unknown` types
- NEVER use `as` for type casting - must be fully type safe
- End-to-end TypeScript with _no type assertions_. This is a hard rule. Never use `any`, never use `as` for type casting, never disable type checking, and never use `@ts-ignore` or `@ts-expect-error`
- Import and reuse existing types from schemas and database types
- All components must be fully typed

**Form Handling:**

- Use TanStack Forms for form management
- Implement Zod schemas for validation
- Integrate with tRPC for API communication

**React-Specific Rules:**

- Avoid `useEffect`; read (via `curl`) [You Might Not Need an Effect](https://raw.githubusercontent.com/reactjs/react.dev/main/src/content/learn/you-might-not-need-an-effect.md) before adding one. Attempt to remove existing `useEffect`s where possible.
- We use React 19 and therefore don't need to use `forwardRef` – refs are automatically forwarded
- Avoid `setTimeout` for timing operations in React components. Prefer `useLayoutEffect` for synchronous DOM updates that must happen before paint, and `requestAnimationFrame` (or double `requestAnimationFrame`) for coordinating with the browser's rendering cycle. These patterns are more idiomatic, robust, and aligned with React's rendering lifecycle than arbitrary timeouts

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
- Implement proper error handling and HTTP status codes
- Follow RESTful principles for endpoint design

**Data Fetching:**

- Use tRPC client and hooks from `src/app/trpc.ts`
- Implement proper loading states and error handling
- Use proper caching strategies
- Invalidate queries after mutations

## Critical Development Rules

**Type Safety:**

- End-to-end TypeScript with _no type assertions_. This is a hard rule. Never use `any`, never use `as` for type casting, never disable type checking, and never use `@ts-ignore` or `@ts-expect-error`
- Use Zod v4 for runtime validation
- Use database types from Drizzle schema

**Performance:**

- Implement proper memoization where needed
- Implement proper error boundaries
- Consider code splitting for larger components
- Use efficient query patterns and proper indexing

**Code Quality:**

- When naming variables, functions, components, etc., favor readability and clarity over brevity or cleverness
- Add comments only when necessary to explain complex code or logic, don't add comments which simply state what the code is doing
- Always aim for idiomatic usage of language features, libraries, tools, and frameworks

**Before Finalizing Changes:**

- Run `bun check` early and often throughout development—after any meaningful code change, not just at the end
- The command is extremely fast (~1s for linting, type-checking, and formatting combined) so run it liberally
- Prior to committing, re-read this document to ensure all instructions are followed and to refresh your memory of the project's guidelines and conventions
- Update this file if refactoring changes architectural patterns or introduces new conventions

**Git & Repository State:**

- Never run `git commit`, `git add`/`git stage`, `git push`, `git reset`, or similar commands without explicit user permission. The user will manually manage all git operations unless otherwise specified
- Prefer proposing diffs via patch files or documented changes; avoid modifying VCS state
- Make smart use of git during development to review changes and understand the history of the codebase
- For larger sets of changes or refactors done independently by the agent, create a new branch and make atomic commits to it as interim checkpoints with descriptive commit messages. The user can review the changes and provide feedback before merging back to the active branch
- Never push new branches or new commits to the remote repository unless explicitly instructed to do so by the user. The agent can make commits to their own working branches but should not commit them to the user's current active branch
- When resolving merge conflicts during a merge or rebase: Never finalize the merge or rebase until the user has reviewed the changes and provided feedback. Report the status after resolving conflicts and ask the user for final approval. Never make functional changes that don't come from either the source branch or target branch
- You have access to the Github CLI, which can be used to review PRs and comments, create new PRs and issues, and other Github actions

## Import Aliases

- `@/` - src directory
- `@/shared/` - universal utilities that work in both client and server environments
- `@/server/` - server code (includes `@/server/lib/` for server utilities)
- `@/components` - frontend components
- `@/lib` - client-side utility functions
- `@hozo` - database schema, relations, and validation (workspace package)

**Import Rules:**

- When adding or updating imports for a file, ensure they're sorted in alphabetical order within the following categories: Language and platform (e.g. node), framework (e.g. react), external libraries, internal libraries, aliased project imports, relative imports, and local imports. Import order specified by the project's oxlint config takes precedence over this rule
- When importing types, add the `type` keyword to the import statement even if it's not required by linting rules
- ✅ Shared code can be imported by both client and server
- ✅ Server code can import from shared and other server modules
- ✅ Client code can import from shared and other client modules
- ❌ NEVER import server code from client code
- ❌ NEVER import client code from server code
- ❌ NEVER create backward compatibility files during refactoring - update all imports directly

## Code Organization Rules

**Three-Tier Utility Organization:**

1. **Shared utilities** (`src/shared/lib/`): Universal code that works in both client and server environments
   - Text processing, data transformations, pure functions
   - Examples: `toTitleCase`, `emptyStringToNull`, `mergeRecords`
2. **Client utilities** (`src/app/lib/`): Browser-only code (React hooks, client APIs)
   - Examples: React hooks, browser storage, client-side validation
3. **Server utilities** (`src/server/lib/`): Server-only code (Node.js, databases, file systems)
   - Examples: R2 uploads, image processing, server-side validation

**Refactoring Rules:**

- When moving or splitting files, update ALL imports immediately - no re-export files for backward compatibility
- When removing deprecated exports, find and update all consumers first
- Always prefer direct imports from the correct location over convenience re-exports
- During large refactors, complete the entire migration in one go rather than leaving transitional files

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
