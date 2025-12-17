/**
 * Utility functions for symbol manipulation and formatting
 */

import { SymbolInfo } from '../core/types.js';
import { rangeToOneBased } from './coordinate-converter.js';

/**
 * Find a symbol by name in a list of symbols (hierarchical)
 */
export function findSymbol(
  symbols: any[],
  symbolName: string
): any | null {
  const normalizedName = symbolName.toLowerCase();

  // 1. Direct match
  for (const symbol of symbols) {
    if (symbol.name === symbolName) {
      return symbol;
    }
  }

  // 2. Case-insensitive match
  for (const symbol of symbols) {
    if (symbol.name.toLowerCase() === normalizedName) {
      return symbol;
    }
  }

  // 3. Recursive search in children
  for (const symbol of symbols) {
    if (symbol.children && symbol.children.length > 0) {
      const found = findSymbol(symbol.children, symbolName);
      if (found) return found;
    }
  }

  // 4. Fuzzy match (contains) as last resort
  for (const symbol of symbols) {
    if (symbol.name.toLowerCase().includes(normalizedName)) {
      return symbol;
    }
  }

  return null;
}

/**
 * Truncate code while preserving structure (header/footer)
 */
export function truncateCode(code: string, maxLength: number = 40000): string {
  if (code.length <= maxLength) {
    return code;
  }

  const lines = code.split('\n');
  const headerLines = Math.min(lines.length / 2, 50); // Keep top 50 lines
  const footerLines = Math.min(lines.length - headerLines, 50); // Keep bottom 50 lines

  const header = lines.slice(0, headerLines).join('\n');
  const footer = lines.slice(lines.length - footerLines).join('\n');
  const skippedLines = lines.length - headerLines - footerLines;

  return `${header}\n\n... (skipping ${skippedLines} lines, code exceeds ${maxLength} characters) ...\n\n${footer}`;
}

/**
 * Convert LSP symbol kind number to string
 */
export function symbolKindToString(kind: number): string {
  const kinds: Record<number, string> = {
    1: 'File',
    2: 'Module',
    3: 'Namespace',
    4: 'Package',
    5: 'Class',
    6: 'Method',
    7: 'Property',
    8: 'Field',
    9: 'Constructor',
    10: 'Enum',
    11: 'Interface',
    12: 'Function',
    13: 'Variable',
    14: 'Constant',
    15: 'String',
    16: 'Number',
    17: 'Boolean',
    18: 'Array',
    19: 'Object',
    20: 'Key',
    21: 'Null',
    22: 'EnumMember',
    23: 'Struct',
    24: 'Event',
    25: 'Operator',
    26: 'TypeParameter',
  };

  return kinds[kind] || 'Unknown';
}

/**
 * Convert a list of LSP symbols to our SymbolInfo format
 */
export function convertSymbols(symbols: any[]): SymbolInfo[] {
  if (!symbols || !Array.isArray(symbols)) {
    return [];
  }

  return symbols.map((s) => ({
    name: s.name,
    kind: symbolKindToString(s.kind),
    range: rangeToOneBased(s.range),
    detail: s.detail,
    children: s.children ? convertSymbols(s.children) : undefined,
  }));
}
