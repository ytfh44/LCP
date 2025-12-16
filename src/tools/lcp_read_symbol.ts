/**
 * lcp_read_symbol tool implementation
 */

import type { ToolResult } from '../core/types.js';
import { sessionStore } from '../core/session.js';
import { PyrightClient } from '../lsp/pyright.js';
import { LSPManager } from '../lsp/manager.js';
import { resolvePath } from '../utils/path-resolver.js';
import { withErrorHandling, SymbolError } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';
import fs from 'fs';

interface ReadSymbolParams {
  sessionId?: string;
  workspaceRoot?: string;
  filePath: string;
  symbolName: string;
}

/**
 * Read specific symbol code from a file
 */
export async function lcpReadSymbol(
  params: ReadSymbolParams
): Promise<ToolResult<string>> {
  return withErrorHandling(async () => {
    logger.info('lcp_read_symbol called', params);

    // Get or create session
    let session;
    if (params.sessionId) {
      session = sessionStore.get(params.sessionId);
    } else if (params.workspaceRoot) {
      session = sessionStore.create(params.workspaceRoot);
    } else {
      throw new Error('Either sessionId or workspaceRoot must be provided');
    }

    // Initialize LSP client if needed
    if (!session.lspClient) {
      const lspClient = new PyrightClient(session.workspaceRoot);
      await lspClient.start();
      await lspClient.initialize();
      session.lspClient = lspClient;
    }

    // Create LSP manager
    const lspManager = new LSPManager(session.lspClient, session);

    // Resolve file path
    const absolutePath = resolvePath(params.filePath, session.workspaceRoot);

    // Get document symbols
    const symbols = await lspManager.getDocumentSymbols(absolutePath);

    // Find the symbol
    const symbol = findSymbol(symbols as unknown[], params.symbolName);
    if (!symbol) {
      throw new SymbolError(
        `Symbol "${params.symbolName}" not found in ${params.filePath}`,
        { filePath: params.filePath, symbolName: params.symbolName }
      );
    }

    // Read file content
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const lines = content.split('\n');

    // Extract symbol code (convert from 0-based to array index)
    const startLine = symbol.range.start.line;
    const endLine = symbol.range.end.line;
    const symbolCode = lines.slice(startLine, endLine + 1).join('\n');

    // Check if too long (>10k tokens, roughly 40k characters)
    const maxLength = 40000;
    if (symbolCode.length > maxLength) {
      const truncated = truncateCode(symbolCode, maxLength);
      logger.warn('Symbol code truncated', {
        symbolName: params.symbolName,
        originalLength: symbolCode.length,
        truncatedLength: truncated.length,
      });
      return truncated;
    }

    logger.info('lcp_read_symbol completed', {
      symbolName: params.symbolName,
      codeLength: symbolCode.length,
    });

    return symbolCode;
  });
}

/**
 * Find a symbol by name (supports fuzzy matching)
 */
function findSymbol(
  symbols: unknown[],
  symbolName: string
): {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
} | null {
  const normalizedName = symbolName.toLowerCase();

  for (const symbol of symbols) {
    const s = symbol as {
      name: string;
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
      children?: unknown[];
    };

    // Exact match
    if (s.name === symbolName) {
      return s;
    }

    // Case-insensitive match
    if (s.name.toLowerCase() === normalizedName) {
      return s;
    }

    // Check children recursively
    if (s.children) {
      const childSymbol = findSymbol(s.children, symbolName);
      if (childSymbol) {
        return childSymbol;
      }
    }
  }

  // Fuzzy match (contains)
  for (const symbol of symbols) {
    const s = symbol as {
      name: string;
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
      children?: unknown[];
    };

    if (s.name.toLowerCase().includes(normalizedName)) {
      return s;
    }
  }

  return null;
}

/**
 * Truncate code while preserving structure
 */
function truncateCode(code: string, maxLength: number): string {
  const lines = code.split('\n');
  const headerLines = Math.floor(maxLength / 200); // Rough estimate
  const footerLines = headerLines;

  if (lines.length <= headerLines + footerLines) {
    return code;
  }

  const header = lines.slice(0, headerLines).join('\n');
  const footer = lines.slice(-footerLines).join('\n');
  const skippedLines = lines.length - headerLines - footerLines;

  return `${header}\n\n... (skipping ${skippedLines} lines) ...\n\n${footer}`;
}
