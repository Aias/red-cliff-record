/**
 * Minimal argument parsing for the CLI
 * No external dependencies - parses process.argv directly
 */

import type { ZodType } from 'zod';
import { z } from 'zod';
import { CoercedIdSchema, IdSchema, LimitSchema, OffsetSchema } from '@/shared/types';
import { createError } from './errors';
import type { ParsedArgs, RawCLIOptions, ResultValue } from './types';

// ─────────────────────────────────────────────────────────────
// Reusable CLI Schemas
// ─────────────────────────────────────────────────────────────

export const BaseOptionsSchema = z.object({
	format: z.enum(['json', 'table']).default('json'),
	help: z.boolean().default(false),
	debug: z.boolean().default(false),
});

export type BaseOptions = z.infer<typeof BaseOptionsSchema>;

/** Comma-separated list of IDs (e.g., "1,2,3" or just a single number) */
export const CommaSeparatedIdsSchema = z.preprocess((value) => {
	if (typeof value === 'number') return [value];
	if (typeof value === 'string') {
		return value
			.split(',')
			.map((item) => item.trim())
			.filter((item) => item.length > 0)
			.map((item) => Number(item));
	}
	return value;
}, z.array(IdSchema));

/** Re-export commonly used schemas from shared types */
export { IdSchema, LimitSchema, OffsetSchema };

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
	const options: RawCLIOptions = {};
	const positional: string[] = [];

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]!;

		if (arg === '--') {
			positional.push(...argv.slice(i + 1));
			break;
		}
		if (arg === '--help' || arg === '-h') {
			options.help = true;
		} else if (arg.startsWith('--')) {
			// Handle --key=value or --key value
			const eqIndex = arg.indexOf('=');
			if (eqIndex !== -1) {
				const key = arg.slice(2, eqIndex);
				const value = arg.slice(eqIndex + 1);
				options[key] = parseOptionValue(value);
			} else {
				const key = arg.slice(2);
				const nextArg = argv[i + 1];
				// Check if next arg looks like a value (not another flag)
				if (nextArg && !nextArg.startsWith('-')) {
					options[key] = parseOptionValue(nextArg);
					i++; // Skip the value
				} else {
					// Flag without value = true
					options[key] = true;
				}
			}
		} else if (arg.startsWith('-') && arg.length === 2) {
			// Short flags like -v, -q
			const key = arg.slice(1);
			if (key === 'h') {
				options.help = true;
			} else {
				options[key] = true;
			}
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

export function parseBaseOptions(options: RawCLIOptions): BaseOptions {
	const result = BaseOptionsSchema.passthrough().safeParse(options);
	if (!result.success) {
		throw createError('VALIDATION_ERROR', result.error.message);
	}
	return result.data;
}

export function parseOptions<T>(schema: ZodType<T>, options: RawCLIOptions): T {
	const result = schema.safeParse(options);
	if (!result.success) {
		throw createError('VALIDATION_ERROR', result.error.message);
	}
	return result.data;
}

/**
 * Parse a JSON string from args or stdin
 */
export async function parseJsonInput<T extends ResultValue>(
	schema: ZodType<T>,
	args: string[]
): Promise<T> {
	const jsonStr = args.length > 0 ? args.join(' ') : await Bun.stdin.text();

	if (!jsonStr.trim()) {
		throw createError('VALIDATION_ERROR', 'No JSON input provided');
	}

	let parsed: ResultValue;
	try {
		parsed = JSON.parse(jsonStr);
	} catch {
		throw createError('VALIDATION_ERROR', 'Invalid JSON input');
	}

	const result = schema.safeParse(parsed);
	if (!result.success) {
		throw createError('VALIDATION_ERROR', result.error.message);
	}

	return result.data;
}

/**
 * Parse a list of IDs from args (coerces strings to numbers)
 */
export function parseIds(args: string[]): number[] {
	const result = z.array(CoercedIdSchema).safeParse(args);
	if (!result.success) {
		throw createError('VALIDATION_ERROR', `Invalid ID(s): ${args.join(', ')}`);
	}
	return result.data;
}

/**
 * Parse a single required ID from args (coerces string to number)
 */
export function parseId(args: string[], position = 0): number {
	const arg = args[position];
	if (arg === undefined) {
		throw createError('VALIDATION_ERROR', 'ID is required');
	}
	const result = CoercedIdSchema.safeParse(arg);
	if (!result.success) {
		throw createError('VALIDATION_ERROR', `Invalid ID: ${arg}`);
	}
	return result.data;
}
