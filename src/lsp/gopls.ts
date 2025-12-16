/**
 * Gopls (Go Language Server) client
 */

import { LSPClient } from './client.js';
import { logger } from '../utils/logger.js';

/**
 * Gopls LSP client for Go language support
 */
export class GoplsClient extends LSPClient {
  constructor(workspaceRoot: string) {
    // gopls should be installed via: go install golang.org/x/tools/gopls@latest
    super('gopls', ['serve'], workspaceRoot);
  }

  /**
   * Initialize with Go-specific capabilities
   */
  async initialize(): Promise<unknown> {
    logger.info('Initializing Gopls LSP client');

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
        formatting: {
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
