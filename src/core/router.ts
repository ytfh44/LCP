/**
 * Language Router - Automatically selects and manages LSP/DAP clients based on file type
 */

import { LSPClient } from '../lsp/client.js';
import { PyrightClient } from '../lsp/pyright.js';
import { GoplsClient } from '../lsp/gopls.js';
import { ClangdClient } from '../lsp/clangd.js';
import { TSServerClient } from '../lsp/tsserver.js';
import { logger } from '../utils/logger.js';
import { LanguageType, type Session } from './types.js';

// Re-export LanguageType for convenience
export { LanguageType } from './types.js';

/**
 * File extension to language type mapping
 */
const EXTENSION_MAP: Record<string, LanguageType> = {
  // Python
  '.py': LanguageType.PYTHON,
  '.pyw': LanguageType.PYTHON,
  '.pyi': LanguageType.PYTHON,
  
  // Go
  '.go': LanguageType.GO,
  
  // C/C++
  '.c': LanguageType.CPP,
  '.h': LanguageType.CPP,
  '.cpp': LanguageType.CPP,
  '.cc': LanguageType.CPP,
  '.cxx': LanguageType.CPP,
  '.hpp': LanguageType.CPP,
  '.hxx': LanguageType.CPP,
  '.hh': LanguageType.CPP,
  
  // TypeScript/JavaScript
  '.ts': LanguageType.TYPESCRIPT,
  '.tsx': LanguageType.TYPESCRIPT,
  '.js': LanguageType.TYPESCRIPT,
  '.jsx': LanguageType.TYPESCRIPT,
  '.mjs': LanguageType.TYPESCRIPT,
  '.cjs': LanguageType.TYPESCRIPT,
};

/**
 * Language Router for automatic language detection and LSP client management
 */
export class LanguageRouter {
  /**
   * Get language type from file path
   */
  getLanguageType(filePath: string): LanguageType {
    const ext = this.getExtension(filePath);
    return EXTENSION_MAP[ext] || LanguageType.UNKNOWN;
  }

  /**
   * Get file extension (lowercase, with dot)
   */
  private getExtension(filePath: string): string {
    const match = filePath.match(/\.[^.]+$/);
    return match ? match[0].toLowerCase() : '';
  }

  /**
   * Get or create LSP client for the given file
   */
  async getLSPClient(session: Session, filePath: string): Promise<LSPClient> {
    const languageType = this.getLanguageType(filePath);
    
    if (languageType === LanguageType.UNKNOWN) {
      throw new Error(`Unsupported file type: ${filePath}`);
    }

    // Check if client already exists
    const existingClient = session.lspClients.get(languageType);
    if (existingClient) {
      logger.debug('Using existing LSP client', { languageType });
      return existingClient;
    }

    // Create new client
    logger.info('Creating new LSP client', { languageType, workspaceRoot: session.workspaceRoot });
    const client = this.createLSPClient(languageType, session.workspaceRoot);
    
    // Start and initialize
    await client.start();
    await client.initialize();
    
    // Store in session
    session.lspClients.set(languageType, client);
    
    return client;
  }

  /**
   * Create LSP client for the given language type
   */
  private createLSPClient(languageType: LanguageType, workspaceRoot: string): LSPClient {
    switch (languageType) {
      case LanguageType.PYTHON:
        return new PyrightClient(workspaceRoot);
      case LanguageType.GO:
        return new GoplsClient(workspaceRoot);
      case LanguageType.CPP:
        return new ClangdClient(workspaceRoot);
      case LanguageType.TYPESCRIPT:
        return new TSServerClient(workspaceRoot);
      default:
        throw new Error(`No LSP client for language: ${languageType}`);
    }
  }

  /**
   * Check if a file type is supported
   */
  isSupported(filePath: string): boolean {
    return this.getLanguageType(filePath) !== LanguageType.UNKNOWN;
  }

  /**
   * Get language ID for LSP (used in textDocument/didOpen)
   */
  getLanguageId(filePath: string): string {
    const languageType = this.getLanguageType(filePath);
    
    switch (languageType) {
      case LanguageType.PYTHON:
        return 'python';
      case LanguageType.GO:
        return 'go';
      case LanguageType.CPP:
        // Determine if C or C++ based on extension
        const ext = this.getExtension(filePath);
        return ext === '.c' || ext === '.h' ? 'c' : 'cpp';
      case LanguageType.TYPESCRIPT:
        const tsExt = this.getExtension(filePath);
        if (tsExt === '.ts' || tsExt === '.tsx') return 'typescript';
        if (tsExt === '.tsx') return 'typescriptreact';
        if (tsExt === '.jsx') return 'javascriptreact';
        return 'javascript';
      default:
        return 'plaintext';
    }
  }

  /**
   * Cleanup all LSP clients in a session
   */
  async cleanup(session: Session): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];
    
    for (const [languageType, client] of session.lspClients.entries()) {
      logger.info('Shutting down LSP client', { languageType });
      shutdownPromises.push(
        client.shutdown().catch((error) => {
          logger.warn('Error shutting down LSP client', { languageType, error });
        })
      );
    }
    
    await Promise.all(shutdownPromises);
    session.lspClients.clear();
  }
}

// Global router instance
export const languageRouter = new LanguageRouter();
