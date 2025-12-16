/**
 * Session management system
 */

import { v4 as uuidv4 } from 'uuid';
import type { Session } from './types.js';
import { logger } from '../utils/logger.js';
import { SessionError } from '../utils/error-handler.js';

/**
 * Session store with automatic cleanup
 */
export class SessionStore {
  private sessions = new Map<string, Session>();
  private cleanupInterval: NodeJS.Timeout;
  private sessionTimeout: number;

  constructor(sessionTimeoutMs = 30 * 60 * 1000) {
    // 30 minutes default
    this.sessionTimeout = sessionTimeoutMs;

    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Create a new session
   */
  create(workspaceRoot: string): Session {
    const session: Session = {
      id: uuidv4(),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      workspaceRoot,
      lspClients: new Map(),
      openFiles: new Set(),
      diagnostics: new Map(),
    };

    this.sessions.set(session.id, session);
    logger.info('Session created', {
      sessionId: session.id,
      workspaceRoot,
    });

    return session;
  }

  /**
   * Get session by ID
   */
  get(sessionId: string): Session {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new SessionError(`Session not found: ${sessionId}`);
    }

    // Update last accessed time
    session.lastAccessedAt = new Date();
    return session;
  }

  /**
   * Check if session exists
   */
  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Delete session and cleanup resources
   */
  async delete(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    logger.info('Deleting session', { sessionId });

    // Cleanup legacy LSP client
    if (session.lspClient) {
      try {
        await session.lspClient.shutdown();
      } catch (error) {
        logger.warn('Error shutting down legacy LSP client', { error, sessionId });
      }
    }

    // Cleanup all LSP clients (multi-language support)
    for (const [languageType, client] of session.lspClients.entries()) {
      try {
        await client.shutdown();
        logger.debug('LSP client shutdown', { languageType, sessionId });
      } catch (error) {
        logger.warn('Error shutting down LSP client', { error, sessionId, languageType });
      }
    }
    session.lspClients.clear();

    // Cleanup DAP client
    if (session.dapClient) {
      try {
        await session.dapClient.disconnect();
      } catch (error) {
        logger.warn('Error disconnecting DAP client', { error, sessionId });
      }
    }

    this.sessions.delete(sessionId);
    logger.info('Session deleted', { sessionId });
  }

  /**
   * Get all session IDs
   */
  getAllIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Cleanup expired sessions
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [id, session] of this.sessions.entries()) {
      const timeSinceLastAccess = now - session.lastAccessedAt.getTime();
      if (timeSinceLastAccess > this.sessionTimeout) {
        expiredSessions.push(id);
      }
    }

    if (expiredSessions.length > 0) {
      logger.info('Cleaning up expired sessions', {
        count: expiredSessions.length,
        sessionIds: expiredSessions,
      });

      for (const id of expiredSessions) {
        this.delete(id).catch((error) => {
          logger.error('Error deleting expired session', { error, sessionId: id });
        });
      }
    }
  }

  /**
   * Shutdown and cleanup all sessions
   */
  async shutdown(): Promise<void> {
    clearInterval(this.cleanupInterval);

    logger.info('Shutting down all sessions', {
      count: this.sessions.size,
    });

    const deletePromises = Array.from(this.sessions.keys()).map((id) =>
      this.delete(id)
    );

    await Promise.all(deletePromises);
  }
}

// Global session store instance
export const sessionStore = new SessionStore();
