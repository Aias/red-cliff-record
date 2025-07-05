Instructions for agents are created using the Cursor Rules format. They can be found in `.cursor/rules`. Always check these rules before implementing any changes. If a refactor would cause a rule to be outdated or broken, update the rule.

Instructions for Claude Code, but which may be relevant for other agents can be found in `CLAUDE.md`.

Prior to committing any changes, run `pnpm lint` and `pnpm tsc` to ensure that the code is linted and type-checked.
