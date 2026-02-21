# AGENTS.md

Project overview, CLI reference, and setup: `README.md`. Integration guide: `INTEGRATIONS.md`.

## Essential Commands

- `bun check` — linting + type-checking + formatting in ~1s. **Run after every non-trivial change.**
- Never start the dev server or build; the user runs those manually.
- `bunx` for package execution.

## Release Checklist

- Bump `version` in `package.json` before opening PRs.

## `rcr` CLI

Primary agent interface to the knowledge base. **Prefer `rcr` for working with application data** (records, links, media, syncs). Run `rcr --help` for the full command reference; see the `rcr` skill for workflows.

**Development/debugging: Use psql directly**
For schema inspection, migration verification, and database structure work:

```bash
source .env  # Load DATABASE_URL, DATABASE_URL_DEV, etc.
psql $DATABASE_URL -c "\dt table_name"
psql $DATABASE_URL_DEV -c "\dt table_name"
```

## Database Migrations

**CRITICAL: Never run migrations.** The agent must never execute migration commands (`bun run db:migrate`, `bunx drizzle-kit migrate`, or any equivalent), even against dev. Always provide the commands for the user to run and verify.

**Production migrations run automatically** as part of the deploy pipeline when a PR is merged to main. Never run migrations against prod in a development context.

**Migration workflow:**

1. Schema changes → `bun run db:generate` generates migration files only (safe for agent to run)
2. **User applies to dev** → `NODE_ENV=development bunx drizzle-kit migrate`
3. **User verifies** → Query dev database to confirm schema is correct
4. PR merged → deploy script auto-runs migration against prod

**OR** keep dev synced with prod: `rcr db clone-prod-to-dev --yes`

## Architecture

| Alias          | Path                  | Role                             |
| -------------- | --------------------- | -------------------------------- |
| `@/`           | `src/`                | Root                             |
| `@/components` | `src/app/components/` | Reusable UI                      |
| `@/lib`        | `src/app/lib/`        | Client utilities                 |
| `@/shared/`    | `src/shared/`         | Cross-environment code           |
| `@/server/`    | `src/server/`         | Backend (tRPC, DB, integrations) |
| `@hozo`        | `packages/hozo/`      | DB schema, relations, validation |

**Boundary rule:** client never imports server; server never imports client; both may import shared.

Theme tokens: `src/app/styles/theme.css` (`c-*` color variables). Check `src/app/styles/app.css` for the full token list.

## Gotchas

- **React Compiler is enabled** (`babel-plugin-react-compiler`). Don't add manual `useMemo`/`useCallback` for optimization — the compiler handles it.
- **tRPC toast link auto-handles errors.** Don't add `toast.error()` in mutation `onError` — it's already wired up globally in the tRPC client.

## Skills Index

| Skill                          | Trigger                                                       |
| ------------------------------ | ------------------------------------------------------------- |
| `.agents/skills/rcr-frontend/` | Component work, styling, design tokens, Radix/Shadcn          |
| `.agents/skills/rcr-backend/`  | Drizzle, tRPC, integrations, DB management, alt-text workflow |
| `rcr` (global)                 | CLI operations on records, links, media, syncs                |
