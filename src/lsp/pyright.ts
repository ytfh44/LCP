/**
 * Pyright-specific LSP client
 */

import { LSPClient } from './client.js';
import { logger } from '../utils/logger.js';

  /**
   * Pyright LSP client for Python language support
   */
  export class PyrightClient extends LSPClient {
    constructor(workspaceRoot: string) {
      // Pyright is installed as npm package, use npx to run it
      super('npx', ['--yes', 'pyright-langserver', '--stdio'], workspaceRoot);
    }

  /**
   * Initialize with Python-specific capabilities
   */
  async initialize(): Promise<unknown> {
    logger.info('Initializing Pyright LSP client');

    const capabilities = {
      textDocument: {
        synchronization: {
          dynamicRegistration: true,
          willSave: false,
          willSaveWaitUntil: false,
          didSave: true,
        },
        completion: {
          dynamicRegistration: true,
          completionItem: {
            snippetSupport: true,
            commitCharactersSupport: true,
            documentationFormat: ['markdown', 'plaintext'],
          },
        },
        hover: {
          dynamicRegistration: true,
          contentFormat: ['markdown', 'plaintext'],
        },
        signatureHelp: {
          dynamicRegistration: true,
          signatureInformation: {
            documentationFormat: ['markdown', 'plaintext'],
          },
        },
        definition: {
          dynamicRegistration: true,
          linkSupport: true,
        },
        references: {
          dynamicRegistration: true,
        },
        documentHighlight: {
          dynamicRegistration: true,
        },
        documentSymbol: {
          dynamicRegistration: true,
          symbolKind: {
            valueSet: [
              1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
              19, 20, 21, 22, 23, 24, 25, 26,
            ],
          },
          hierarchicalDocumentSymbolSupport: true,
        },
        codeAction: {
          dynamicRegistration: true,
        },
        codeLens: {
          dynamicRegistration: true,
        },
        formatting: {
          dynamicRegistration: true,
        },
        rangeFormatting: {
          dynamicRegistration: true,
        },
        rename: {
          dynamicRegistration: true,
          prepareSupport: true,
        },
        publishDiagnostics: {
          relatedInformation: true,
          tagSupport: {
            valueSet: [1, 2],
          },
        },
      },
      workspace: {
        applyEdit: true,
        workspaceEdit: {
          documentChanges: true,
        },
        didChangeConfiguration: {
          dynamicRegistration: true,
        },
        didChangeWatchedFiles: {
          dynamicRegistration: true,
        },
        symbol: {
          dynamicRegistration: true,
        },
        executeCommand: {
          dynamicRegistration: true,
        },
        configuration: true,
        workspaceFolders: true,
      },
    };

    return super.initialize(capabilities);
  }
}
