/**
 * Debugpy-specific DAP client for Python debugging
 */

import { DAPClient } from './client.js';
import { logger } from '../utils/logger.js';

/**
 * Debugpy DAP client for Python debugging
 */
export class DebugpyClient extends DAPClient {
  constructor(workspaceRoot: string) {
    // Use python -u -m debugpy to start the adapter (unbuffered output)
    super('python', ['-u', '-m', 'debugpy.adapter'], workspaceRoot);
  }

  /**
   * Launch a Python program
   */
  async launch(
    program: string,
    args: string[] = [],
    env?: Record<string, string>
  ): Promise<unknown> {
    logger.info('Launching Python program', { program, args });

    const launchConfig = {
      program,
      args,
      env,
      console: 'internalConsole',
      stopOnEntry: true, // Stop at entry point
      justMyCode: false, // Debug all code, not just user code
      showReturnValue: true,
    };

    return this.sendRequest('launch', launchConfig);
  }

  /**
   * Set breakpoints for a file
   */
  async setBreakpoints(
    file: string,
    breakpoints: Array<{
      line: number;
      condition?: string;
      hitCondition?: string;
      logMessage?: string;
    }>
  ): Promise<unknown> {
    const source = {
      path: file,
    };

    return this.sendRequest('setBreakpoints', {
      source,
      breakpoints,
      sourceModified: false,
    });
  }

  /**
   * Continue execution
   */
  async continue(threadId: number): Promise<unknown> {
    return this.sendRequest('continue', { threadId });
  }

  /**
   * Step over (next)
   */
  async next(threadId: number): Promise<unknown> {
    return this.sendRequest('next', { threadId });
  }

  /**
   * Step into
   */
  async stepIn(threadId: number): Promise<unknown> {
    return this.sendRequest('stepIn', { threadId });
  }

  /**
   * Step out
   */
  async stepOut(threadId: number): Promise<unknown> {
    return this.sendRequest('stepOut', { threadId });
  }

  /**
   * Pause execution
   */
  async pause(threadId: number): Promise<unknown> {
    return this.sendRequest('pause', { threadId });
  }

  /**
   * Get stack trace
   */
  async stackTrace(threadId: number): Promise<unknown> {
    return this.sendRequest('stackTrace', {
      threadId,
      startFrame: 0,
      levels: 20,
    });
  }

  /**
   * Get scopes for a frame
   */
  async scopes(frameId: number): Promise<unknown> {
    return this.sendRequest('scopes', { frameId });
  }

  /**
   * Get variables
   */
  async variables(variablesReference: number): Promise<unknown> {
    return this.sendRequest('variables', {
      variablesReference,
      start: 0,
      count: 100,
    });
  }

  /**
   * Evaluate an expression
   */
  async evaluate(
    expression: string,
    frameId?: number,
    context: 'watch' | 'repl' | 'hover' = 'repl'
  ): Promise<unknown> {
    return this.sendRequest('evaluate', {
      expression,
      frameId,
      context,
    });
  }
}
