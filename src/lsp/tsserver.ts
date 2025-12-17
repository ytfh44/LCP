/**
 * TypeScript Language Server client
 */

import { LSPClient } from './client.js';
import { logger } from '../utils/logger.js';

/**
 * TypeScript Language Server client for TypeScript/JavaScript support
 */
export class TSServerClient extends LSPClient {
  constructor(workspaceRoot: string) {
    // Use npx to run typescript-language-server
    super('npx', ['--yes', 'typescript-language-server', '--stdio'], workspaceRoot);
  }

  /**
   * Initialize with TypeScript-specific capabilities
   */
  async initialize(): Promise<unknown> {
    logger.info('Initializing TypeScript Language Server client');

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
            deprecatedSupport: true,
            preselectSupport: true,
            insertReplaceSupport: true,
            resolveSupport: {
              properties: ['documentation', 'detail', 'additionalTextEdits'],
            },
          },
          contextSupport: true,
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
            activeParameterSupport: true,
          },
          contextSupport: true,
        },
        definition: {
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
          labelSupport: true,
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
                'source',
                'source.organizeImports',
              ],
            },
          },
          isPreferredSupport: true,
          resolveSupport: {
            properties: ['edit'],
          },
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
        onTypeFormatting: {
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
        foldingRange: {
          dynamicRegistration: true,
          rangeLimit: 5000,
          lineFoldingOnly: true,
        },
        selectionRange: {
          dynamicRegistration: true,
        },
        callHierarchy: {
          dynamicRegistration: true,
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
          resourceOperations: ['create', 'rename', 'delete'],
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
    };

    return super.initialize(capabilities);
  }
}
