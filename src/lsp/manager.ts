/**
 * LSP lifecycle manager with file tracking and diagnostic caching
 */

import type { LSPClient } from './client.js';
import type { DiagnosticInfo, Session } from '../core/types.js';
import { logger } from '../utils/logger.js';
import { pathToUri, uriToPath } from '../utils/path-resolver.js';
import { toOneBased } from '../utils/coordinate-converter.js';
import { languageRouter } from '../core/router.js';
import fs from 'fs';

/**
 * LSP Manager handles file lifecycle and diagnostic caching
 */
export class LSPManager {
  private fileCloseTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly fileCloseDelay = 5 * 60 * 1000; // 5 minutes

  constructor(
    private lspClient: LSPClient,
    private session: Session
  ) {
    // Register diagnostic handler only if not already registered on this client
    // We check for a private marker on the client to avoid duplicate handlers
    const clientAny = this.lspClient as any;
    if (!clientAny._lcp_diagnostic_handler_registered) {
      this.lspClient.onNotification(
        'textDocument/publishDiagnostics',
        (params: unknown) => {
          this.handleDiagnostics(params as {
            uri: string;
            diagnostics: unknown[];
          });
        }
      );
      clientAny._lcp_diagnostic_handler_registered = true;
    }
  }

  /**
   * Open a file in the LSP server
   */
  async openFile(filePath: string): Promise<void> {
    const uri = pathToUri(filePath);

    // Cancel any pending close timeout
    const closeTimeout = this.fileCloseTimeouts.get(filePath);
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      this.fileCloseTimeouts.delete(filePath);
    }

    // If already open, just return
    if (this.session.openFiles.has(filePath)) {
      logger.debug('File already open', { filePath });
      return;
    }

    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');

    // Detect language ID using LanguageRouter (centralized)
    const languageId = languageRouter.getLanguageId(filePath);

    // Send didOpen notification
    await this.lspClient.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri,
        languageId,
        version: 1,
        text: content,
      },
    });

    this.session.openFiles.add(filePath);
    logger.info('File opened in LSP', { filePath, languageId });
  }

  /**
   * Close a file in the LSP server (with delay)
   */
  scheduleFileClose(filePath: string): void {
    // Clear any existing timeout
    const existingTimeout = this.fileCloseTimeouts.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule close after delay
    const timeout = setTimeout(() => {
      this.closeFile(filePath);
    }, this.fileCloseDelay);

    this.fileCloseTimeouts.set(filePath, timeout);
    logger.debug('Scheduled file close', {
      filePath,
      delayMs: this.fileCloseDelay,
    });
  }

  /**
   * Close a file immediately
   */
  private async closeFile(filePath: string): Promise<void> {
    if (!this.session.openFiles.has(filePath)) {
      return;
    }

    const uri = pathToUri(filePath);

    await this.lspClient.sendNotification('textDocument/didClose', {
      textDocument: { uri },
    });

    this.session.openFiles.delete(filePath);
    this.fileCloseTimeouts.delete(filePath);
    logger.info('File closed in LSP', { filePath });
  }

  /**
   * Update file content
   */
  async updateFile(filePath: string, content: string): Promise<void> {
    const uri = pathToUri(filePath);

    // Ensure file is open
    await this.openFile(filePath);

    // Send didChange notification
    await this.lspClient.sendNotification('textDocument/didChange', {
      textDocument: {
        uri,
        version: Date.now(), // Use timestamp as version
      },
      contentChanges: [
        {
          text: content,
        },
      ],
    });

    logger.debug('File content updated', { filePath });
  }

  /**
   * Get document symbols
   */
  async getDocumentSymbols(filePath: string): Promise<unknown> {
    await this.openFile(filePath);

    const uri = pathToUri(filePath);
    const symbols = await this.lspClient.sendRequest(
      'textDocument/documentSymbol',
      {
        textDocument: { uri },
      }
    );

    return symbols;
  }

  /**
   * Get definition location
   */
  async getDefinition(
    filePath: string,
    line: number,
    character: number
  ): Promise<unknown> {
    await this.openFile(filePath);

    const uri = pathToUri(filePath);
    const definition = await this.lspClient.sendRequest(
      'textDocument/definition',
      {
        textDocument: { uri },
        position: { line, character },
      }
    );

    return definition;
  }

  /**
   * Get references
   */
  async getReferences(
    filePath: string,
    line: number,
    character: number
  ): Promise<unknown> {
    await this.openFile(filePath);

    const uri = pathToUri(filePath);
    const references = await this.lspClient.sendRequest(
      'textDocument/references',
      {
        textDocument: { uri },
        position: { line, character },
        context: { includeDeclaration: true },
      }
    );

    return references;
  }

  /**
   * Get completion items
   */
  async getCompletion(
    filePath: string,
    line: number,
    character: number
  ): Promise<unknown> {
    await this.openFile(filePath);

    const uri = pathToUri(filePath);
    const completion = await this.lspClient.sendRequest(
      'textDocument/completion',
      {
        textDocument: { uri },
        position: { line, character },
      }
    );

    return completion;
  }

  /**
   * Resolve completion item
   */
  async resolveCompletion(item: unknown): Promise<unknown> {
    // Note: resolve typically doesn't need file context as it operates on the item itself
    const resolved = await this.lspClient.sendRequest(
      'completionItem/resolve',
      item
    );
    return resolved;
  }

  /**
   * Rename symbol
   */
  async renameSymbol(
    filePath: string,
    line: number,
    character: number,
    newName: string
  ): Promise<unknown> {
    await this.openFile(filePath);

    const uri = pathToUri(filePath);
    const workspaceEdit = await this.lspClient.sendRequest(
      'textDocument/rename',
      {
        textDocument: { uri },
        position: { line, character },
        newName,
      }
    );

    return workspaceEdit;
  }

  /**
   * Format document
   */
  async formatDocument(filePath: string): Promise<unknown> {
    await this.openFile(filePath);

    const uri = pathToUri(filePath);
    const edits = await this.lspClient.sendRequest('textDocument/formatting', {
      textDocument: { uri },
      options: {
        tabSize: 2, // Default, can be made configurable
        insertSpaces: true,
      },
    });

    return edits;
  }

  /**
   * Get diagnostics for a file
   */
  getDiagnostics(filePath?: string): DiagnosticInfo[] {
    if (filePath) {
      return this.session.diagnostics.get(filePath) || [];
    }

    // Return all diagnostics
    const allDiagnostics: DiagnosticInfo[] = [];
    for (const diagnostics of this.session.diagnostics.values()) {
      allDiagnostics.push(...diagnostics);
    }
    return allDiagnostics;
  }

  /**
   * Handle diagnostic notifications from LSP
   */
  private handleDiagnostics(params: {
    uri: string;
    diagnostics: unknown[];
  }): void {
    const filePath = uriToPath(params.uri);
    const diagnostics: DiagnosticInfo[] = (params.diagnostics as Array<{
      range: { start: { line: number }; end: { line: number } };
      severity: number;
      message: string;
      source?: string;
      code?: string | number;
    }>).map((diag) => ({
      file: filePath,
      line: toOneBased(diag.range.start.line),
      severity: this.severityToString(diag.severity),
      message: diag.message,
      source: diag.source,
      code: diag.code,
    }));

    this.session.diagnostics.set(filePath, diagnostics);
    logger.debug('Diagnostics updated', {
      filePath,
      count: diagnostics.length,
    });
  }

  /**
   * Convert LSP severity number to string
   */
  private severityToString(
    severity: number
  ): 'error' | 'warning' | 'info' | 'hint' {
    switch (severity) {
      case 1:
        return 'error';
      case 2:
        return 'warning';
      case 3:
        return 'info';
      case 4:
        return 'hint';
      default:
        return 'info';
    }
  }

  /**
   * Cleanup all open files
   */
  async cleanup(): Promise<void> {
    // Clear all timeouts
    for (const timeout of this.fileCloseTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.fileCloseTimeouts.clear();

    // Close all open files
    const closePromises = Array.from(this.session.openFiles).map((filePath) =>
      this.closeFile(filePath)
    );
    await Promise.all(closePromises);
  }
}
