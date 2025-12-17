/**
 * lcp_get_diagnostics tool implementation
 */

import type { ToolResult, DiagnosticInfo } from '../core/types.js';
import { sessionStore } from '../core/session.js';
import { languageRouter } from '../core/router.js';
import { LSPManager } from '../lsp/manager.js';
import { resolvePath } from '../utils/path-resolver.js';
import { withErrorHandling } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';

interface GetDiagnosticsParams {
  sessionId?: string;
  workspaceRoot?: string;
  filePath?: string;
}

/**
 * Get diagnostics (errors, warnings) for files
 */
export async function lcpGetDiagnostics(
  params: GetDiagnosticsParams
): Promise<ToolResult<DiagnosticInfo[]>> {
  return withErrorHandling(async () => {
    logger.info('lcp_get_diagnostics called', params);

    // Get or create session
    let session;
    if (params.sessionId) {
      session = sessionStore.get(params.sessionId);
    } else if (params.workspaceRoot) {
      session = sessionStore.create(params.workspaceRoot);
    } else {
      throw new Error('Either sessionId or workspaceRoot must be provided');
    }

    // Use current file or workspaceroot to determine LSP client
    // If no filePath, we might need a default language or handle all supported
    // For now, if no filePath, we'll try to get diagnostics from all active clients
    
    if (params.filePath) {
      const absolutePath = resolvePath(params.filePath, session.workspaceRoot);
      const lspClient = await languageRouter.getLSPClient(session, absolutePath);
      const lspManager = new LSPManager(lspClient, session);

      await lspManager.openFile(absolutePath);

      // Wait a bit for diagnostics to be published
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const diagnostics = lspManager.getDiagnostics(absolutePath);
      logger.info('lcp_get_diagnostics completed', {
        filePath: params.filePath,
        diagnosticCount: diagnostics.length,
      });
      return diagnostics;
    } else {
      // Get all diagnostics from session (published by any client)
      const allDiagnostics: DiagnosticInfo[] = [];
      for (const diagnostics of session.diagnostics.values()) {
        allDiagnostics.push(...diagnostics);
      }
      
      logger.info('lcp_get_diagnostics completed', {
        totalDiagnostics: allDiagnostics.length,
      });
      return allDiagnostics;
    }
  });
}
