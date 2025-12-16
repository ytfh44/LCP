
import path from 'path';
import { fileURLToPath } from 'url';
import { lcpGetOutline } from '../dist/tools/lcp_get_outline.js';
import { lcpReadSymbol } from '../dist/tools/lcp_read_symbol.js';
import { lcpGetDiagnostics } from '../dist/tools/lcp_get_diagnostics.js';
import { lcpDebugLaunch } from '../dist/tools/lcp_debug_launch.js';
import { lcpAddBreakpoint } from '../dist/tools/lcp_add_breakpoint.js';
import { lcpDebugStep } from '../dist/tools/lcp_debug_step.js';
import { lcpDebugEvaluate } from '../dist/tools/lcp_debug_evaluate.js';
import { lcpDebugStop } from '../dist/tools/lcp_debug_stop.js';
import { sessionStore } from '../dist/core/session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workspaceRoot = path.resolve(__dirname, 'fixtures');
const sampleFile = 'sample.py';
let sessionId;

async function runTests() {
  console.log('Starting Manual Tests...');
  
  try {

    // LSP Tools
    console.log('\nTesting LSP Tools (SKIPPED for diagnosis)...');
    /*
    console.log('1. lcp_get_outline');
    const outline = await lcpGetOutline({
      workspaceRoot,
      filePath: sampleFile,
    });
    if (!Array.isArray(outline) || !outline.find(s => s.name === 'factorial')) {
      throw new Error('lcp_get_outline failed');
    }
    console.log('   ✅ Passed');

    console.log('2. lcp_read_symbol');
    const symbol = await lcpReadSymbol({
      workspaceRoot,
      filePath: sampleFile,
      symbolName: 'factorial',
    });
    if (typeof symbol !== 'string' || !symbol.includes('def factorial')) {
      throw new Error('lcp_read_symbol failed');
    }
    console.log('   ✅ Passed');

    console.log('3. lcp_get_diagnostics');
    const diagnostics = await lcpGetDiagnostics({
      workspaceRoot,
      filePath: sampleFile,
    });
    if (!Array.isArray(diagnostics)) {
      throw new Error('lcp_get_diagnostics failed');
    }
    console.log('   ✅ Passed');
    */

    // DAP Tools
    console.log('\nTesting DAP Tools...');
    
    console.log('4. lcp_debug_launch');
    const launchResult = await lcpDebugLaunch({
      workspaceRoot,
      program: sampleFile,
    });
    if (!launchResult.sessionId || launchResult.status !== 'started') {
      throw new Error('lcp_debug_launch failed');
    }
    sessionId = launchResult.sessionId;
    console.log('   ✅ Passed (Session ID: ' + sessionId + ')');

    console.log('5. lcp_add_breakpoint');
    const bpResult = await lcpAddBreakpoint({
      sessionId,
      file: sampleFile,
      line: 53,
    });
    if (!bpResult.verified) {
      console.warn('   ⚠️ Breakpoint not verified immediately (expected for some adapters)');
    } else {
      console.log('   ✅ Passed');
    }

    console.log('6. lcp_debug_step (continue)');
    const continueResult = await lcpDebugStep({
      sessionId,
      action: 'continue',
    });
    if (continueResult.status !== 'stopped' || continueResult.reason !== 'breakpoint') {
      throw new Error('lcp_debug_step (continue) failed');
    }
    console.log('   ✅ Passed (Stopped at line ' + continueResult.currentLine + ')');

    console.log('7. lcp_debug_evaluate');
    const evalResult = await lcpDebugEvaluate({
      sessionId,
      expression: 'i',
    });
    if (evalResult.value !== '0') {
      throw new Error(`lcp_debug_evaluate failed: expected '0', got '${evalResult.value}'`);
    }
    console.log('   ✅ Passed');

    console.log('8. lcp_debug_step (next)');
    const nextResult = await lcpDebugStep({
      sessionId,
      action: 'next',
    });
    if (nextResult.status !== 'stopped') {
      throw new Error('lcp_debug_step (next) failed');
    }
    console.log('   ✅ Passed');

    console.log('9. lcp_debug_stop');
    const stopResult = await lcpDebugStop({
      sessionId,
    });
    if (!stopResult.success) {
      throw new Error('lcp_debug_stop failed');
    }
    console.log('   ✅ Passed');

  } catch (error) {
    console.error('\n❌ Test Failed:', error);
    process.exit(1);
  } finally {
    await sessionStore.shutdown();
  }
}

runTests();
