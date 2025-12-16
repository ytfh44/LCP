
import path from 'path';
import { fileURLToPath } from 'url';

console.log('Starting import check...');

try {
  const { lcpGetOutline } = await import('../dist/tools/lcp_get_outline.js');
  console.log('lcpGetOutline imported successfully');
  
  const { lcpReadSymbol } = await import('../dist/tools/lcp_read_symbol.js');
  console.log('lcpReadSymbol imported successfully');
  
  const { sessionStore } = await import('../dist/core/session.js');
  console.log('sessionStore imported successfully');
  
  console.log('All imports successful');
} catch (error) {
  console.error('Import failed:', error);
}
