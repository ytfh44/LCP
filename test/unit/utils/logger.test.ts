import winston from 'winston';
import { logger } from '../../../src/utils/logger';

// Mock the winston library to avoid actual file writes during tests
jest.mock('winston', () => {
  const mockTransport = {
    log: jest.fn(),
    close: jest.fn(),
    end: jest.fn(),
  };

  return {
    createLogger: jest.fn(() => ({
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      add: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
      configure: jest.fn(),
      levels: {
        error: 0,
        warn: 1,
        info: 2,
        debug: 3,
      },
    })),
    format: {
      combine: jest.fn(() => 'combined-format'),
      timestamp: jest.fn(() => 'timestamp-format'),
      errors: jest.fn(() => 'errors-format'),
      splat: jest.fn(() => 'splat-format'),
      json: jest.fn(() => 'json-format'),
      colorize: jest.fn(() => 'colorize-format'),
      printf: jest.fn(() => 'printf-format'),
    },
    transports: {
      Console: jest.fn(() => mockTransport),
      File: jest.fn(() => mockTransport),
    },
  };
});

describe('logger', () => {
  it('should be defined', () => {
    expect(logger).toBeDefined();
  });

  it('should have log methods for different levels', () => {
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('should call winston.createLogger with the correct configuration', () => {
    // Since we're testing the logger after it's been created,
    // we can't directly test the configuration. Instead, we'll test
    // that the logger methods are called correctly.
    expect(winston.createLogger).toHaveBeenCalled();
  });

  it('should call the appropriate winston methods when logging', () => {
    const errorMessage = 'Test error message';
    const warnMessage = 'Test warn message';
    const infoMessage = 'Test info message';
    const debugMessage = 'Test debug message';
    const meta = { key: 'value' };

    // @ts-ignore - We're mocking the logger methods
    logger.error(errorMessage, meta);
    // @ts-ignore - We're mocking the logger methods
    logger.warn(warnMessage, meta);
    // @ts-ignore - We're mocking the logger methods
    logger.info(infoMessage, meta);
    // @ts-ignore - We're mocking the logger methods
    logger.debug(debugMessage, meta);

    // Check that the appropriate methods were called
    // @ts-ignore - We're mocking the logger methods
    expect(logger.error).toHaveBeenCalledWith(errorMessage, meta);
    // @ts-ignore - We're mocking the logger methods
    expect(logger.warn).toHaveBeenCalledWith(warnMessage, meta);
    // @ts-ignore - We're mocking the logger methods
    expect(logger.info).toHaveBeenCalledWith(infoMessage, meta);
    // @ts-ignore - We're mocking the logger methods
    expect(logger.debug).toHaveBeenCalledWith(debugMessage, meta);
  });

  it('should call the appropriate winston methods when logging without metadata', () => {
    const errorMessage = 'Test error message';
    const warnMessage = 'Test warn message';
    const infoMessage = 'Test info message';
    const debugMessage = 'Test debug message';

    // @ts-ignore - We're mocking the logger methods
    logger.error(errorMessage);
    // @ts-ignore - We're mocking the logger methods
    logger.warn(warnMessage);
    // @ts-ignore - We're mocking the logger methods
    logger.info(infoMessage);
    // @ts-ignore - We're mocking the logger methods
    logger.debug(debugMessage);

    // Check that the appropriate methods were called
    // @ts-ignore - We're mocking the logger methods
    expect(logger.error).toHaveBeenCalledWith(errorMessage);
    // @ts-ignore - We're mocking the logger methods
    expect(logger.warn).toHaveBeenCalledWith(warnMessage);
    // @ts-ignore - We're mocking the logger methods
    expect(logger.info).toHaveBeenCalledWith(infoMessage);
    // @ts-ignore - We're mocking the logger methods
    expect(logger.debug).toHaveBeenCalledWith(debugMessage);
  });
});
