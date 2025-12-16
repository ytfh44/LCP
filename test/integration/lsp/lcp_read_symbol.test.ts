import { lcpReadSymbol } from '../../../src/tools/lcp_read_symbol';
import { sessionStore } from '../../../src/core/session';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../fixtures');
const sampleFile = 'sample.py';

describe('lcp_read_symbol', () => {
  afterAll(async () => {
    // Clean up all sessions after tests
    await sessionStore.shutdown();
  });

  it('should read function code', async () => {
    const result = await lcpReadSymbol({
      workspaceRoot,
      filePath: sampleFile,
      symbolName: 'factorial',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(typeof result.data).toBe('string');
    expect(result.data!.includes('def factorial(n: int) -> int:')).toBe(true);
    expect(result.data!.includes('return n * factorial(n - 1)')).toBe(true);
  });

  it('should read class code', async () => {
    const result = await lcpReadSymbol({
      workspaceRoot,
      filePath: sampleFile,
      symbolName: 'Calculator',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(typeof result.data).toBe('string');
    expect(result.data!.includes('class Calculator:')).toBe(true);
    expect(result.data!.includes('def __init__(self):')).toBe(true);
    expect(result.data!.includes('def add(self, x: float, y: float) -> float:')).toBe(true);
    expect(result.data!.includes('def subtract(self, x: float, y: float) -> float:')).toBe(true);
    expect(result.data!.includes('def multiply(self, x: float, y: float) -> float:')).toBe(true);
    expect(result.data!.includes('def divide(self, x: float, y: float) -> float:')).toBe(true);
  });

  it('should read method code', async () => {
    const result = await lcpReadSymbol({
      workspaceRoot,
      filePath: sampleFile,
      symbolName: 'add',
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(typeof result.data).toBe('string');
    expect(result.data!.includes('def add(self, x: float, y: float) -> float:')).toBe(true);
    expect(result.data!.includes('self.result = x + y')).toBe(true);
    expect(result.data!.includes('return self.result')).toBe(true);
  });

  it('should work with existing session', async () => {
    // First create a session by calling another tool
    await lcpReadSymbol({
      workspaceRoot,
      filePath: sampleFile,
      symbolName: 'factorial',
    });
    
    // Get sessionId from the sessionStore
    const sessionIds = sessionStore.getAllIds();
    expect(sessionIds.length).toBeGreaterThan(0);
    
    // Use the existing session
    const result = await lcpReadSymbol({
      sessionId: sessionIds[0],
      filePath: sampleFile,
      symbolName: 'fibonacci',
    });
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(typeof result.data).toBe('string');
    expect(result.data!.includes('def fibonacci(n: int) -> int:')).toBe(true);
  });

  it('should throw error if symbol does not exist', async () => {
    const result = await lcpReadSymbol({
      workspaceRoot,
      filePath: sampleFile,
      symbolName: 'nonexistent_symbol',
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('Symbol not found');
  });

  it('should throw error if file does not exist', async () => {
    const result = await lcpReadSymbol({
      workspaceRoot,
      filePath: 'nonexistent.py',
      symbolName: 'factorial',
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('File not found');
  });
});
