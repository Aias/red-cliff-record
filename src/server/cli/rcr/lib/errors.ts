/**
 * Structured error handling for the CLI
 */

import { TRPCError } from '@trpc/server';
import { DbError, describeError } from '@/server/integrations/runtime/errors';
import type { CLIError, ErrorCode, ErrorResult } from './types';

const TRPC_ERROR_CODES: Partial<Record<TRPCError['code'], ErrorCode>> = {
  BAD_REQUEST: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  FORBIDDEN: 'PERMISSION_DENIED',
};

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

export function normalizeError(error: unknown): CLIError {
  if (error instanceof CLICommandError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details,
    };
  }

  if (error instanceof TRPCError) {
    const code = TRPC_ERROR_CODES[error.code];
    if (code) return { code, message: error.message };
  }

  const message = describeError(error);

  if (
    error instanceof DbError ||
    message.includes('ECONNREFUSED') ||
    message.includes('connection')
  ) {
    return {
      code: 'DATABASE_ERROR',
      message: 'Database operation failed',
      details: message,
    };
  }

  if (message.includes('OpenAI') || message.includes('embedding')) {
    return {
      code: 'EMBEDDING_ERROR',
      message: 'Embedding generation failed',
      details: message,
    };
  }

  return {
    code: 'INTERNAL_ERROR',
    message,
    details: error instanceof Error ? (error.stack ?? message) : message,
  };
}

export function formatErrorResult(error: unknown): ErrorResult {
  return {
    error: normalizeError(error),
  };
}
