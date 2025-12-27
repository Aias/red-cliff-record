/**
 * Structured error handling for the CLI
 */

import type { CLIError, ErrorCode, ErrorResult } from './types';

export class CLICommandError extends Error {
	code: ErrorCode;
	details?: unknown;

	constructor(code: ErrorCode, message: string, details?: unknown) {
		super(message);
		this.name = 'CLICommandError';
		this.code = code;
		this.details = details;
	}
}

export function createError(code: ErrorCode, message: string, details?: unknown): CLICommandError {
	return new CLICommandError(code, message, details);
}

export function normalizeError(error: unknown): CLIError {
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
			details: error.stack,
		};
	}

	return {
		code: 'INTERNAL_ERROR',
		message: 'An unexpected error occurred',
		details: String(error),
	};
}

export function formatErrorResult(error: unknown): ErrorResult {
	return {
		success: false,
		error: normalizeError(error),
	};
}
