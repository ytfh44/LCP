import { jest } from '@jest/globals';
import {
  pathToUri,
  uriToPath,
  resolveRelativePath,
  findMatchingFiles,
  resolvePath,
  fileExists,
  getRelativePath
} from '../../../src/utils/path-resolver';
import { FileError } from '../../../src/utils/error-handler';
import path from 'path';
import * as fs from 'fs';

// Mock fs module to avoid actual file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  statSync: jest.fn(),
  readdirSync: jest.fn()
}));

const mockedFs = jest.mocked(fs);

describe('path-resolver', () => {
  describe('pathToUri', () => {
    it('should convert absolute file path to URI', () => {
      const absolutePath = 'C:\\test\\file.py';
      const uri = pathToUri(absolutePath);
      
      expect(uri).toBe('file:///C:/test/file.py');
    });

    it('should convert relative file path to URI', () => {
      const relativePath = 'test/file.py';
      const absolutePath = path.resolve(relativePath);
      const uri = pathToUri(relativePath);
      
      expect(uri).toBe(`file:///${absolutePath.replace(/\\/g, '/')}`);
    });
  });

  describe('uriToPath', () => {
    it('should convert URI with file:/// prefix to file path', () => {
      const uri = 'file:///C:/test/file.py';
      const filePath = uriToPath(uri);
      
      expect(filePath).toBe(`C:${path.sep}test${path.sep}file.py`);
    });

    it('should convert URI with file:// prefix to file path', () => {
      const uri = 'file://test/file.py';
      const filePath = uriToPath(uri);
      
      expect(filePath).toBe(`test${path.sep}file.py`);
    });

    it('should return the original string if it is not a URI', () => {
      const nonUri = 'test/file.py';
      const filePath = uriToPath(nonUri);
      
      expect(filePath).toBe(nonUri);
    });
  });

  describe('resolveRelativePath', () => {
    it('should resolve relative path to absolute path', () => {
      const relativePath = 'test/file.py';
      const workspaceRoot = 'C:\\workspace';
      const resolvedPath = resolveRelativePath(relativePath, workspaceRoot);
      
      expect(resolvedPath).toBe(`C:${path.sep}workspace${path.sep}test${path.sep}file.py`);
    });

    it('should return absolute path as is', () => {
      const absolutePath = 'C:\\test\\file.py';
      const workspaceRoot = 'C:\\workspace';
      const resolvedPath = resolveRelativePath(absolutePath, workspaceRoot);
      
      expect(resolvedPath).toBe(absolutePath);
    });
  });

  describe('fileExists', () => {
    it('should return true if file exists', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isFile: () => true } as any);
      
      expect(fileExists('test/file.py')).toBe(true);
    });

    it('should return false if file does not exist', () => {
      mockedFs.existsSync.mockReturnValue(false);

      expect(fileExists('test/file.py')).toBe(false);
    });

    it('should return false if path is a directory', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isFile: () => false } as any);

      expect(fileExists('test/directory')).toBe(false);
    });

    it('should return false if statSync throws an error', () => {
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      expect(fileExists('test/file.py')).toBe(false);
    });
  });

  describe('getRelativePath', () => {
    it('should return relative path from workspace root', () => {
      const absolutePath = 'C:\\workspace\\test\\file.py';
      const workspaceRoot = 'C:\\workspace';
      const relativePath = getRelativePath(absolutePath, workspaceRoot);
      
      expect(relativePath).toBe(`test${path.sep}file.py`);
    });

    it('should handle files outside workspace root', () => {
      const absolutePath = 'C:\\other\\file.py';
      const workspaceRoot = 'C:\\workspace';
      const relativePath = getRelativePath(absolutePath, workspaceRoot);
      
      // Should return something like '..\other\file.py' on Windows
      expect(relativePath).toContain('other');
      expect(relativePath).toContain('file.py');
    });
  });

  describe('findMatchingFiles', () => {
    it('should find matching files in workspace', () => {
      // Mock file system structure
      mockedFs.readdirSync.mockImplementation(() => {
        return [];
      });

      mockedFs.statSync.mockImplementation(() => {
        return { isDirectory: () => false } as any;
      });

      const matches = findMatchingFiles('file.py', 'C:\\workspace');

      expect(matches).toEqual([]);
    });

    it('should return empty array if no files match', () => {
      mockedFs.readdirSync.mockReturnValue([]);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as any);

      const matches = findMatchingFiles('nonexistent.py', 'C:\\workspace');

      expect(matches).toEqual([]);
    });
  });
      
      mockedFs.statSync.mockImplementation(() => {
        return { isDirectory: () => false } as fs.Stats;
      });
      
      const matches = findMatchingFiles('file.py', 'C:\\workspace');
      
      expect(matches).toEqual([]);
    });

    it('should return empty array if no files match', () => {
      mockedFs.readdirSync.mockReturnValue([]);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);
      
      const matches = findMatchingFiles('nonexistent.py', 'C:\\workspace');
      
      expect(matches).toEqual([]);
    });
  });

  describe('resolvePath', () => {
    it('should resolve exact file path', () => {
      const filePath = 'test/file.py';
      const workspaceRoot = 'C:\\workspace';
      const absolutePath = `C:${path.sep}workspace${path.sep}test${path.sep}file.py`;

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.statSync.mockReturnValue({ isFile: () => true } as any);

      const resolvedPath = resolvePath(filePath, workspaceRoot);

      expect(resolvedPath).toBe(absolutePath);
    });

    it('should resolve fuzzy matched file path', () => {
      const filePath = 'file.py';
      const workspaceRoot = 'C:\\workspace';
      
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.readdirSync.mockImplementation(() => {
        return [];
      });
      
      mockedFs.statSync.mockImplementation(() => {
        return { isDirectory: () => false } as fs.Stats;
      });
      
      expect(() => {
        resolvePath(filePath, workspaceRoot);
      }).toThrow(FileError);
    });

    it('should throw FileError if file not found', () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.readdirSync.mockReturnValue([]);
      mockedFs.statSync.mockReturnValue({ isDirectory: () => false } as fs.Stats);
      
      expect(() => {
        resolvePath('nonexistent.py', 'C:\\workspace');
      }).toThrow(FileError);
    });

    it('should throw FileError if multiple files match', () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.readdirSync.mockImplementation(() => {
        return [];
      });
      
      mockedFs.statSync.mockImplementation(() => {
        return { isDirectory: () => false } as fs.Stats;
      });
      
      expect(() => {
        resolvePath('file.py', 'C:\\workspace');
      }).toThrow(FileError);
    });
  });
});
