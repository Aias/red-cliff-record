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
import { parseArgs } from './lib/args';
import { formatError, formatOutput } from './lib/output';
import type { CommandHandler, SuccessResult } from './lib/types';

// Import command modules
import * as records from './commands/records';
import * as search from './commands/search';
import * as links from './commands/links';
import * as sync from './commands/sync';

const commands: Record<string, Record<string, CommandHandler>> = {
	records,
	search,
	links,
	sync,
};

const HELP_TEXT = `
rcr - Red Cliff Record CLI

Usage:
  rcr <command> <subcommand> [args...] [options]

Commands:
  records get <id>              Fetch a record by ID
  records list [filters]        List records with optional filters
  records create <json>         Create a new record
  records update <id> <json>    Update an existing record
  records delete <id...>        Delete record(s)
  records merge <src> <target>  Merge source record into target
  records embed <id>            Generate embedding for a record
  records tree <id>             Get hierarchical family tree

  search <query>                Semantic search (default)
  search text <query>           Full-text trigram search
  search similar <id>           Find records similar to given ID

  links list <record-id>        List links for a record
  links create <json>           Create/upsert a link
  links delete <id...>          Delete link(s)
  links predicates              List available predicate types

  sync <integration>            Run a sync (github, readwise, etc.)
  sync daily                    Run all daily syncs

Options:
  --format=json|table   Output format (default: json)
  --limit=N             Limit number of results
  --offset=N            Offset for pagination
  --type=entity|concept|artifact  Filter by record type
  --curated             Filter to curated records only
  --debug               Enable debug output
  --help, -h            Show this help

Examples:
  rcr records get 123
  rcr records list --type=entity --limit=10
  rcr search "machine learning"
  rcr search similar 456 --limit=5
  rcr links list 123
  rcr sync github
`.trim();

async function main(): Promise<void> {
	const startTime = performance.now();
	const { command, subcommand, args, options } = parseArgs(process.argv.slice(2));

	// Handle help
	if (options.help || (!command && !subcommand)) {
		console.log(HELP_TEXT);
		process.exit(0);
	}

	// Special case: "search <query>" without subcommand means semantic search
	if (command === 'search' && subcommand && !['text', 'similar'].includes(subcommand)) {
		// Treat subcommand as the query for semantic search
		const query = [subcommand, ...args].join(' ');
		try {
			const handler = commands.search?.semantic;
			if (!handler) {
				throw new Error('Semantic search handler not found');
			}
			const result = await handler([query], options);
			// Add duration to meta
			if (result.meta) {
				result.meta.duration = Math.round(performance.now() - startTime);
			}
			console.log(formatOutput(result, options.format));
			process.exit(0);
		} catch (error) {
			console.log(formatError(error, options.format));
			process.exit(1);
		}
	}

	// Special case: "sync <integration>" - pass integration name as first arg
	if (command === 'sync' && subcommand) {
		try {
			const handler = sync.run;
			const result = await handler([subcommand, ...args], options);
			if (result.meta) {
				result.meta.duration = Math.round(performance.now() - startTime);
			}
			console.log(formatOutput(result, options.format));
			process.exit(0);
		} catch (error) {
			console.log(formatError(error, options.format));
			process.exit(1);
		}
	}

	// Find the command handler
	const commandGroup = commands[command];
	if (!commandGroup) {
		console.log(
			formatError(
				{
					code: 'UNKNOWN_COMMAND',
					message: `Unknown command: ${command}. Run 'rcr --help' for usage.`,
				},
				options.format
			)
		);
		process.exit(1);
	}

	const handler = commandGroup[subcommand];
	if (!handler) {
		const available = Object.keys(commandGroup).join(', ');
		console.log(
			formatError(
				{
					code: 'UNKNOWN_COMMAND',
					message: `Unknown subcommand: ${command} ${subcommand}. Available: ${available}`,
				},
				options.format
			)
		);
		process.exit(1);
	}

	try {
		const result = await handler(args, options);
		// Add duration to meta
		if (result.meta) {
			result.meta.duration = Math.round(performance.now() - startTime);
		} else {
			(result as SuccessResult<unknown>).meta = {
				duration: Math.round(performance.now() - startTime),
			};
		}
		console.log(formatOutput(result, options.format));
		process.exit(0);
	} catch (error) {
		console.log(formatError(error, options.format));
		process.exit(1);
	}
}

void main();
