/**
 * lcp_read_symbol tool implementation
 */

import type { ToolResult } from '../core/types.js';
import { sessionStore } from '../core/session.js';
import { languageRouter } from '../core/router.js';
import { LSPManager } from '../lsp/manager.js';
import { resolvePath } from '../utils/path-resolver.js';
import { withErrorHandling, SymbolError } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';
import { findSymbol, truncateCode } from '../utils/symbol-utils.js';
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

    // Resolve file path
    const absolutePath = resolvePath(params.filePath, session.workspaceRoot);

    // Get LSP client via router (multi-language support)
    const lspClient = await languageRouter.getLSPClient(session, absolutePath);
    
    // Create LSP manager
    const lspManager = new LSPManager(lspClient, session);

    // Get document symbols
    const symbols = await lspManager.getDocumentSymbols(absolutePath);

    if (!symbols || !Array.isArray(symbols)) {
       throw new SymbolError(
        `No symbols found in file ${params.filePath}`,
        { filePath: params.filePath }
      );
    }

    // Find the symbol
    const symbol = findSymbol(symbols as any[], params.symbolName);
    if (!symbol) {
      throw new SymbolError(
        `Symbol "${params.symbolName}" not found in ${params.filePath}`,
        { filePath: params.filePath, symbolName: params.symbolName }
      );
    }

    // Read file content
    const content = fs.readFileSync(absolutePath, 'utf-8');
    const lines = content.split('\n');

    // Extract symbol code (indices are 0-based from LSP)
    const startLine = symbol.range.start.line;
    const endLine = symbol.range.end.line;
    
    // Safety check for line ranges
    if (startLine < 0 || endLine >= lines.length || startLine > endLine) {
        throw new SymbolError(`Invalid range for symbol ${params.symbolName}`, {
            range: symbol.range,
            totalLines: lines.length
        });
    }

    const symbolCode = lines.slice(startLine, endLine + 1).join('\n');

    // Check if too long and truncate if necessary
    const processedCode = truncateCode(symbolCode);

    logger.info('lcp_read_symbol completed', {
      symbolName: params.symbolName,
      codeLength: processedCode.length,
    });

    return processedCode;
  });
}
