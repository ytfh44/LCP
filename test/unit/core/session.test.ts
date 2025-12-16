import { SessionStore } from '../../../src/core/session';

describe('SessionStore', () => {
  let sessionStore: SessionStore;
  const workspaceRoot = '/test/workspace';

  beforeEach(() => {
    // Create a new SessionStore instance for each test
    sessionStore = new SessionStore(1000); // 1 second timeout for testing
  });

  afterEach(() => {
    // Clean up after each test
    jest.clearAllTimers();
  });

  describe('create', () => {
    it('should create a new session with the provided workspace root', () => {
      const session = sessionStore.create(workspaceRoot);
      
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.workspaceRoot).toBe(workspaceRoot);
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastAccessedAt).toBeInstanceOf(Date);
      expect(session.openFiles).toBeInstanceOf(Set);
      expect(session.diagnostics).toBeInstanceOf(Map);
    });

    it('should generate unique session IDs', () => {
      const session1 = sessionStore.create(workspaceRoot);
      const session2 = sessionStore.create(workspaceRoot);
      
      expect(session1.id).not.toBe(session2.id);
    });
  });

  describe('get', () => {
    it('should return the session with the provided ID', () => {
      const session = sessionStore.create(workspaceRoot);
      const retrievedSession = sessionStore.get(session.id);
      
      expect(retrievedSession).toBe(session);
    });

    it('should update the last accessed time when getting a session', () => {
      const session = sessionStore.create(workspaceRoot);
      const initialLastAccessedAt = session.lastAccessedAt.getTime();
      
      // Wait a bit to ensure the time changes
      setTimeout(() => {
        const retrievedSession = sessionStore.get(session.id);
        expect(retrievedSession.lastAccessedAt.getTime()).toBeGreaterThan(initialLastAccessedAt);
      }, 10);
    });

    it('should throw an error if the session does not exist', () => {
      expect(() => {
        sessionStore.get('non-existent-session-id');
      }).toThrow();
    });
  });

  describe('has', () => {
    it('should return true if the session exists', () => {
      const session = sessionStore.create(workspaceRoot);
      
      expect(sessionStore.has(session.id)).toBe(true);
    });

    it('should return false if the session does not exist', () => {
      expect(sessionStore.has('non-existent-session-id')).toBe(false);
    });
  });

  describe('getAllIds', () => {
    it('should return all session IDs', () => {
      const session1 = sessionStore.create(workspaceRoot);
      const session2 = sessionStore.create(workspaceRoot);
      
      const sessionIds = sessionStore.getAllIds();
      
      expect(sessionIds).toHaveLength(2);
      expect(sessionIds).toContain(session1.id);
      expect(sessionIds).toContain(session2.id);
    });

    it('should return an empty array if there are no sessions', () => {
      const sessionIds = sessionStore.getAllIds();
      
      expect(sessionIds).toEqual([]);
    });
  });

  describe('delete', () => {
    it('should delete the session with the provided ID', async () => {
      const session = sessionStore.create(workspaceRoot);
      
      await sessionStore.delete(session.id);
      
      expect(sessionStore.has(session.id)).toBe(false);
    });

    it('should not throw an error if deleting a non-existent session', async () => {
      await expect(sessionStore.delete('non-existent-session-id')).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should delete expired sessions', () => {
      const session = sessionStore.create(workspaceRoot);
      
      // Manually set the last accessed time to be in the past
      session.lastAccessedAt = new Date(Date.now() - 2000); // 2 seconds ago
      
      // Call cleanup
      sessionStore['cleanup']();
      
      expect(sessionStore.has(session.id)).toBe(false);
    });

    it('should not delete non-expired sessions', () => {
      const session = sessionStore.create(workspaceRoot);
      
      // Call cleanup immediately after creating the session
      sessionStore['cleanup']();
      
      expect(sessionStore.has(session.id)).toBe(true);
    });
  });

  describe('shutdown', () => {
    it('should delete all sessions and clear the cleanup interval', async () => {
      sessionStore.create(workspaceRoot);
      sessionStore.create(workspaceRoot);
      
      await sessionStore.shutdown();
      
      expect(sessionStore.getAllIds()).toEqual([]);
    });
  });
});
