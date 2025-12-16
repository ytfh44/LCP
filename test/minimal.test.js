
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Minimal ESM', () => {
  it('should work', () => {
    console.log(__dirname);
    expect(true).toBe(true);
  });
});
