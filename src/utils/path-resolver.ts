/**
 * File path resolution utilities with fuzzy matching
 */

import path from 'path';
import fs from 'fs';
import { FileError } from './error-handler.js';


/**
 * Convert file path to URI format
 */
export function pathToUri(filePath: string): string {
  const absolutePath = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(filePath);
  return `file:///${absolutePath.replace(/\\/g, '/')}`;
}

/**
 * Convert URI to file path
 */
export function uriToPath(uri: string): string {
  if (uri.startsWith('file:///')) {
    return uri.substring(8).replace(/\//g, path.sep);
  }
  if (uri.startsWith('file://')) {
    return uri.substring(7).replace(/\//g, path.sep);
  }
  return uri;
}

/**
 * Resolve relative path to absolute path
 */
export function resolveRelativePath(
  relativePath: string,
  workspaceRoot: string
): string {
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }
  return path.resolve(workspaceRoot, relativePath);
}

/**
 * Find files matching a pattern (fuzzy search)
 */
export function findMatchingFiles(
  pattern: string,
  workspaceRoot: string
): string[] {
  const matches: string[] = [];
  const normalizedPattern = pattern.toLowerCase().replace(/\\/g, '/');

  function searchDir(dir: string, relativePath = '') {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        const entryRelativePath = path.join(relativePath, entry.name);
        const normalizedPath = entryRelativePath
          .toLowerCase()
          .replace(/\\/g, '/');

        if (entry.isDirectory()) {
          // Skip node_modules and hidden directories
          if (
            !entry.name.startsWith('.') &&
            entry.name !== 'node_modules' &&
            entry.name !== '__pycache__'
          ) {
            searchDir(entryPath, entryRelativePath);
          }
        } else if (entry.isFile()) {
          // Check if file matches pattern
          if (
            normalizedPath.includes(normalizedPattern) ||
            entry.name.toLowerCase() === normalizedPattern
          ) {
            matches.push(entryRelativePath);
          }
        }
      }
    } catch {
      // Ignore permission errors
    }
  }

  searchDir(workspaceRoot);
  return matches;
}

/**
 * Resolve file path with fuzzy matching
 */
export function resolvePath(
  filePath: string,
  workspaceRoot: string
): string {
  // Try direct resolution first
  const absolutePath = resolveRelativePath(filePath, workspaceRoot);
  if (fs.existsSync(absolutePath)) {
    return absolutePath;
  }

  // Try fuzzy matching
  const matches = findMatchingFiles(filePath, workspaceRoot);

  if (matches.length === 0) {
    throw new FileError(`File not found: ${filePath}`, {
      searchPath: filePath,
      workspaceRoot,
    });
  }

  if (matches.length === 1) {
    return resolveRelativePath(matches[0], workspaceRoot);
  }

  // Multiple matches - throw error with suggestions
  throw new FileError(
    `Multiple files match "${filePath}". Please be more specific.`,
    {
      searchPath: filePath,
      suggestions: matches,
    }
  );
}

/**
 * Check if file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/**
 * Get relative path from workspace root
 */
export function getRelativePath(
  absolutePath: string,
  workspaceRoot: string
): string {
  return path.relative(workspaceRoot, absolutePath);
}
