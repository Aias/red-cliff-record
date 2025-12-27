/**
 * CLI type definitions for the rcr command
 */

export type OutputFormat = 'json' | 'table';

export interface ParsedArgs {
	command: string;
	subcommand: string;
	args: string[];
	options: CLIOptions;
}

export interface CLIOptions {
	format: OutputFormat;
	help: boolean;
	debug: boolean;
	[key: string]: string | boolean | number | undefined;
}

export interface SuccessResult<T> {
	success: true;
	data: T;
	meta?: ResultMeta;
}

export interface ResultMeta {
	count?: number;
	total?: number;
	limit?: number;
	offset?: number;
	duration?: number;
}

export interface ErrorResult {
	success: false;
	error: CLIError;
}

export interface CLIError {
	code: ErrorCode;
	message: string;
	details?: unknown;
}

export type ErrorCode =
	| 'VALIDATION_ERROR'
	| 'NOT_FOUND'
	| 'CONFLICT'
	| 'DATABASE_ERROR'
	| 'EMBEDDING_ERROR'
	| 'UNKNOWN_COMMAND'
	| 'INTERNAL_ERROR';

export type Result<T> = SuccessResult<T> | ErrorResult;

export type CommandHandler<T = unknown> = (
	args: string[],
	options: CLIOptions
) => Promise<SuccessResult<T>>;

export type CommandMap = Record<string, Record<string, CommandHandler>>;
