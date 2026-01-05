#!/usr/bin/env bun
/**
 * rcr - Red Cliff Record CLI
 *
 * A unified CLI for the Red Cliff Record knowledge base.
 * Designed for LLM consumption with JSON output by default.
 *
 * Usage:
 *   rcr <command> <subcommand> [args...] [options]
 *
 * Commands:
 *   records   Manage records (get, list, create, update, delete, merge, embed, tree)
 *   search    Search records (text, semantic, similar)
 *   links     Manage links (list, create, delete, predicates)
 *   sync      Run integration syncs
 *
 * Options:
 *   --format=json|table  Output format (default: json)
 *   --help, -h           Show help
 *   --debug              Enable debug output
 */

import { existsSync, readFileSync, realpathSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { parseArgs, parseBaseOptions, type BaseOptions } from './lib/args';
import { createError } from './lib/errors';
import { formatError, formatOutput } from './lib/output';
import type { CommandHandler, ResultValue, SuccessResult } from './lib/types';

// Load environment variables from project root or ~/.secrets when CWD has no .env
// Bun automatically loads .env from CWD, so we only need fallback logic
function loadEnvFile(path: string) {
	try {
		const content = readFileSync(path, 'utf-8');
		for (const line of content.split('\n')) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('#')) continue;

			const match = trimmed.match(/^([^=]+)=(.*)$/);
			if (match && match[1] && match[2] !== undefined) {
				const cleanKey = match[1].trim();
				let cleanValue = match[2].trim();

				// Remove surrounding quotes if present
				if (
					(cleanValue.startsWith('"') && cleanValue.endsWith('"')) ||
					(cleanValue.startsWith("'") && cleanValue.endsWith("'"))
				) {
					cleanValue = cleanValue.slice(1, -1);
				}

				// Only set if not already defined (Bun may have loaded from CWD)
				if (!process.env[cleanKey]) {
					process.env[cleanKey] = cleanValue;
				}
			}
		}
	} catch {
		// Silently fail if file can't be read
	}
}

// Only load manually if CWD has no .env (Bun handles CWD automatically)
const cwdEnv = resolve(process.cwd(), '.env');
if (!existsSync(cwdEnv)) {
	// Try to find project root by resolving symlink
	try {
		const scriptPath = fileURLToPath(import.meta.url);
		const realScriptPath = realpathSync(scriptPath);
		// Navigate from src/server/cli/rcr/index.ts to project root
		const projectRoot = resolve(dirname(realScriptPath), '../../../..');
		const projectEnv = join(projectRoot, '.env');

		if (existsSync(projectEnv)) {
			loadEnvFile(projectEnv);
		} else {
			// Fallback to ~/.secrets
			const homeSecrets = join(process.env.HOME || '~', '.secrets');
			if (existsSync(homeSecrets)) {
				loadEnvFile(homeSecrets);
			}
		}
	} catch {
		// If symlink resolution fails, try ~/.secrets
		const homeSecrets = join(process.env.HOME || '~', '.secrets');
		if (existsSync(homeSecrets)) {
			loadEnvFile(homeSecrets);
		}
	}
}

// Commands will be loaded dynamically after env vars are configured
let commands: Record<string, Record<string, CommandHandler>> | null = null;

async function loadCommands() {
	if (commands) return commands;

	const [browsing, db, github, links, media, records, search, sync] = await Promise.all([
		import('./commands/browsing'),
		import('./commands/db'),
		import('./commands/github'),
		import('./commands/links'),
		import('./commands/media'),
		import('./commands/records'),
		import('./commands/search'),
		import('./commands/sync'),
	]);

	commands = { browsing, db, github, links, media, records, search, sync };
	return commands;
}

function withDuration<T extends ResultValue>(
	result: SuccessResult<T>,
	startTime: number
): SuccessResult<T> {
	const duration = Math.round(performance.now() - startTime);
	const meta = result.meta ? { ...result.meta, duration } : { duration };
	return { ...result, meta };
}

const HELP_TEXT = `
rcr - Red Cliff Record CLI

Usage:
  rcr <command> <subcommand> [args...] [options]

Commands:
  records get <id...> [--links] Fetch record(s) by ID
  records list [filters]        List records with optional filters
  records create <json>         Create a new record
  records update <id> <json>    Update an existing record
  records delete <id...>        Delete record(s)
  records merge <src> <target>  Merge source record into target
  records embed <id...>         Generate embedding(s) for record(s)
  records tree <id...>          Get hierarchical family tree(s)

  media get <id...> [--with-record]  Fetch media item(s) by ID
  media list [filters]              List media with optional filters
  media update <id> <json>          Update media metadata (alt text, etc.)

  search <query>                Semantic search (default)
  search semantic <query>       Semantic vector search
  search text <query>           Full-text trigram search
  search similar <id...>        Find records similar to given ID(s)

  links list <record-id...>     List links for record(s)
  links create <json>           Create/upsert a link
  links delete <id...>          Delete link(s)
  links predicates              List available predicate types

  browsing daily <date>         Get daily browsing summary (YYYY-MM-DD)
  browsing omit                  List URL patterns excluded from summaries
  browsing omit-add <pattern>    Add pattern to omit list (SQL LIKE syntax)
  browsing omit-delete <pat...>  Delete pattern(s) from omit list

  github daily <date>           Get daily commit summary (YYYY-MM-DD)
  github get <id>               Get commit details with file changes

  sync <integration>            Run a sync (github, readwise, etc.)
  sync daily                    Run all daily syncs

  db backup <local|remote>      Backup database [--data-only] [--dry-run|-n]
  db restore <local|remote>     Restore database [--clean] [--data-only] [--dry-run|-n]
  db reset                      Reset local database (drop & recreate)
  db seed                       Seed local database with predicates
  db status [local|remote]      Show connection info and record counts

Options:
  --format=json|table   Output format (default: json)
  --limit=N             Limit number of results
  --offset=N            Offset for pagination
  --type=entity|concept|artifact  Filter by record type
  --source=<integration>         Filter by source integration
  --curated             Filter to curated records only
  --debug               Enable debug output
  --help, -h            Show this help

Examples:
  rcr records get 123
  rcr records get 123 456 789          # Multiple records in parallel
  rcr records list --type=entity --limit=10
  rcr media list --type=image --alt-text=false --limit=10
  rcr media get 7724                   # Get media item with URL
  rcr media update 7724 '{"altText": "A sunset over mountains"}'
  rcr search "machine learning"
  rcr search similar 456 --limit=5
  rcr links list 123
  rcr links list 123 456               # Links for multiple records
  rcr browsing daily 2026-01-03        # Daily browsing summary
  rcr browsing omit                    # List omit patterns
  rcr browsing omit-add "%ads.%"       # Add pattern to omit list
  rcr github daily 2026-01-03          # Daily commit summary
  rcr sync github
  rcr db status                        # Show database record counts
  rcr db backup local --data-only      # Data-only backup
  rcr db restore remote -n             # Print restore commands without executing
`.trim();

async function main(): Promise<void> {
	const startTime = performance.now();
	const { command, subcommand, args, options: rawOptions } = parseArgs(process.argv.slice(2));
	let baseOptions: BaseOptions;
	try {
		baseOptions = parseBaseOptions(rawOptions);
	} catch (error) {
		const normalizedError = error instanceof Error ? error : String(error);
		console.log(formatError(normalizedError, 'json'));
		process.exit(1);
	}

	// Handle help
	if (baseOptions.help || (!command && !subcommand)) {
		console.log(HELP_TEXT);
		process.exit(0);
	}

	// Load command modules
	const cmds = await loadCommands();

	// Special case: "search <query>" without subcommand means semantic search
	if (
		command === 'search' &&
		subcommand &&
		subcommand !== 'text' &&
		subcommand !== 'similar' &&
		!(subcommand === 'semantic' && args.length > 0)
	) {
		// Treat subcommand as the query for semantic search
		const query = [subcommand, ...args].join(' ');
		try {
			const handler = cmds.search?.semantic;
			if (!handler) {
				throw new Error('Semantic search handler not found');
			}
			const result = withDuration(await handler([query], rawOptions), startTime);
			console.log(formatOutput(result, baseOptions.format));
			process.exit(0);
		} catch (error) {
			const normalizedError = error instanceof Error ? error : String(error);
			console.log(formatError(normalizedError, baseOptions.format));
			process.exit(1);
		}
	}

	// Special case: "sync <integration>" - pass integration name as first arg
	if (command === 'sync' && subcommand) {
		try {
			const handler = cmds.sync?.run;
			if (!handler) {
				throw new Error('Sync handler not found');
			}
			const result = withDuration(await handler([subcommand, ...args], rawOptions), startTime);
			console.log(formatOutput(result, baseOptions.format));
			process.exit(0);
		} catch (error) {
			const normalizedError = error instanceof Error ? error : String(error);
			console.log(formatError(normalizedError, baseOptions.format));
			process.exit(1);
		}
	}

	// Find the command handler
	const commandGroup = cmds[command];
	if (!commandGroup) {
		console.log(
			formatError(
				createError('UNKNOWN_COMMAND', `Unknown command: ${command}. Run 'rcr --help' for usage.`),
				baseOptions.format
			)
		);
		process.exit(1);
	}

	const handler = commandGroup[subcommand];
	if (!handler) {
		const available = Object.keys(commandGroup).join(', ');
		console.log(
			formatError(
				createError(
					'UNKNOWN_COMMAND',
					`Unknown subcommand: ${command} ${subcommand}. Available: ${available}`
				),
				baseOptions.format
			)
		);
		process.exit(1);
	}

	try {
		const result = withDuration(await handler(args, rawOptions), startTime);
		console.log(formatOutput(result, baseOptions.format));
		process.exit(0);
	} catch (error) {
		const normalizedError = error instanceof Error ? error : String(error);
		console.log(formatError(normalizedError, baseOptions.format));
		process.exit(1);
	}
}

void main();
