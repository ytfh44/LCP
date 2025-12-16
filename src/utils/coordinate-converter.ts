/**
 * Coordinate system conversion utilities
 * LSP/DAP use 0-based indexing, LLM/Human use 1-based indexing
 */

import type { Position, Range } from '../core/types.js';

/**
 * Convert 1-based line number to 0-based
 */
export function toZeroBased(line: number): number {
  return Math.max(0, line - 1);
}

/**
 * Convert 0-based line number to 1-based
 */
export function toOneBased(line: number): number {
  return line + 1;
}

/**
 * Convert 1-based position to 0-based
 */
export function positionToZeroBased(position: {
  line: number;
  character: number;
}): Position {
  return {
    line: toZeroBased(position.line),
    character: position.character,
  };
}

/**
 * Convert 0-based position to 1-based
 */
export function positionToOneBased(position: Position): {
  line: number;
  character: number;
} {
  return {
    line: toOneBased(position.line),
    character: position.character,
  };
}

/**
 * Convert 1-based range to 0-based
 */
export function rangeToZeroBased(range: {
  start: { line: number; character: number };
  end: { line: number; character: number };
}): Range {
  return {
    start: positionToZeroBased(range.start),
    end: positionToZeroBased(range.end),
  };
}

/**
 * Convert 0-based range to 1-based
 */
export function rangeToOneBased(range: Range): {
  start: { line: number; character: number };
  end: { line: number; character: number };
} {
  return {
    start: positionToOneBased(range.start),
    end: positionToOneBased(range.end),
  };
}
