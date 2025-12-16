/**
 * lcp_get_outline tool implementation
 */

import type { ToolResult, SymbolInfo } from '../core/types.js';
import { sessionStore } from '../core/session.js';
import { PyrightClient } from '../lsp/pyright.js';
import { LSPManager } from '../lsp/manager.js';
import { resolvePath } from '../utils/path-resolver.js';
import { withErrorHandling } from '../utils/error-handler.js';
import { rangeToOneBased } from '../utils/coordinate-converter.js';
import { logger } from '../utils/logger.js';

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

    // Initialize LSP client if needed
    if (!session.lspClient) {
      const lspClient = new PyrightClient(session.workspaceRoot);
      await lspClient.start();
      await lspClient.initialize();
      session.lspClient = lspClient;
    }

    // Create LSP manager if needed
    const lspManager = new LSPManager(session.lspClient, session);

    // Resolve file path
    const absolutePath = resolvePath(params.filePath, session.workspaceRoot);

    // Get document symbols
    const symbols = await lspManager.getDocumentSymbols(absolutePath);

    // Convert to our format
    const result = convertSymbols(symbols as unknown[]);

    logger.info('lcp_get_outline completed', {
      filePath: params.filePath,
      symbolCount: result.length,
    });

    return result;
  });
}

/**
 * Convert LSP symbols to our format
 */
function convertSymbols(symbols: unknown[]): SymbolInfo[] {
  const result: SymbolInfo[] = [];

  for (const symbol of symbols) {
    const s = symbol as {
      name: string;
      kind: number;
      range: {
        start: { line: number; character: number };
        end: { line: number; character: number };
      };
      children?: unknown[];
      detail?: string;
    };

    const symbolInfo: SymbolInfo = {
      name: s.name,
      kind: symbolKindToString(s.kind),
      range: rangeToOneBased(s.range),
      detail: s.detail,
    };

    if (s.children && s.children.length > 0) {
      symbolInfo.children = convertSymbols(s.children);
    }

    result.push(symbolInfo);
  }

  return result;
}

/**
 * Convert LSP symbol kind number to string
 */
function symbolKindToString(kind: number): string {
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
