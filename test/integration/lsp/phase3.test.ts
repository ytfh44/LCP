
import { lcpCompletion } from '../../../src/tools/lcp_completion';
import { lcpRenameSymbol } from '../../../src/tools/lcp_rename_symbol';
import { lcpFormatDocument } from '../../../src/tools/lcp_format_document';
import { sessionStore } from '../../../src/core/session';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../fixtures');
const sampleFile = 'sample.py';

describe('Phase 3 LSP Tools', () => {
  afterAll(async () => {
    await sessionStore.shutdown();
  });

  describe('lcp_completion', () => {
    it('should return completion items', async () => {
      // Trying to complete 'self.' inside Calculator or just a common keyword
      // In sample.py:
      // class Calculator:
      //     def __init__(self):
      //         self.result = 0
      
      // Let's try completion for 'self.' at line 14 (inside add method)
      // def add(self, n):
      //     self.result += n
      // Line 14 is "        self.result += n".
      // Let's try inserting at the beginning of line 14 for 'sel'
      
      const result = await lcpCompletion({
        workspaceRoot,
        filePath: sampleFile,
        line: 14,
        character: 12 // "        self".length is 12
      });

      // Note: result depends on what Pyright returns. It should be a CompletionList or CompletionItem[].
      // We just check if we got a response from the server.
      expect(result).toBeDefined();
      // Usually { isIncomplete: boolean, items: [] }
      if (typeof result === 'object' && result !== null && 'items' in result) {
         expect(Array.isArray((result as any).items)).toBe(true);
      } else if (Array.isArray(result)) {
         expect(result.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('lcp_rename_symbol', () => {
    it('should return workspace edit for rename', async () => {
      // Rename 'Calculator' class at line 10
      // class Calculator:
      
      const result = await lcpRenameSymbol({
        workspaceRoot,
        filePath: sampleFile,
        line: 10,
        character: 6, // "class ".length is 6
        newName: 'Calc'
      });

      expect(result).toBeDefined();
      // Should contain changes
      // Structure: { changes: { 'uri': [TextEdit] } } or { documentChanges: ... }
      expect(result).toHaveProperty('changes');
    });
  });

  describe('lcp_format_document', () => {
    it('should return text edits for formatting', async () => {
      const result = await lcpFormatDocument({
        workspaceRoot,
        filePath: sampleFile,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
