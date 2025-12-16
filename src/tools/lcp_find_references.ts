/**
 * lcp_find_references - Find all references to a symbol across the project
 */

import path from 'path';
import fs from 'fs';
import { sessionStore } from '../core/session.js';
import { languageRouter } from '../core/router.js';
import { LSPManager } from '../lsp/manager.js';
import { logger } from '../utils/logger.js';
import { toOneBased } from '../utils/coordinate-converter.js';
import { uriToPath } from '../utils/path-resolver.js';
import type { ReferenceInfo, SymbolInfo } from '../core/types.js';

interface FindReferencesArgs {
  sessionId?: string;
  workspaceRoot?: string;
  filePath: string;
  symbolName: string;
  includeDeclaration?: boolean;
}

interface LSPLocation {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

/**
 * Find all references to a symbol
 */
export async function lcpFindReferences(args: FindReferencesArgs): Promise<{
  definition?: ReferenceInfo;
  references: ReferenceInfo[];
  totalCount: number;
}> {
  const { filePath, symbolName, includeDeclaration = true } = args;

  // Get or create session
  let session;
  if (args.sessionId) {
    session = sessionStore.get(args.sessionId);
  } else if (args.workspaceRoot) {
    session = sessionStore.create(args.workspaceRoot);
  } else {
    throw new Error('Either sessionId or workspaceRoot must be provided');
  }

  // Resolve file path
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.join(session.workspaceRoot, filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  // Get LSP client via router
  const lspClient = await languageRouter.getLSPClient(session, absolutePath);
  const lspManager = new LSPManager(lspClient, session);

  // Get document symbols to find the symbol position
  const symbols = await lspManager.getDocumentSymbols(absolutePath) as SymbolInfo[];
  
  if (!symbols || !Array.isArray(symbols)) {
    throw new Error('Failed to get document symbols');
  }

  // Find the target symbol
  const targetSymbol = findSymbol(symbols, symbolName);
  if (!targetSymbol) {
    throw new Error(`Symbol not found: ${symbolName}`);
  }

  // Get the position of the symbol (use start of the symbol name)
  const symbolLine = targetSymbol.range.start.line;
  const symbolChar = targetSymbol.range.start.character;

  logger.debug('Finding references for symbol', {
    symbolName,
    line: toOneBased(symbolLine),
    character: symbolChar,
  });

  // Get references from LSP
  const rawReferences = await lspManager.getReferences(
    absolutePath,
    symbolLine,
    symbolChar
  ) as LSPLocation[] | null;

  if (!rawReferences || !Array.isArray(rawReferences)) {
    return {
      references: [],
      totalCount: 0,
    };
  }

  // Process references
  const references: ReferenceInfo[] = [];
  let definition: ReferenceInfo | undefined;

  for (const ref of rawReferences) {
    const refPath = uriToPath(ref.uri);
    const refLine = toOneBased(ref.range.start.line);
    const refCol = ref.range.start.character;

    // Read context (the line containing the reference)
    let context = '';
    try {
      const fileContent = fs.readFileSync(refPath, 'utf-8');
      const lines = fileContent.split('\n');
      if (ref.range.start.line < lines.length) {
        context = lines[ref.range.start.line].trim();
      }
    } catch (error) {
      logger.warn('Failed to read context', { refPath, error });
    }

    // Check if this is the definition
    const isDefinition = 
      refPath === absolutePath &&
      ref.range.start.line === symbolLine &&
      ref.range.start.character === symbolChar;

    const refInfo: ReferenceInfo = {
      file: refPath,
      line: refLine,
      column: refCol,
      context,
      isDefinition,
    };

    if (isDefinition) {
      definition = refInfo;
      if (includeDeclaration) {
        references.push(refInfo);
      }
    } else {
      references.push(refInfo);
    }
  }

  // Sort references by file and line
  references.sort((a, b) => {
    if (a.file !== b.file) {
      return a.file.localeCompare(b.file);
    }
    return a.line - b.line;
  });

  logger.info('References found', {
    symbolName,
    totalCount: references.length,
    hasDefinition: !!definition,
  });

  return {
    definition,
    references,
    totalCount: references.length,
  };
}

/**
 * Find a symbol by name in the symbol tree
 */
function findSymbol(symbols: SymbolInfo[], name: string): SymbolInfo | null {
  for (const symbol of symbols) {
    // Direct match
    if (symbol.name === name) {
      return symbol;
    }

    // Check children
    if (symbol.children) {
      const found = findSymbol(symbol.children, name);
      if (found) {
        return found;
      }
    }
  }

  // Fuzzy match if no direct match found
  for (const symbol of symbols) {
    if (symbol.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(symbol.name.toLowerCase())) {
      return symbol;
    }

    if (symbol.children) {
      for (const child of symbol.children) {
        if (child.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(child.name.toLowerCase())) {
          return child;
        }
      }
    }
  }

  return null;
}
