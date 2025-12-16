/**
 * Clangd (C/C++ Language Server) client
 */

import { LSPClient } from './client.js';
import { logger } from '../utils/logger.js';

/**
 * Clangd LSP client for C/C++ language support
 */
export class ClangdClient extends LSPClient {
  constructor(workspaceRoot: string) {
    // clangd should be installed via system package manager or LLVM
    super('clangd', ['--background-index'], workspaceRoot);
  }

  /**
   * Initialize with C/C++-specific capabilities
   */
  async initialize(): Promise<unknown> {
    logger.info('Initializing Clangd LSP client');

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
            parameterInformation: {
              labelOffsetSupport: true,
            },
          },
        },
        definition: {
          dynamicRegistration: true,
          linkSupport: true,
        },
        declaration: {
          dynamicRegistration: true,
          linkSupport: true,
        },
        typeDefinition: {
          dynamicRegistration: true,
          linkSupport: true,
        },
        implementation: {
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
          codeActionLiteralSupport: {
            codeActionKind: {
              valueSet: [
                'quickfix',
                'refactor',
                'refactor.extract',
                'refactor.inline',
                'refactor.rewrite',
              ],
            },
          },
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
          codeDescriptionSupport: true,
        },
        semanticTokens: {
          dynamicRegistration: true,
          requests: {
            range: true,
            full: {
              delta: true,
            },
          },
          tokenTypes: [
            'namespace', 'type', 'class', 'enum', 'interface', 'struct',
            'typeParameter', 'parameter', 'variable', 'property', 'enumMember',
            'event', 'function', 'method', 'macro', 'keyword', 'modifier',
            'comment', 'string', 'number', 'regexp', 'operator',
          ],
          tokenModifiers: [
            'declaration', 'definition', 'readonly', 'static', 'deprecated',
            'abstract', 'async', 'modification', 'documentation', 'defaultLibrary',
          ],
          formats: ['relative'],
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
          symbolKind: {
            valueSet: [
              1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
              19, 20, 21, 22, 23, 24, 25, 26,
            ],
          },
        },
        executeCommand: {
          dynamicRegistration: true,
        },
        configuration: true,
        workspaceFolders: true,
      },
      offsetEncoding: ['utf-16', 'utf-32'],
    };

    return super.initialize(capabilities);
  }
}
