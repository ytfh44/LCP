/**
 * Error handling framework with custom error classes
 */

import { ErrorCode, type ToolResult } from '../core/types.js';
import { logger } from './logger.js';

/**
 * Base LCP error class
 */
export class LCPError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'LCPError';
  }
}

/**
 * Session-related errors
 */
export class SessionError extends LCPError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.SESSION_NOT_FOUND, message, details);
    this.name = 'SessionError';
  }
}

/**
 * File-related errors
 */
export class FileError extends LCPError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.FILE_NOT_FOUND, message, details);
    this.name = 'FileError';
  }
}

/**
 * Symbol-related errors
 */
export class SymbolError extends LCPError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.SYMBOL_NOT_FOUND, message, details);
    this.name = 'SymbolError';
  }
}

/**
 * LSP-related errors
 */
export class LSPError extends LCPError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.LSP_ERROR, message, details);
    this.name = 'LSPError';
  }
}

/**
 * DAP-related errors
 */
export class DAPError extends LCPError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.DAP_ERROR, message, details);
    this.name = 'DAPError';
  }
}

/**
 * Timeout errors
 */
export class TimeoutError extends LCPError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.TIMEOUT, message, details);
    this.name = 'TimeoutError';
  }
}

/**
 * Convert any error to a ToolResult
 */
export function toToolResult<T>(error: unknown): ToolResult<T> {
  if (error instanceof LCPError) {
    logger.warn('LCP error occurred', {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    };
  }

  if (error instanceof Error) {
    logger.error('Unexpected error occurred', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: error.message,
        details: { stack: error.stack },
      },
    };
  }

  logger.error('Unknown error occurred', { error });
  return {
    success: false,
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unknown error occurred',
      details: error,
    },
  };
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T>(
  fn: () => Promise<T>
): Promise<ToolResult<T>> {
  return fn()
    .then((data) => ({ success: true, data }))
    .catch((error) => toToolResult<T>(error));
}
