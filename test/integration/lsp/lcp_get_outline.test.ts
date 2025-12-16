import { lcpGetOutline } from '../../../src/tools/lcp_get_outline';
import { sessionStore } from '../../../src/core/session';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../fixtures');
const sampleFile = 'sample.py';

describe('lcp_get_outline', () => {
  afterAll(async () => {
    // Clean up all sessions after tests
    await sessionStore.shutdown();
  });

  it('should get file outline with symbol information', async () => {
    const result = await lcpGetOutline({
      workspaceRoot,
      filePath: sampleFile,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    
    // Check for expected symbols
    const symbolNames = result.data!.map(symbol => symbol.name);
    expect(symbolNames).toContain('factorial');
    expect(symbolNames).toContain('fibonacci');
    expect(symbolNames).toContain('Calculator');
    expect(symbolNames).toContain('main');
    
    // Check symbol types
    const factorialSymbol = result.data!.find(symbol => symbol.name === 'factorial');
    expect(factorialSymbol).toBeDefined();
    expect(factorialSymbol!.kind).toBe('Function');
    
    const calculatorSymbol = result.data!.find(symbol => symbol.name === 'Calculator');
    expect(calculatorSymbol).toBeDefined();
    expect(calculatorSymbol!.kind).toBe('Class');
    
    // Check that Calculator has methods
    expect(calculatorSymbol!.children).toBeDefined();
    expect(Array.isArray(calculatorSymbol!.children)).toBe(true);
    expect(calculatorSymbol!.children!.length).toBeGreaterThan(0);
    
    const calculatorMethodNames = calculatorSymbol!.children!.map(child => child.name);
    expect(calculatorMethodNames).toContain('__init__');
    expect(calculatorMethodNames).toContain('add');
    expect(calculatorMethodNames).toContain('subtract');
    expect(calculatorMethodNames).toContain('multiply');
    expect(calculatorMethodNames).toContain('divide');
    
    // Check that methods have correct kind
    const addMethod = calculatorSymbol!.children!.find(child => child.name === 'add');
    expect(addMethod).toBeDefined();
    expect(addMethod!.kind).toBe('Method');
  });

  it('should work with existing session', async () => {
    // First create a session
    const result1 = await lcpGetOutline({
      workspaceRoot,
      filePath: sampleFile,
    });
    
    expect(result1.success).toBe(true);
    expect(result1.data).toBeDefined();
    
    // Get sessionId from the sessionStore
    const sessionIds = sessionStore.getAllIds();
    expect(sessionIds.length).toBeGreaterThan(0);
    
    // Use the existing session
    const result2 = await lcpGetOutline({
      sessionId: sessionIds[0],
      filePath: sampleFile,
    });
    
    expect(result2.success).toBe(true);
    expect(result2.data).toBeDefined();
    expect(Array.isArray(result2.data)).toBe(true);
  });

  it('should throw error if neither sessionId nor workspaceRoot is provided', async () => {
    const result = await lcpGetOutline({
      filePath: sampleFile,
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('Either sessionId or workspaceRoot must be provided');
  });

  it('should throw error if file does not exist', async () => {
    const result = await lcpGetOutline({
      workspaceRoot,
      filePath: 'nonexistent.py',
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('File not found');
  });
});
