/**
 * Structured error handling for the CLI
 */

import type { CLIError, ErrorCode, ErrorResult } from './types';

export class CLICommandError extends Error {
	code: ErrorCode;
	details?: string;

	constructor(code: ErrorCode, message: string, details?: string) {
		super(message);
		this.name = 'CLICommandError';
		this.code = code;
		this.details = details;
	}
}

export function createError(code: ErrorCode, message: string, details?: string): CLICommandError {
	return new CLICommandError(code, message, details);
}

type NormalizableError = CLICommandError | Error | string;

export function normalizeError(error: NormalizableError): CLIError {
	if (error instanceof CLICommandError) {
		return {
			code: error.code,
			message: error.message,
			details: error.details,
		};
	}

	if (error instanceof Error) {
		// Check for common database errors
		if (error.message.includes('ECONNREFUSED') || error.message.includes('connection')) {
			return {
				code: 'DATABASE_ERROR',
				message: 'Database connection failed',
				details: error.message,
			};
		}

		// Check for OpenAI/embedding errors
		if (error.message.includes('OpenAI') || error.message.includes('embedding')) {
			return {
				code: 'EMBEDDING_ERROR',
				message: 'Embedding generation failed',
				details: error.message,
			};
		}

		return {
			code: 'INTERNAL_ERROR',
			message: error.message,
			details: error.stack ?? error.message,
		};
	}

	return {
		code: 'INTERNAL_ERROR',
		message: error,
		details: error,
	};
}

export function formatErrorResult(error: NormalizableError): ErrorResult {
	return {
		success: false,
		error: normalizeError(error),
	};
}
