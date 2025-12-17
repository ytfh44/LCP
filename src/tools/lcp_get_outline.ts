/**
 * lcp_get_outline tool implementation
 */

import type { ToolResult, SymbolInfo } from '../core/types.js';
import { sessionStore } from '../core/session.js';
import { languageRouter } from '../core/router.js';
import { LSPManager } from '../lsp/manager.js';
import { resolvePath } from '../utils/path-resolver.js';
import { withErrorHandling } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';
import { convertSymbols } from '../utils/symbol-utils.js';

interface GetOutlineParams {
  sessionId?: string;
  workspaceRoot?: string;
  filePath: string;
}

/**
 * Get file outline with symbol information
 */
export async function lcpGetOutline(
  params: GetOutlineParams
): Promise<ToolResult<SymbolInfo[]>> {
  return withErrorHandling(async () => {
    logger.info('lcp_get_outline called', params);

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

    // Convert to our format (with null check)
    if (!symbols) {
      logger.info('No symbols found for file', { filePath: params.filePath });
      return [];
    }
    
    const result = convertSymbols(symbols as any[]);

    logger.info('lcp_get_outline completed', {
      filePath: params.filePath,
      symbolCount: result.length,
    });

    return result;
  });
}
