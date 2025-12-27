/**
 * Minimal argument parsing for the CLI
 * No external dependencies - parses process.argv directly
 */

import type { CLIOptions, OutputFormat, ParsedArgs } from './types';

function isOutputFormat(value: string): value is OutputFormat {
	return value === 'json' || value === 'table';
}

function parseOptionValue(value: string): string | number | boolean {
	// Boolean-like strings
	if (value === 'true') return true;
	if (value === 'false') return false;

	// Numbers
	const num = Number(value);
	if (!isNaN(num) && value.trim() !== '') return num;

	// Default to string
	return value;
}

export function parseArgs(argv: string[]): ParsedArgs {
	const options: CLIOptions = {
		format: 'json',
		help: false,
		debug: false,
	};
	const positional: string[] = [];

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;

		if (arg === '--help' || arg === '-h') {
			options.help = true;
		} else if (arg === '--debug') {
			options.debug = true;
		} else if (arg.startsWith('--')) {
			// Handle --key=value or --key value
			const eqIndex = arg.indexOf('=');
			if (eqIndex !== -1) {
				const key = arg.slice(2, eqIndex);
				const value = arg.slice(eqIndex + 1);
				if (key === 'format' && isOutputFormat(value)) {
					options.format = value;
				} else {
					options[key] = parseOptionValue(value);
				}
			} else {
				const key = arg.slice(2);
				const nextArg = argv[i + 1];
				// Check if next arg looks like a value (not another flag)
				if (nextArg && !nextArg.startsWith('-')) {
					if (key === 'format' && isOutputFormat(nextArg)) {
						options.format = nextArg;
					} else {
						options[key] = parseOptionValue(nextArg);
					}
					i++; // Skip the value
				} else {
					// Flag without value = true
					options[key] = true;
				}
			}
		} else if (arg.startsWith('-') && arg.length === 2) {
			// Short flags like -v, -q
			const key = arg.slice(1);
			options[key] = true;
		} else {
			positional.push(arg);
		}
	}

	return {
		command: positional[0] ?? '',
		subcommand: positional[1] ?? '',
		args: positional.slice(2),
		options,
	};
}

/**
 * Parse a JSON string from args or stdin
 */
export async function parseJsonInput(args: string[]): Promise<unknown> {
	// If args provided, join and parse
	if (args.length > 0) {
		const jsonStr = args.join(' ');
		return JSON.parse(jsonStr);
	}

	// Otherwise read from stdin using Bun's API
	const input = await Bun.stdin.text();
	if (!input.trim()) {
		throw new Error('No JSON input provided');
	}
	return JSON.parse(input.trim());
}

/**
 * Parse a list of IDs from args
 */
export function parseIds(args: string[]): number[] {
	return args.map((arg) => {
		const id = parseInt(arg, 10);
		if (isNaN(id) || id <= 0) {
			throw new Error(`Invalid ID: ${arg}`);
		}
		return id;
	});
}

/**
 * Parse a single required ID from args
 */
export function parseId(args: string[], position = 0): number {
	const arg = args[position];
	if (!arg) {
		throw new Error('ID is required');
	}
	const id = parseInt(arg, 10);
	if (isNaN(id) || id <= 0) {
		throw new Error(`Invalid ID: ${arg}`);
	}
	return id;
}
