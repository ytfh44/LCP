import { lcpGetDiagnostics } from '../../../src/tools/lcp_get_diagnostics';
import { sessionStore } from '../../../src/core/session';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../fixtures');
const sampleFile = 'sample.py';
const testFileWithError = 'test_with_error.py';

describe('lcp_get_diagnostics', () => {
  let testFilePath: string;

  beforeAll(() => {
    // Create a test file with an error for testing diagnostics
    testFilePath = path.join(workspaceRoot, testFileWithError);
    const content = `
# This file has an error
undefined_variable = some_undefined_value
`;
    fs.writeFileSync(testFilePath, content);
  });

  afterAll(async () => {
    // Clean up all sessions and test files after tests
    await sessionStore.shutdown();
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
    }
  });

  it('should get diagnostics for a file with errors', async () => {
    const result = await lcpGetDiagnostics({
      workspaceRoot,
      filePath: testFileWithError,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    
    // The test file should have at least one diagnostic error
    expect(result.data!.length).toBeGreaterThan(0);
    
    // Check that the diagnostic has expected properties
    const diagnostic = result.data![0];
    expect(diagnostic.message).toBeDefined();
    expect(diagnostic.severity).toBeDefined();
    expect(diagnostic.line).toBeDefined();
  });

  it('should get diagnostics for a file without errors', async () => {
    const result = await lcpGetDiagnostics({
      workspaceRoot,
      filePath: sampleFile,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    
    // The sample file should have no errors (or just warnings)
    // We can't be sure if it will have warnings, so we just check that it doesn't throw an error
  });

  it('should get diagnostics for the entire workspace', async () => {
    const result = await lcpGetDiagnostics({
      workspaceRoot,
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    
    // The workspace should have at least one diagnostic from the test file
    expect(result.data!.length).toBeGreaterThan(0);
  });

  it('should work with existing session', async () => {
    // First create a session by calling another tool
    await lcpGetDiagnostics({
      workspaceRoot,
      filePath: sampleFile,
    });
    
    // Get sessionId from the sessionStore
    const sessionIds = sessionStore.getAllIds();
    expect(sessionIds.length).toBeGreaterThan(0);
    
    // Use the existing session
    const result = await lcpGetDiagnostics({
      sessionId: sessionIds[0],
      filePath: sampleFile,
    });
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('should throw error if file does not exist', async () => {
    const result = await lcpGetDiagnostics({
      workspaceRoot,
      filePath: 'nonexistent.py',
    });
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.message).toContain('File not found');
  });
});
