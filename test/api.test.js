

import path from 'path';
import { fileURLToPath } from 'url';
// import { lcpGetOutline } from '../dist/tools/lcp_get_outline.js';
// import { lcpReadSymbol } from '../dist/tools/lcp_read_symbol.js';
// import { lcpGetDiagnostics } from '../dist/tools/lcp_get_diagnostics.js';
// import { lcpDebugLaunch } from '../dist/tools/lcp_debug_launch.js';
// import { lcpAddBreakpoint } from '../dist/tools/lcp_add_breakpoint.js';
// import { lcpDebugStep } from '../dist/tools/lcp_debug_step.js';
// import { lcpDebugEvaluate } from '../dist/tools/lcp_debug_evaluate.js';
// import { lcpDebugStop } from '../dist/tools/lcp_debug_stop.js';
// import { sessionStore } from '../dist/core/session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Increase timeout for DAP operations
// jest.setTimeout(30000);

describe('LCP API Integration Tests', () => {
  const workspaceRoot = path.resolve(__dirname, 'fixtures');
  const sampleFile = 'sample.py';
  let sessionId;


  beforeAll(async () => {
    console.log('Starting beforeAll');
    // Ensure clean state
    try {
      await sessionStore.shutdown();
      console.log('sessionStore shutdown complete');
    } catch (e) {
      console.error('sessionStore shutdown failed', e);
    }
  });

  afterAll(async () => {
    await sessionStore.shutdown();
  });

  describe('LSP Tools', () => {
    it('should get file outline', async () => {
      const result = await lcpGetOutline({
        workspaceRoot,
        filePath: sampleFile,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      
      // Check for expected symbols
      const names = result.map(s => s.name);
      expect(names).toContain('factorial');
      expect(names).toContain('fibonacci');
      expect(names).toContain('Calculator');
      expect(names).toContain('main');
    });

    it('should read symbol code', async () => {
      const result = await lcpReadSymbol({
        workspaceRoot,
        filePath: sampleFile,
        symbolName: 'factorial',
      });

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toContain('def factorial(n: int) -> int:');
      expect(result).toContain('return n * factorial(n - 1)');
    });

    it('should get diagnostics', async () => {
      const result = await lcpGetDiagnostics({
        workspaceRoot,
        filePath: sampleFile,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });


/*
  describe('DAP Tools', () => {
    it('should launch debug session', async () => {
      const result = await lcpDebugLaunch({
        workspaceRoot,
        program: sampleFile,
      });

      expect(result).toBeDefined();
      expect(result.sessionId).toBeDefined();
      expect(result.status).toBe('started');
      
      sessionId = result.sessionId;
    });

    it('should add breakpoint', async () => {
      // Line 53 is inside the loop in main(): print(f"factorial({i}) = {factorial(i)}")
      const result = await lcpAddBreakpoint({
        sessionId,
        file: sampleFile,
        line: 53,
      });

      expect(result).toBeDefined();
      // Verification might fail if debugpy hasn't fully initialized or file path mapping is off
      // But we expect it to work
      expect(result.verified).toBe(true);
    });

    it('should continue to breakpoint', async () => {
      const result = await lcpDebugStep({
        sessionId,
        action: 'continue',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('stopped');
      expect(result.reason).toBe('breakpoint');
      // Line might vary slightly depending on how python reports it, but should be around 53
      expect(result.currentLine).toBe(53);
    });

    it('should evaluate expression', async () => {
      const result = await lcpDebugEvaluate({
        sessionId,
        expression: 'i',
      });

      expect(result).toBeDefined();
      expect(result.value).toBe('0'); // First iteration
    });

    it('should step over', async () => {
      const result = await lcpDebugStep({
        sessionId,
        action: 'next',
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('stopped');
    });

    it('should stop debug session', async () => {
      const result = await lcpDebugStop({
        sessionId,
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });
*/
});
