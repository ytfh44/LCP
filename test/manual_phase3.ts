
import { lcpCompletion } from '../src/tools/lcp_completion.js';
import { lcpRenameSymbol } from '../src/tools/lcp_rename_symbol.js';
import { lcpFormatDocument } from '../src/tools/lcp_format_document.js';
import { sessionStore } from '../src/core/session.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, 'fixtures');
const sampleFile = 'sample.py'; // Make sure this file exists in test/fixtures

async function run() {
  console.log('Starting Manual Verification for Phase 3...');

  try {
    // 1. Completion
    console.log('\n--- Testing lcp_completion ---');
    // Line 14: "        self.result += n"
    const completionResult = await lcpCompletion({
      workspaceRoot,
      filePath: sampleFile,
      line: 14,
      character: 12
    });
    console.log('Completion Result:', JSON.stringify(completionResult, null, 2).substring(0, 200) + '...');

    // 2. Rename
    console.log('\n--- Testing lcp_rename_symbol ---');
    // Rename 'Calculator' at Line 10
    const renameResult = await lcpRenameSymbol({
      workspaceRoot,
      filePath: sampleFile,
      line: 10,
      character: 6,
      newName: 'Calc'
    });
    console.log('Rename Result:', JSON.stringify(renameResult, null, 2));

    // 3. Format
    console.log('\n--- Testing lcp_format_document ---');
    const formatResult = await lcpFormatDocument({
        workspaceRoot,
        filePath: sampleFile
    });
    console.log('Format Result:', JSON.stringify(formatResult, null, 2));

  } catch (error) {
    console.error('Test Failed:', error);
  } finally {
    await sessionStore.shutdown();
    console.log('\nDone.');
  }
}

run();
