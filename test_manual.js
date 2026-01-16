/**
 * Simple manual test to verify LCP tool functions work
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { lcpGetOutline } from './dist/tools/lcp_get_outline.js';
import { lcpReadSymbol } from './dist/tools/lcp_read_symbol.js';
import { lcpGetDiagnostics } from './dist/tools/lcp_get_diagnostics.js';
import { sessionStore } from './dist/core/session.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workspaceRoot = path.resolve(__dirname, 'test/fixtures');
const sampleFile = 'sample.py';

async function runTests() {
  console.log('=== LCP Manual Verification Test ===\n');

  try {
    // Test 1: Get outline
    console.log('Test 1: Getting file outline...');
    const result = await lcpGetOutline({
      workspaceRoot,
      filePath: sampleFile,
    });
    console.log('Raw outline result:', JSON.stringify(result, null, 2));

    if (!result || !result.success) {
      console.log('✗ Outline failed');
      throw new Error(result?.error?.message || 'Outline failed');
    }

    const outline = result.data;
    if (!Array.isArray(outline)) {
      console.log('✗ Outline is not an array:', typeof outline);
      throw new Error('Outline is not an array');
    }

    console.log(`✓ Outline returned ${outline.length} symbols`);
    console.log(`  Symbols: ${outline.map(s => s.name).slice(0, 5).join(', ')}...`);

    // Test 2: Read symbol
    console.log('\nTest 2: Reading factorial symbol...');
    const symbolResult = await lcpReadSymbol({
      workspaceRoot,
      filePath: sampleFile,
      symbolName: 'factorial',
    });
    console.log('Raw symbol result:', JSON.stringify(symbolResult, null, 2));

    if (!symbolResult || !symbolResult.success) {
      console.log('✗ Symbol read failed');
      throw new Error(symbolResult?.error?.message || 'Symbol read failed');
    }

    const symbolCode = symbolResult.data;
    console.log('✓ Symbol code retrieved');
    console.log(`  Code length: ${symbolCode.length} chars`);
    console.log(`  Contains "def factorial": ${symbolCode.includes('def factorial')}`);

    // Test 3: Get diagnostics
    console.log('\nTest 3: Getting diagnostics...');
    const diagsResult = await lcpGetDiagnostics({
      workspaceRoot,
      filePath: sampleFile,
    });
    console.log('Raw diagnostics result:', JSON.stringify(diagsResult, null, 2));

    if (!diagsResult || !diagsResult.success) {
      console.log('✗ Diagnostics failed');
      throw new Error(diagsResult?.error?.message || 'Diagnostics failed');
    }

    const diagnostics = diagsResult.data;
    console.log(`✓ Diagnostics returned ${diagnostics.length} issues`);

    // Cleanup
    console.log('\nCleaning up session...');
    const sessions = sessionStore.getAllIds();
    for (const sessionId of sessions) {
      await sessionStore.delete(sessionId);
    }
    console.log('✓ Sessions cleaned up');

    console.log('\n=== All tests passed! ===');
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();
