import {
  LCPError,
  SessionError,
  FileError,
  SymbolError,
  LSPError,
  DAPError,
  TimeoutError,
  toToolResult,
  withErrorHandling
} from '../../../src/utils/error-handler';
import { ErrorCode } from '../../../src/core/types';

describe('Error Classes', () => {
  describe('LCPError', () => {
    it('should create an instance with the provided code, message, and details', () => {
      const code = ErrorCode.INTERNAL_ERROR;
      const message = 'Test error message';
      const details = { key: 'value' };
      
      const error = new LCPError(code, message, details);
      
      expect(error).toBeInstanceOf(LCPError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('LCPError');
      expect(error.code).toBe(code);
      expect(error.message).toBe(message);
      expect(error.details).toBe(details);
    });

    it('should create an instance without details', () => {
      const code = ErrorCode.INTERNAL_ERROR;
      const message = 'Test error message';
      
      const error = new LCPError(code, message);
      
      expect(error.details).toBeUndefined();
    });
  });

  describe('SessionError', () => {
    it('should create an instance with the correct code and message', () => {
      const message = 'Session not found';
      const error = new SessionError(message);
      
      expect(error).toBeInstanceOf(SessionError);
      expect(error).toBeInstanceOf(LCPError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('SessionError');
      expect(error.code).toBe(ErrorCode.SESSION_NOT_FOUND);
      expect(error.message).toBe(message);
    });
  });

  describe('FileError', () => {
    it('should create an instance with the correct code and message', () => {
      const message = 'File not found';
      const error = new FileError(message);
      
      expect(error).toBeInstanceOf(FileError);
      expect(error).toBeInstanceOf(LCPError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('FileError');
      expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
      expect(error.message).toBe(message);
    });
  });

  describe('SymbolError', () => {
    it('should create an instance with the correct code and message', () => {
      const message = 'Symbol not found';
      const error = new SymbolError(message);
      
      expect(error).toBeInstanceOf(SymbolError);
      expect(error).toBeInstanceOf(LCPError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('SymbolError');
      expect(error.code).toBe(ErrorCode.SYMBOL_NOT_FOUND);
      expect(error.message).toBe(message);
    });
  });

  describe('LSPError', () => {
    it('should create an instance with the correct code and message', () => {
      const message = 'LSP error';
      const error = new LSPError(message);
      
      expect(error).toBeInstanceOf(LSPError);
      expect(error).toBeInstanceOf(LCPError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('LSPError');
      expect(error.code).toBe(ErrorCode.LSP_ERROR);
      expect(error.message).toBe(message);
    });
  });

  describe('DAPError', () => {
    it('should create an instance with the correct code and message', () => {
      const message = 'DAP error';
      const error = new DAPError(message);
      
      expect(error).toBeInstanceOf(DAPError);
      expect(error).toBeInstanceOf(LCPError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('DAPError');
      expect(error.code).toBe(ErrorCode.DAP_ERROR);
      expect(error.message).toBe(message);
    });
  });

  describe('TimeoutError', () => {
    it('should create an instance with the correct code and message', () => {
      const message = 'Timeout error';
      const error = new TimeoutError(message);
      
      expect(error).toBeInstanceOf(TimeoutError);
      expect(error).toBeInstanceOf(LCPError);
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('TimeoutError');
      expect(error.code).toBe(ErrorCode.TIMEOUT);
      expect(error.message).toBe(message);
    });
  });
});

describe('Error Handling Functions', () => {
  describe('toToolResult', () => {
    it('should convert LCPError to ToolResult', () => {
      const error = new SessionError('Session not found');
      const result = toToolResult(error);
      
      expect(result).toEqual({
        success: false,
        error: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: 'Session not found',
          details: undefined
        }
      });
    });

    it('should convert regular Error to ToolResult', () => {
      const error = new Error('Regular error');
      const result = toToolResult(error);
      
      expect(result).toEqual({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Regular error',
          details: expect.any(Object)
        }
      });
    });

    it('should convert unknown error to ToolResult', () => {
      const error = 'Unknown error';
      const result = toToolResult(error);
      
      expect(result).toEqual({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'An unknown error occurred',
          details: 'Unknown error'
        }
      });
    });
  });

  describe('withErrorHandling', () => {
    it('should return success result when function resolves', async () => {
      const testData = { key: 'value' };
      const fn = async () => testData;
      
      const result = await withErrorHandling(fn);
      
      expect(result).toEqual({
        success: true,
        data: testData
      });
    });

    it('should return error result when function throws LCPError', async () => {
      const error = new SessionError('Session not found');
      const fn = async () => {
        throw error;
      };
      
      const result = await withErrorHandling(fn);
      
      expect(result).toEqual({
        success: false,
        error: {
          code: ErrorCode.SESSION_NOT_FOUND,
          message: 'Session not found',
          details: undefined
        }
      });
    });

    it('should return error result when function throws regular Error', async () => {
      const error = new Error('Regular error');
      const fn = async () => {
        throw error;
      };
      
      const result = await withErrorHandling(fn);
      
      expect(result).toEqual({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Regular error',
          details: expect.any(Object)
        }
      });
    });

    it('should return error result when function throws unknown error', async () => {
      const error = 'Unknown error';
      const fn = async () => {
        throw error;
      };
      
      const result = await withErrorHandling(fn);
      
      expect(result).toEqual({
        success: false,
        error: {
          code: ErrorCode.INTERNAL_ERROR,
          message: 'An unknown error occurred',
          details: 'Unknown error'
        }
      });
    });
  });
});
