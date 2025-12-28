/**
 * CLI type definitions for the rcr command
 */

export type OutputFormat = 'json' | 'table';

export interface ParsedArgs {
	command: string;
	subcommand: string;
	args: string[];
	options: RawCLIOptions;
}

export type RawCLIOptions = Record<string, string | boolean | number | undefined>;

export type ResultValue =
	| undefined
	| string
	| number
	| boolean
	| null
	| Date
	| ResultValue[]
	| { [key: string]: ResultValue };

export interface SuccessResult<T extends ResultValue> {
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
	details?: string;
}

export type ErrorCode =
	| 'VALIDATION_ERROR'
	| 'NOT_FOUND'
	| 'CONFLICT'
	| 'DATABASE_ERROR'
	| 'EMBEDDING_ERROR'
	| 'UNKNOWN_COMMAND'
	| 'PERMISSION_DENIED'
	| 'INTERNAL_ERROR';

export type Result<T extends ResultValue = ResultValue> = SuccessResult<T> | ErrorResult;

export type CommandHandler<T extends ResultValue = ResultValue> = (
	args: string[],
	options: RawCLIOptions
) => Promise<SuccessResult<T>>;

export type CommandMap = Record<string, Record<string, CommandHandler>>;
