/**
 * Session persistence - Serialize and deserialize session state
 */

import fs from 'fs';
import path from 'path';
import { sessionStore } from './session.js';
import type { Session, BreakpointInfo, DiagnosticInfo } from './types.js';
import { logger } from '../utils/logger.js';

/**
 * Serialized session data for persistence
 */
export interface SerializedSession {
  id: string;
  workspaceRoot: string;
  breakpoints: BreakpointInfo[];
  diagnostics: Record<string, DiagnosticInfo[]>;
  openFiles: string[];
  savedAt: string;
}

/**
 * Session persistence manager
 */
export class SessionPersistence {
  private readonly storageDir: string;

  constructor(storageDir?: string) {
    this.storageDir = storageDir || path.join(process.cwd(), '.lcp-sessions');
  }

  /**
   * Serialize a session to a portable format
   */
  serialize(session: Session, breakpoints: BreakpointInfo[]): SerializedSession {
    // Convert Map to Object for JSON serialization
    const diagnostics: Record<string, DiagnosticInfo[]> = {};
    for (const [file, diags] of session.diagnostics.entries()) {
      diagnostics[file] = diags;
    }

    return {
      id: session.id,
      workspaceRoot: session.workspaceRoot,
      breakpoints,
      diagnostics,
      openFiles: Array.from(session.openFiles),
      savedAt: new Date().toISOString(),
    };
  }

  /**
   * Save session to file
   */
  async saveToFile(session: Session, breakpoints: BreakpointInfo[]): Promise<string> {
    // Ensure storage directory exists
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    const serialized = this.serialize(session, breakpoints);
    const filePath = path.join(this.storageDir, `${session.id}.json`);

    fs.writeFileSync(filePath, JSON.stringify(serialized, null, 2), 'utf-8');
    logger.info('Session saved to file', { sessionId: session.id, filePath });

    return filePath;
  }

  /**
   * Load session from file
   */
  async loadFromFile(filePath: string): Promise<SerializedSession> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Session file not found: ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content) as SerializedSession;

    logger.info('Session loaded from file', { sessionId: data.id, filePath });
    return data;
  }

  /**
   * Restore a session from serialized data
   */
  restoreSession(data: SerializedSession): Session {
    // Create a new session with the same workspace root
    const session = sessionStore.create(data.workspaceRoot);

    // Restore diagnostics
    for (const [file, diags] of Object.entries(data.diagnostics)) {
      session.diagnostics.set(file, diags);
    }

    // Note: openFiles are just tracked, actual LSP didOpen needs to be called separately
    // This is handled when the files are actually accessed

    logger.info('Session restored', {
      sessionId: session.id,
      originalId: data.id,
      breakpointCount: data.breakpoints.length,
    });

    return session;
  }

  /**
   * List all saved sessions
   */
  listSavedSessions(): SerializedSession[] {
    if (!fs.existsSync(this.storageDir)) {
      return [];
    }

    const files = fs.readdirSync(this.storageDir).filter(f => f.endsWith('.json'));
    const sessions: SerializedSession[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.storageDir, file), 'utf-8');
        sessions.push(JSON.parse(content) as SerializedSession);
      } catch (error) {
        logger.warn('Failed to parse session file', { file, error });
      }
    }

    // Sort by savedAt descending
    sessions.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

    return sessions;
  }

  /**
   * Delete a saved session file
   */
  deleteSavedSession(sessionId: string): boolean {
    const filePath = path.join(this.storageDir, `${sessionId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info('Session file deleted', { sessionId, filePath });
      return true;
    }
    return false;
  }

  /**
   * Clean up old session files (older than maxAge days)
   */
  cleanup(maxAgeDays: number = 7): number {
    if (!fs.existsSync(this.storageDir)) {
      return 0;
    }

    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    const files = fs.readdirSync(this.storageDir).filter(f => f.endsWith('.json'));
    let deleted = 0;

    for (const file of files) {
      const filePath = path.join(this.storageDir, file);
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content) as SerializedSession;
        const age = now - new Date(data.savedAt).getTime();

        if (age > maxAgeMs) {
          fs.unlinkSync(filePath);
          deleted++;
          logger.debug('Old session file deleted', { file, ageDays: Math.round(age / (24 * 60 * 60 * 1000)) });
        }
      } catch (error) {
        logger.warn('Failed to check session file', { file, error });
      }
    }

    if (deleted > 0) {
      logger.info('Old session files cleaned up', { deleted, maxAgeDays });
    }

    return deleted;
  }
}

// Global persistence instance
export const sessionPersistence = new SessionPersistence();
