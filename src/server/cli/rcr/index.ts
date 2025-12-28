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

import 'dotenv/config';
import { parseArgs, parseBaseOptions, type BaseOptions } from './lib/args';
import { createError } from './lib/errors';
import { formatError, formatOutput } from './lib/output';
import type { CommandHandler, ResultValue, SuccessResult } from './lib/types';

// Import command modules
import * as db from './commands/db';
import * as links from './commands/links';
import * as records from './commands/records';
import * as search from './commands/search';
import * as sync from './commands/sync';

const commands: Record<string, Record<string, CommandHandler>> = {
	db,
	links,
	records,
	search,
	sync,
};

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

  search <query>                Semantic search (default)
  search semantic <query>       Semantic vector search
  search text <query>           Full-text trigram search
  search similar <id...>        Find records similar to given ID(s)

  links list <record-id...>     List links for record(s)
  links create <json>           Create/upsert a link
  links delete <id...>          Delete link(s)
  links predicates              List available predicate types

  sync <integration>            Run a sync (github, readwise, etc.)
  sync daily                    Run all daily syncs

  db backup <local|remote>      Backup database [--data-only]
  db restore <local|remote>     Restore database [--clean] [--data-only]
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
  rcr search "machine learning"
  rcr search similar 456 --limit=5
  rcr links list 123
  rcr links list 123 456               # Links for multiple records
  rcr sync github
  rcr db status                        # Show database record counts
  rcr db backup local --data-only      # Data-only backup
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
			const handler = commands.search?.semantic;
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
			const handler = sync.run;
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
	const commandGroup = commands[command];
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
