/**
 * lcp_get_diagnostics tool implementation
 */

import type { ToolResult, DiagnosticInfo } from '../core/types.js';
import { sessionStore } from '../core/session.js';
import { PyrightClient } from '../lsp/pyright.js';
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

    // Initialize LSP client if needed
    if (!session.lspClient) {
      const lspClient = new PyrightClient(session.workspaceRoot);
      await lspClient.start();
      await lspClient.initialize();
      session.lspClient = lspClient;
    }

    // Create LSP manager
    const lspManager = new LSPManager(session.lspClient, session);

    // If file path provided, ensure it's open to get diagnostics
    if (params.filePath) {
      const absolutePath = resolvePath(params.filePath, session.workspaceRoot);
      await lspManager.openFile(absolutePath);

      // Wait a bit for diagnostics to be published
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Get diagnostics
    const diagnostics = params.filePath
      ? lspManager.getDiagnostics(
          resolvePath(params.filePath, session.workspaceRoot)
        )
      : lspManager.getDiagnostics();

    logger.info('lcp_get_diagnostics completed', {
      filePath: params.filePath,
      diagnosticCount: diagnostics.length,
    });

    return diagnostics;
  });
}
