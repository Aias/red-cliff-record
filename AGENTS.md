# AGENTS.md

Project overview, CLI reference, and setup: `README.md`. Integration guide: `INTEGRATIONS.md`.

## Essential Commands

- `bun check` — linting + type-checking + formatting in ~1s. **Run after every non-trivial change.**
- Never start the dev server or build; the user runs those manually.
- `bunx` for package execution.

## `rcr` CLI

Primary agent interface to the knowledge base. **Prefer `rcr` instead of direct DB queries or psql.** Run `rcr --help` for the full command reference; see the `rcr` skill for workflows.

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

| Skill                            | Trigger                                                       |
| -------------------------------- | ------------------------------------------------------------- |
| `.agents/skills/rcr-frontend.md` | Component work, styling, design tokens, Radix/Shadcn          |
| `.agents/skills/rcr-backend.md`  | Drizzle, tRPC, integrations, DB management, alt-text workflow |
| `rcr` (global)                   | CLI operations on records, links, media, syncs                |
