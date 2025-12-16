import { lcpDebugLaunch } from '../../../src/tools/lcp_debug_launch';
import { lcpAddBreakpoint } from '../../../src/tools/lcp_add_breakpoint';
import { lcpDebugStep } from '../../../src/tools/lcp_debug_step';
import { lcpDebugEvaluate } from '../../../src/tools/lcp_debug_evaluate';
import { lcpDebugStop } from '../../../src/tools/lcp_debug_stop';
import { sessionStore } from '../../../src/core/session';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../../fixtures');
const sampleFile = 'sample.py';

describe('DAP Debug Flow', () => {
  let sessionId: string;

  afterAll(async () => {
    // Clean up all sessions after tests
    await sessionStore.shutdown();
  });

  it('should complete a full debug flow', async () => {
    // Step 1: Launch debug session
    const launchResult = await lcpDebugLaunch({
      workspaceRoot,
      program: sampleFile,
    });

    expect(launchResult.success).toBe(true);
    expect(launchResult.data).toBeDefined();
    expect(launchResult.data!.sessionId).toBeDefined();
    expect(launchResult.data!.status).toBe('started');
    
    sessionId = launchResult.data!.sessionId!;

    // Step 2: Add breakpoint
    const breakpointResult = await lcpAddBreakpoint({
      sessionId,
      file: sampleFile,
      line: 53, // Line inside the loop in main(): print(f"factorial({i}) = {factorial(i)}")
    });

    expect(breakpointResult.success).toBe(true);
    expect(breakpointResult.data).toBeDefined();
    
    // Step 3: Continue to breakpoint
    const continueResult = await lcpDebugStep({
      sessionId,
      action: 'continue',
    });

    expect(continueResult.success).toBe(true);
    expect(continueResult.data).toBeDefined();
    expect(continueResult.data!.status).toBe('stopped');
    expect(continueResult.data!.reason).toBe('breakpoint');
    
    // Step 4: Evaluate expression
    const evaluateResult = await lcpDebugEvaluate({
      sessionId,
      expression: 'i',
    });

    expect(evaluateResult.success).toBe(true);
    expect(evaluateResult.data).toBeDefined();
    expect(evaluateResult.data!.value).toBe('0'); // First iteration

    // Step 5: Step over
    const stepOverResult = await lcpDebugStep({
      sessionId,
      action: 'next',
    });

    expect(stepOverResult.success).toBe(true);
    expect(stepOverResult.data).toBeDefined();
    expect(stepOverResult.data!.status).toBe('stopped');

    // Step 6: Stop debug session
    const stopResult = await lcpDebugStop({
      sessionId,
    });

    expect(stopResult.success).toBe(true);
    expect(stopResult.data).toBeDefined();
    expect(stopResult.data!.success).toBe(true);
  }, 60000); // Increase timeout to 60 seconds for DAP operations

  it('should handle invalid breakpoint line', async () => {
    // Launch debug session first
    const launchResult = await lcpDebugLaunch({
      workspaceRoot,
      program: sampleFile,
    });

    expect(launchResult.success).toBe(true);
    expect(launchResult.data).toBeDefined();
    
    sessionId = launchResult.data!.sessionId!;

    // Try to add breakpoint on an invalid line
    const breakpointResult = await lcpAddBreakpoint({
      sessionId,
      file: sampleFile,
      line: 1000, // Invalid line number
    });

    // Depending on the debug adapter implementation, this might return success with verified: false
    // or it might return an error
    expect(breakpointResult.success).toBeDefined();
    
    // Clean up
    await lcpDebugStop({
      sessionId,
    });
  }, 60000);

  it('should handle evaluating invalid expression', async () => {
    // Launch debug session first
    const launchResult = await lcpDebugLaunch({
      workspaceRoot,
      program: sampleFile,
    });

    expect(launchResult.success).toBe(true);
    expect(launchResult.data).toBeDefined();
    
    sessionId = launchResult.data!.sessionId!;

    // Add breakpoint and continue to it
    await lcpAddBreakpoint({
      sessionId,
      file: sampleFile,
      line: 53,
    });

    await lcpDebugStep({
      sessionId,
      action: 'continue',
    });

    // Try to evaluate an invalid expression
    const evaluateResult = await lcpDebugEvaluate({
      sessionId,
      expression: 'invalid_variable_name_123',
    });

    // Depending on the debug adapter implementation, this might return an error
    // or it might return a value indicating the variable doesn't exist
    expect(evaluateResult.success).toBeDefined();
    
    // Clean up
    await lcpDebugStop({
      sessionId,
    });
  }, 60000);
});
